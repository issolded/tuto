import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'
import { DateTime } from 'luxon'
import exifr from 'exifr'
import twilio from 'twilio'
import { startTelegramBot, sendTelegramMessage, sendTelegramPhoto, sendTelegramMediaGroup, getTelegramChatId, setTelegramMessageHandler, sendTelegramTyping } from './telegram.js'
import crypto, { randomUUID } from 'crypto'
import { homeworkObservationPrompt, parseObservation, filterForParent, homeworkCaptionPrompt, fallbackCaption } from './prompts/homework.js'
import { imageSafetyPrompt, parseImageSafety } from './prompts/imageSafety.js'
import { purgeOldPhotos } from './jobs/purgeOldPhotos.js'

// Default homework reward when a child's task_settings has no homework entry
// yet. Parent can override it from Task settings (dashboard). Read SERVER-SIDE
// only — gems_earned is never taken from the client.
const HOMEWORK_DEFAULT_GEMS = 25

// Fallback gem rate per task type when a child's task_settings has no entry
// yet — mirrors src/lib/taskDefaults.js's TASK_DEFAULTS gems values (kept as
// a separate copy since frontend and backend are deployed independently).
const TASK_DEFAULT_GEMS = { reading: 30, math: 30, writing: 30, homework: HOMEWORK_DEFAULT_GEMS, drawing: 20 }

// Scored tasks: the configured figure is the most a session can pay, not what it will pay.
const VARIABLE_TASKS = new Set(['reading', 'math', 'writing'])

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`

// Transient-only: 503/429/"overloaded"/"high demand" get retried, everything
// else (400 bad prompt, etc.) throws immediately — a real bug shouldn't repeat 3x.
function isRetryableGeminiError(err) {
  if (err?.status === 503 || err?.status === 429) return true
  return /overloaded|high demand|unavailable|rate.?limit|resource_exhausted/i.test(err?.message || '')
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const GEMINI_RETRY_DELAYS_MS = [500, 1500, 4000]

// Runs `fn` (one attempt at a Gemini call) with retry-on-transient-failure:
// up to 3 retries (4 attempts total) with exponential backoff + jitter.
// Non-retryable errors propagate immediately without waiting.
async function callGeminiWithRetry(fn) {
  let lastErr
  for (let i = 0; i <= GEMINI_RETRY_DELAYS_MS.length; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (i === GEMINI_RETRY_DELAYS_MS.length || !isRetryableGeminiError(err)) throw err
      const base = GEMINI_RETRY_DELAYS_MS[i]
      const delay = base + Math.random() * base * 0.2
      console.warn(`[MSG] Gemini transient error, retry ${i + 1}/${GEMINI_RETRY_DELAYS_MS.length} in ${Math.round(delay)}ms: ${err.message}`)
      await sleep(delay)
    }
  }
  throw lastErr
}

// One attempt at a Gemini call — resolves with parsed JSON, or throws an
// Error with `.status` set to the HTTP status so callGeminiWithRetry can
// tell a transient failure from a real one.
async function fetchGeminiOnce(body) {
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    const err = new Error(errBody.error?.message || `Gemini API error ${res.status}`)
    err.status = res.status
    throw err
  }
  return res.json()
}

const GEMINI_FALLBACK_REPLY = {
  tr: 'Şu an yapay zeka platformumdaki bir teknik sorun nedeniyle mesajla yanıt veremiyorum. Bunu çözene kadar tüm ayarlara ve onaylara Tuto uygulaması üzerinden erişebilirsiniz.',
  en: "I'm currently unable to reply due to a technical issue with my AI platform. Until this is resolved, you can access all settings and approvals through the Tuto app.",
}

// Every timestamp handed to the model is a raw UTC ISO string, while the prompt tells it the
// parent's current LOCAL time. It has no way to reconcile the two and does not try: asked what
// the child did, it read 05:01:56+00:00 and reported "early morning, 05:01" for a session the
// child sat down to at 09:01 in Dubai. Times are converted before the model ever sees them, so
// there is nothing left to reconcile.
const TIME_KEYS = new Set(['created_at', 'photo_taken_at', 'parent_approved_at', 'date', 'session_date'])

function toLocalTimes(value, tz) {
  if (Array.isArray(value)) return value.map(v => toLocalTimes(v, tz))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => {
      // Only full timestamps. A plain calendar date like session_date "2026-08-05" carries no
      // time to shift, and converting it anyway would invent one and could move the day.
      if (TIME_KEYS.has(k) && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
        const dt = DateTime.fromISO(v, { zone: 'utc' }).setZone(tz)
        return [k, dt.isValid ? dt.toFormat('yyyy-MM-dd HH:mm') : v]
      }
      return [k, toLocalTimes(v, tz)]
    }))
  }
  return value
}

async function getParentContext(parentId) {
  const [{ data: parentRow }, { data: children }] = await Promise.all([
    supabase.from('parents').select('timezone, prefs').eq('id', parentId).single(),
    supabase.from('children').select('id, name, age, task_settings, math_focus').eq('parent_id', parentId),
  ])
  if (!children?.length) return []

  const tz = parentRow?.timezone || 'UTC'
  const userNow = DateTime.now().setZone(tz)
  const todayStart = userNow.startOf('day').toUTC().toISO()
  const todayEnd   = userNow.endOf('day').toUTC().toISO()
  // Only the preferences this system actually honours. The full prefs blob was handed to the
  // model as family data, and the model is told to report facts from it — so it would answer
  // "how many gems is maths worth?" with prefs.gem_values.math (20) while the server pays
  // task_settings.math.gems (30), and "do you message at night?" with the 08:00–21:30 in
  // allowed_hours, which nothing enforces. Seven of the nine fields are read by no code at
  // all: they are the schema for the two gates, and the gates are not built yet. Until they
  // are, describing them to the parent is describing something that does not happen.
  const prefsAll = parentRow?.prefs ?? null
  const parentPrefs = prefsAll
    ? { language: prefsAll.language ?? null, tone: prefsAll.tone ?? null,
        // Back in the moment something started honouring it: the maths notification reads this
        // to decide between a message per session and one a day.
        notify_per_task: prefsAll.notify_per_task !== false }
    : null

  return Promise.all(children.map(async child => {
    const [
      { data: submissions },
      { data: todaySubs },
      { data: mathProgress },
      { data: ledger },
      { data: stories },
      { data: books },
      { data: pendingContribs, error: pendingError },
      { data: pendingSubs },
      treeState,
      { data: pendingPaintings },
      { data: pendingClaims },
      mathStanding,
      { data: lastMathQuestions },
    ] = await Promise.all([
      supabase.from('submissions').select('task_type, score, gems_earned, status, created_at, feedback, generated_questions').eq('child_id', child.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('submissions').select('task_type, score, gems_earned, status, created_at').eq('child_id', child.id).gte('created_at', todayStart).lte('created_at', todayEnd).order('created_at', { ascending: false }),
      supabase.from('math_progress').select('level, topic, accuracy, level_change, help_used, questions_total, created_at').eq('child_id', child.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('bt_ledger').select('amount, reason, created_at').eq('child_id', child.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('stories').select('title, created_at').eq('child_id', child.id).order('created_at', { ascending: false }).limit(5).then(r => r).catch(() => ({ data: [] })),
      supabase.from('books').select('title, completed, created_at').eq('child_id', child.id).order('created_at', { ascending: false }).limit(5).then(r => r).catch(() => ({ data: [] })),
      supabase.from('contribution_log').select('id, label, category, created_at').eq('child_id', child.id).eq('status', 'pending').order('created_at', { ascending: false }),
      // Pending submissions (homework) awaiting a parent reply — WITH ids
      // so the parent can approve/reject by free text ("onayla", "25 gem yeter").
      supabase.from('submissions').select('id, task_type, task_description, suggested_gems, photo_taken_at, created_at, photo_urls, media_url, status').eq('child_id', child.id).in('status', ['pending', 'blocked']).order('created_at', { ascending: false }),
      // The tree is its own thing — a kindness diary, not a function of gems or
      // math level. Without it in context the model answered "how is the tree?"
      // by improvising from gems/level/stories, which is a different subject.
      getTreeState(child.id, tz).catch(() => null),
      supabase.from('paintings')
        .select('id, drawing_id, created_at, status')
        .eq('child_id', child.id)
        .in('status', ['pending', 'blocked'])
        .order('created_at', { ascending: false }),
      // Reward claims (child tapped "Claim") awaiting a parent decision — same
      // shape as pendingDrawings/pendingSubs, so a "what's this notification
      // about?" reply has something real to answer with instead of guessing.
      supabase.from('reward_claims')
        .select('id, reward_name, reward_icon, bt_cost, created_at')
        .eq('child_id', child.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
      topicStanding(child.id).catch(() => null),
      // The questions themselves. math_attempts has held them since yesterday and the parent
      // asked the obvious thing — "ne sorular çıktı, ne yanıt verdi" — and was told the texts
      // are not in the system. They were, two tables away. The most recent sitting only:
      // that is what "bugün ne yaptı" means, and forty rows would crowd the context.
      supabase.from('math_attempts')
        .select('session_id, topic_name, question, child_answer, correct, help_used, created_at')
        .eq('child_id', child.id).order('created_at', { ascending: false }).limit(10),
    ])

    const sub = submissions || []
    const math = mathProgress || []
    const led = ledger || []
    const today = todaySubs || []
    const pendingContributions = pendingContribs || []

    // A failed read here must NEVER be reported as "no pending contributions" —
    // that's a false negative a parent could act on (or rather, not act on).
    // Surface the failure explicitly instead of silently coercing it to [].
    if (pendingError) console.error(`[CONTEXT] pending contributions read failed for child=${child.id}: ${pendingError.message}`)

    return toLocalTimes({
      name: child.name,
      age: child.age,
      totalGems: led.reduce((s, r) => s + (r.amount || 0), 0),
      todaySubmissions: today.length ? today : `${child.name} has not completed any tasks today`,
      // Reading stores what it asked and what the child said, and the parent can open it in
      // the app — but the chat agent was never given it, so "which ones did she get wrong?"
      // was answered "I cannot see that" about data we hold. Only the newest few rounds carry,
      // and only their questions: twenty submissions' worth would crowd out everything else.
      submissions: sub.length
        ? sub.map(({ generated_questions, ...rest }) => rest)
        : `${child.name} has not completed any tasks yet`,
      recentReadingQuestions: (() => {
        const rounds = sub
          .filter(x => x.task_type === 'reading' && Array.isArray(x.generated_questions) && x.generated_questions.length)
          .slice(0, 3)
          .map(x => ({
            book: x.feedback || 'a book',
            created_at: x.created_at,
            questions: x.generated_questions.map(q => ({
              question: q?.question ?? null,
              child_answer: q?.child_answer ?? null,
              was_correct: q?.was_correct ?? null,
            })),
          }))
        return rounds.length ? rounds : `no reading questions recorded for ${child.name} yet`
      })(),
      mathProgress: math.length ? math : `${child.name} has not done any math yet`,
      // Per-topic standing, computed from the raw attempts by the same function the question
      // generator reads. One object, two readers — if the parent is told fractions are weak
      // and the next session does not lean on fractions, that is a lie of exactly the kind
      // this week has been spent removing.
      // "not enough yet" is carried through rather than hidden: a topic with three attempts
      // is not a strong topic, and the model must not round it into one.
      // Topics under the floor are sent WITHOUT their numbers. Labelling them "not enough yet"
      // and leaving accuracy beside it was not enough: given one correct answer out of one, the
      // model reported "100% doğruluk, oldukça başarılı", and given one wrong answer, "%0". The
      // verdict being code's to make means the model must not be handed the figures that would
      // let it make its own.
      mathTopics: mathStanding?.length
        ? mathStanding.map(t => t.standing === 'not enough yet'
            ? { topic_name: t.topic_name, attempts: t.attempts,
                standing: `only ${t.attempts} answered so far — too few to judge, do NOT state a score or call it strong or weak` }
            : t)
        : `not enough maths answered yet to say anything per topic for ${child.name}`,
      recentMathQuestions: (lastMathQuestions || []).length
        ? (lastMathQuestions || []).filter(r => r.session_id === lastMathQuestions[0].session_id)
            .map(r => ({ topic: r.topic_name, question: r.question, child_answer: r.child_answer,
                         was_correct: r.correct, used_hint: r.help_used }))
        : `no maths questions recorded for ${child.name} yet`,
      mathFocus: child.math_focus
        ? { ...child.math_focus, note: 'a parent asked for this; it clears itself once the topic passes 80% over its last 12' }
        : 'no topic is being weighted for ' + child.name,
      gemHistory: led.length ? led : `${child.name} has no gem history yet`,
      stories: (stories || []).length ? stories : `${child.name} has not written any stories yet`,
      books: (books || []).length ? books : `${child.name} has not read any books yet`,
      // The CURRENT gem reward per task type — ground truth for "kaç gem
      // veriyoruz" questions and the before/after numbers update_task_reward
      // reports. Falls back to TASK_DEFAULT_GEMS for any type the parent
      // hasn't customized yet.
      // Reading, maths and writing are scored, so the figure is a CEILING — the server pays it
      // scaled by how the child did, and again by a third if they took help. A bare number read
      // as a flat rate: asked what maths was worth, the model answered "exactly 30 gems every
      // time" for a session that had just paid 15.
      taskRewards: Object.fromEntries(
        Object.entries(TASK_DEFAULT_GEMS).map(([type, def]) => {
          const gems = child.task_settings?.[type]?.gems ?? def
          return [type, VARIABLE_TASKS.has(type) ? `up to ${gems} (scaled by score)` : gems]
        })
      ),
      pendingContributions: pendingError
        ? `${child.name}'s pending contributions could not be read right now (temporary error) — do NOT say there are none, tell the parent you couldn't check and to ask again shortly`
        : (pendingContributions.length ? pendingContributions : `${child.name} has no contributions awaiting approval`),
      pendingCheckFailed: !!pendingError,
      // Drawings wait for the parent too, but they are NOT submissions — a
      // different table and different approve/reject tools.
      // Held after the safety screen refused them. Named apart from pendingDrawings because
      // they are NOT awaiting approval — there is nothing to approve. They exist so a parent
      // who was told their child uploaded something can look, and they go after a week.
      blockedDrawings: (pendingPaintings || []).filter(p => p.status === 'blocked').map(p => ({
        id: p.id, created_at: p.created_at,
        note: 'the safety screen refused this; send it with send_drawing_photo if the parent asks to see it',
      })),
      pendingDrawings: (pendingPaintings || []).filter(p => p.status !== 'blocked').map(p => ({
        id: p.id,
        what: p.drawing_id || 'kendi çizimi',
        created_at: p.created_at,
      })),
      // A reward CLAIM spends gems on approval — the exact opposite direction
      // from a submission/contribution/drawing approval, and unrelated to
      // gift_gems (which has no pending item at all). Keep it visibly distinct
      // here so the model never reaches for gift_gems to "resolve" one of these.
      pendingRewardClaims: (pendingClaims || []).map(c => ({
        id: c.id,
        reward: c.reward_name,
        icon: c.reward_icon,
        cost: c.bt_cost,
        created_at: c.created_at,
      })),
      tree: treeState
        ? {
            leavesToday: treeState.today,
            leavesForAFullTreeToday: treeState.dayFull,
            todaysTreeFullyGrown: treeState.todayComplete,
            treesThisMonth: treeState.monthTreeCount,
            daysElapsedThisMonth: treeState.monthDaysElapsed,
            leavesThisMonth: treeState.monthLeafCount,
            month: treeState.monthName,
            recentLeaves: treeState.recentLeaves.length
              ? treeState.recentLeaves
              : `${child.name} has no approved contributions this month yet`,
          }
        : `${child.name}'s tree could not be read right now (temporary error) — tell the parent you couldn't check it, do NOT guess`,
      pendingSubmissions: (pendingSubs || []).map(s => {
        // Photo count MUST be in context: without it the model confidently told
        // a parent the homework was "saved without any photo" while the photos
        // were sitting right there in the dashboard.
        const urls = (s.photo_urls?.length ? s.photo_urls : (s.media_url ? [s.media_url] : []))
        return {
          id: s.id,
          task_type: s.task_type,
          status: s.status,
          description: s.task_description || (s.task_type === 'homework' ? 'Ödev' : s.task_type),
          suggested_gems: s.suggested_gems ?? null,
          photo_taken_at: s.photo_taken_at ?? null,
          created_at: s.created_at,
          photoCount: urls.length,
        }
      }),
      parentPrefs,
    }, tz)
  }))
}

async function askGeminiWithContext(parentId, userMessage) {
  const [familyData, { data: parentRow }] = await Promise.all([
    getParentContext(parentId),
    supabase.from('parents').select('timezone').eq('id', parentId).single(),
  ])
  const tz = parentRow?.timezone || 'UTC'
  const userNow = DateTime.now().setZone(tz)
  const localTimeStr = `${userNow.toFormat('yyyy-MM-dd HH:mm')} (${tz})`

  const systemPrompt =
    `You are Tuto, a warm AI learning assistant and trusted family companion.\n` +
    `Current local time for parent: ${localTimeStr}\n` +
    `You know this family's learning data:\n${JSON.stringify(familyData, null, 2)}\n\n` +
    `Guidelines:\n` +
    `- Respond in the SAME LANGUAGE as the parent's message\n` +
    `- Be conversational and warm, like a trusted friend who knows the kids\n` +
    `- Reference specific data when relevant (e.g. "Ada earned 30 gems yesterday!")\n` +
    `- Keep responses concise — max 3-4 sentences for simple questions\n` +
    `- For progress questions, give concrete insights from the data\n\n` +
    `All times in the data are already in the parent's local timezone — read them as written.\n\n` +
    // Asked whether it messages late at night, the model had nothing to go on and answered
    // that it never messages first — which is untrue, and exactly the sort of thing a parent
    // decides whether to trust the product on. What it actually sends is small and knowable,
    // so it is stated rather than left to be guessed at.
    `What you send on your own, without being asked: one message the first time a child earns\n` +
    `gems from maths or reading each day, a message when homework or a drawing is submitted for\n` +
    `approval, and a message when a child asks to claim a reward. Nothing is scheduled and there\n` +
    `are no quiet hours yet — if a child works late, the message goes then. Everything else is a\n` +
    `reply to the parent.\n\n` +
    `CRITICAL: Only report facts from the data provided.\n` +
    `If the data is empty or null, say so honestly.\n` +
    `NEVER invent or assume activity that is not in the data.\n` +
    `If a field is empty, say the child hasn't done that yet.`

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Gemini API error ${res.status}`)
  }
  const data = await res.json()
  return textFromParts(data.candidates?.[0]?.content?.parts) || 'Yanıt alınamadı.'
}

async function _geminiScreenCall(text, age) {
  const n = Number(age) || 7
  const prompt =
    `You are a child-safety classifier for a children's educational app. ` +
    `A ${n}-year-old child wrote this text about something they did or are feeling: "${text.replace(/"/g, '\\"')}"\n\n` +
    `Classify on TWO independent axes and return JSON only:\n` +
    `{\n` +
    `  "appropriateness": "ok" | "inappropriate",\n` +
    `  "concern_level": "none" | "mild" | "concerning" | "serious",\n` +
    `  "reason": "<short explanation>"\n` +
    `}\n\n` +
    `appropriateness: "inappropriate" if the text contains profanity, explicit content, violence, or adult themes. Otherwise "ok".\n` +
    `concern_level rules:\n` +
    `  - "none": no emotional or safety concern.\n` +
    `  - "mild": temporary/normal emotion (sad, bored, angry) with no distress signals.\n` +
    `  - "concerning": repeated or intense distress, loneliness, feeling unloved/worthless, persistent fear.\n` +
    `  - "serious": any hint of self-harm, harm to others, abuse, or a genuine safety signal.\n` +
    `The two axes are INDEPENDENT. A text can be appropriate but concerning, or inappropriate but not concerning.\n` +
    `"serious" should only be used when there is a real, unambiguous signal — not for hyperbolic child language like "I want to kill this homework".`

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { response_mime_type: 'application/json' },
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Gemini API error ${res.status}`)
  }
  const data = await res.json()
  const parsed = JSON.parse(textFromParts(data.candidates?.[0]?.content?.parts) || '{}')
  if (!['ok', 'inappropriate'].includes(parsed.appropriateness)) throw new Error('malformed screen response')
  if (!['none', 'mild', 'concerning', 'serious'].includes(parsed.concern_level)) throw new Error('malformed screen response')
  return parsed
}

async function _geminiConfirmSerious(text, age) {
  const n = Number(age) || 7
  const prompt =
    `You are a second-opinion child-safety reviewer. A first classifier flagged this text from a ${n}-year-old as ` +
    `a SERIOUS safety signal: "${text.replace(/"/g, '\\"')}"\n\n` +
    `Is this truly a serious safety signal (self-harm, harm to others, abuse), or is it most likely hyperbolic ` +
    `child language, frustration, or play? Return JSON only:\n` +
    `{ "confirmed_serious": boolean, "reason": "<short explanation>" }`

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { response_mime_type: 'application/json' },
    }),
  })
  if (!res.ok) return { confirmed_serious: true } // fail-closed on confirm step
  const data = await res.json()
  const parsed = JSON.parse(textFromParts(data.candidates?.[0]?.content?.parts) || '{}')
  return parsed
}

async function screenChildInput(text, age) {
  const result = await _geminiScreenCall(text, age)

  if (result.concern_level === 'serious') {
    try {
      const confirm = await _geminiConfirmSerious(text, age)
      if (!confirm.confirmed_serious) {
        result.concern_level = 'concerning'
      }
    } catch {
      // fail-closed: keep serious
    }
  }

  return result
}

// The single server-side image safety gate for every child photo upload
// (homework, drawings, home contribution photos). screenChildInput above only classifies TEXT — it never
// sees the picture — so this is what actually stops an inappropriate image.
// FAILS CLOSED: any transport error, model refusal or malformed response
// returns "not appropriate" so the caller blocks rather than forwards.
async function screenImageSafety({ images, kind, language }) {
  try {
    const parts = [
      { text: imageSafetyPrompt({ kind, language }) },
      ...images.map(i => ({ inline_data: { mime_type: i.mimeType, data: i.buffer.toString('base64') } })),
    ]
    const data = await callGeminiWithRetry(() => fetchGeminiOnce({
      contents: [{ parts }],
      generationConfig: { response_mime_type: 'application/json' },
    }))
    return parseImageSafety(textFromParts(data.candidates?.[0]?.content?.parts) || '{}')
  } catch (err) {
    console.error(`[SAFETY] ${kind} image screen failed (failing closed): ${err.message}`)
    return { appropriate: false, matchesTask: false, reason: 'safety check failed' }
  }
}

// 'https://…/storage/v1/object/public/submissions/<path>' → '<path>', so a
// blocked upload can be deleted from Storage instead of lingering there.
function storagePathFromPublicUrl(url) {
  const marker = '/storage/v1/object/public/submissions/'
  const i = String(url || '').indexOf(marker)
  return i === -1 ? null : decodeURIComponent(String(url).slice(i + marker.length))
}

// Child photos of real homework / real rooms live in a PRIVATE bucket and are
// only ever readable through a short-lived signed URL. The old public
// 'submissions' bucket stays as-is for story covers (AI cover art, shown
// directly by the unauthenticated child app) and for legacy rows.
const PHOTO_BUCKET = 'submission-photos'

// Photos of the child's own drawings. Private, and — unlike the homework
// bucket — written ONLY by the service role from this file. There is no
// client upload policy on it at all. Declared next to PHOTO_BUCKET because
// signedUrlFor() below has to be told which of the two a path belongs to.
const PAINTING_BUCKET = 'paintings'

// New rows store a storage PATH; legacy rows store a full public URL. Anything
// starting with http is legacy public and returned untouched; everything else
// is signed against the private bucket.
// `bucket` matters: a path only signs against the bucket it actually lives in.
// Drawing photos live in PAINTING_BUCKET, and signing them against the homework
// bucket silently returned null — which made the Telegram photo fall back to a
// text-only message and left the library and dashboard blank.
async function signedUrlFor(pathOrUrl, expiresIn = 3600, bucket = PHOTO_BUCKET) {
  const v = String(pathOrUrl || '')
  if (!v) return null
  if (/^https?:\/\//i.test(v)) return v // legacy public URL
  let { data, error } = await supabase.storage.from(bucket).createSignedUrl(v, expiresIn)
  if (error && bucket === PHOTO_BUCKET) {
    // Transitional: a path written before the private bucket existed.
    ;({ data, error } = await supabase.storage.from('submissions').createSignedUrl(v, expiresIn))
  }
  if (error) {
    console.error(`[STORAGE] could not sign ${v} in ${bucket}: ${error.message}`)
    return null
  }
  return data.signedUrl
}

async function signedUrlsFor(list, expiresIn = 3600) {
  const out = await Promise.all((list || []).map(v => signedUrlFor(v, expiresIn)))
  return out.filter(Boolean)
}

// Reads a stored photo's bytes for server-side work (safety screen, EXIF),
// handling both new private-bucket paths and legacy public URLs.
async function readStoredPhoto(pathOrUrl) {
  const v = String(pathOrUrl || '')
  if (/^https?:\/\//i.test(v)) {
    const legacyPath = storagePathFromPublicUrl(v)
    if (!legacyPath) throw new Error('unrecognized photo location')
    const { data, error } = await supabase.storage.from('submissions').download(legacyPath)
    if (error || !data) throw new Error(error?.message || 'download failed')
    return Buffer.from(await data.arrayBuffer())
  }
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).download(v)
  if (error || !data) throw new Error(error?.message || 'download failed')
  return Buffer.from(await data.arrayBuffer())
}

// ── WhatsApp (Twilio) ──────────────────────────────────────────────────────
// Twilio is a BSP wrapping Meta's WhatsApp Business Platform — same 24h
// customer-service-window rule applies: free-form text only works as a
// reply within 24h of the parent's last inbound message. That's fine here,
// every send in this file is a reply to something the parent just did.
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER // e.g. "+971553286179"
const twilioClient = (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null

// WhatsApp's typing indicator, the counterpart to sendTelegramTyping. It is not a standalone
// "show typing to this number" call: it references the inbound message being answered, and
// Twilio marks that message read as it shows the bubble. So it can only follow something the
// parent sent — which is the only place it belongs anyway. It clears itself when the reply
// lands, or after 25 seconds.
//
// Public beta at Twilio, so it is fire-and-forget: a typing bubble is never worth failing a
// reply over.
async function sendWhatsAppTyping(messageSid) {
  const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN
  // Silence was the problem the first time this did not work: with no log for the skip and
  // none for success, a missing SID, a missing credential and a rejected call all looked
  // identical from the outside.
  if (!sid || !token || !messageSid) {
    console.log(`[WA] typing skipped — sid:${!!sid} token:${!!token} messageSid:${messageSid || 'none'}`)
    return
  }
  // JSON, not form-encoded. Twilio's older APIs take form bodies, so that was the assumption
  // — this one answered 415 / 20422, "does not support this payload format". The .json on the
  // path was the tell.
  const auth = Buffer.from(`${sid}:${token}`).toString('base64')
  const res = await fetch('https://messaging.twilio.com/v3/Indicators/Typing.json', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    // WHATSAPP, upper case. The prose in Twilio's docs says "whatsapp" and the curl sample
    // beside it uses "WHATSAPP"; lower case is answered 400, "input may be invalid".
    body: JSON.stringify({ messageId: messageSid, channel: 'WHATSAPP' }),
  })
  if (!res.ok) console.error(`[WA] typing failed: ${res.status} ${(await res.text()).slice(0, 200)}`)
  else console.log(`[WA] typing shown for ${messageSid}`)
}

async function sendWhatsAppBusinessMessage(to, message) {
  if (!twilioClient || !TWILIO_WHATSAPP_NUMBER) throw new Error('Twilio not configured')
  const toE164 = to.startsWith('+') ? to : `+${to}`
  await twilioClient.messages.create({
    from: `whatsapp:${TWILIO_WHATSAPP_NUMBER}`,
    to: `whatsapp:${toE164}`,
    body: message,
  })
}

// Twilio takes a public/signed image URL directly (mediaUrl) — it fetches
// and hosts it itself, no manual upload-then-send dance like Meta's raw API.
async function sendWhatsAppPhoto(to, photoUrl, caption) {
  if (!twilioClient || !TWILIO_WHATSAPP_NUMBER) throw new Error('Twilio not configured')
  const toE164 = to.startsWith('+') ? to : `+${to}`
  await twilioClient.messages.create({
    from: `whatsapp:${TWILIO_WHATSAPP_NUMBER}`,
    to: `whatsapp:${toE164}`,
    body: caption,
    mediaUrl: [photoUrl],
  })
}

// Gemini can return "thinking" parts alongside the answer, and they carry text like any other
// part. Joining every part blindly leaks that reasoning to the parent — one reply arrived as
// "festival<thought>". Thoughts are dropped here, in one place, so no call site has to
// remember. Reading parts[0].text has the same fault when the first part is a thought.
function textFromParts(parts) {
  return (parts || []).filter(p => !p.thought).map(p => p.text || '').join('').trim()
}

async function sendNotification(parentId, message) {
  // Every proactive notification (homework arrived, reward
  // claimed, ...) used to be invisible to Gemini — logMessage only ran for
  // genuine chat turns, so when a parent replied "what does that mean?" the
  // model had no record of what "that" was and improvised. Logging it here,
  // unconditionally, means fetchConversationHistory picks it up as a 'tuto'
  // turn the next time this parent writes in.
  logMessage(parentId, 'tuto', message).catch(() => {})

  const { data: parent } = await supabase
    .from('parents')
    .select('notification_channel, telegram_chat_id, whatsapp_phone')
    .eq('id', parentId)
    .single()

  const channel = parent?.notification_channel || 'none'
  console.log(`[NOTIFY] parent=${parentId} channel="${channel}" telegram_chat_id=${parent?.telegram_chat_id ?? 'null'} whatsapp_phone=${parent?.whatsapp_phone ?? 'null'}`)

  // ── Telegram ──────────────────────────────────────────────────────────────
  if (channel === 'telegram' && parent?.telegram_chat_id) {
    try {
      await sendTelegramMessage(parent.telegram_chat_id, message)
      console.log(`[NOTIFY] ✅ Sent via Telegram → parent ${parentId}`)
      return
    } catch (err) {
      console.error(`[NOTIFY] ❌ Telegram failed: ${err.message}`)
    }
  }

  // ── WhatsApp (Twilio) ─────────────────────────────────────────────────────
  if (channel === 'whatsapp' && parent?.whatsapp_phone) {
    try {
      await sendWhatsAppBusinessMessage(parent.whatsapp_phone, message)
      console.log(`[NOTIFY] ✅ Sent via WhatsApp → parent ${parentId}`)
      return
    } catch (err) {
      console.error(`[NOTIFY] ❌ WhatsApp failed: ${err.message}`)
    }
  }

  console.log(`[NOTIFY] ⚠️ No working channel for parent ${parentId} (channel="${channel}") — message dropped`)
}

async function sendNotificationWithPhoto(parentId, message, photoUrl, bucket = PHOTO_BUCKET) {
  // Same reasoning as sendNotification — log the text so a later "what's
  // this photo?" reply has something to look back at.
  logMessage(parentId, 'tuto', message).catch(() => {})

  // Sign at the boundary: the messaging platform fetches the image once, so a
  // short TTL is plenty and no long-lived public link ever leaves the server.
  photoUrl = (await signedUrlFor(photoUrl, 900, bucket)) || photoUrl

  const { data: parent } = await supabase
    .from('parents')
    .select('notification_channel, telegram_chat_id, whatsapp_phone')
    .eq('id', parentId)
    .single()

  const channel = parent?.notification_channel || 'none'
  console.log(`[NOTIFY-PHOTO] parent=${parentId} channel="${channel}" telegram_chat_id=${parent?.telegram_chat_id ?? 'null'} whatsapp_phone=${parent?.whatsapp_phone ?? 'null'}`)

  // ── Telegram with photo ───────────────────────────────────────────────────
  if (channel === 'telegram' && parent?.telegram_chat_id) {
    try {
      await sendTelegramPhoto(parent.telegram_chat_id, photoUrl, message)
      console.log(`[NOTIFY-PHOTO] ✅ Sent photo via Telegram → parent ${parentId}`)
      return
    } catch (err) {
      console.error(`[NOTIFY-PHOTO] ❌ Telegram photo failed: ${err.message} — trying text`)
      try {
        await sendTelegramMessage(parent.telegram_chat_id, message)
        console.log(`[NOTIFY-PHOTO] ✅ Sent text fallback via Telegram → parent ${parentId}`)
        return
      } catch (err2) {
        console.error(`[NOTIFY-PHOTO] ❌ Telegram text fallback also failed: ${err2.message}`)
      }
    }
  }

  // ── WhatsApp (Twilio) — real photo, not just a text fallback ─────────────
  if (channel === 'whatsapp' && parent?.whatsapp_phone) {
    try {
      await sendWhatsAppPhoto(parent.whatsapp_phone, photoUrl, message)
      console.log(`[NOTIFY-PHOTO] ✅ Sent photo via WhatsApp → parent ${parentId}`)
      return
    } catch (err) {
      console.error(`[NOTIFY-PHOTO] ❌ WhatsApp photo failed: ${err.message} — trying text`)
      try {
        await sendWhatsAppBusinessMessage(parent.whatsapp_phone, message)
        console.log(`[NOTIFY-PHOTO] ✅ Sent text fallback via WhatsApp → parent ${parentId}`)
        return
      } catch (err2) {
        console.error(`[NOTIFY-PHOTO] ❌ WhatsApp text fallback also failed: ${err2.message}`)
      }
    }
  }

  console.log(`[NOTIFY-PHOTO] ⚠️ No working channel for parent ${parentId} (channel="${channel}") — message dropped`)
}

// Multi-photo variant for homework (up to 15 pages). Telegram gets a native
// album; other channels have no album primitive here, so they fall back to
// the first photo + caption (parent still sees the homework arrived and can
// open the app). The notification must NEVER be lost — every path degrades to
// text rather than throwing.
async function sendNotificationWithPhotos(parentId, message, photoUrls) {
  const raw = (photoUrls || []).filter(Boolean)
  if (raw.length <= 1) return sendNotificationWithPhoto(parentId, message, raw[0] || null)
  // Short-lived signed URLs — Telegram fetches and re-hosts them immediately.
  const urls = await signedUrlsFor(raw, 900)
  if (!urls.length) return sendNotification(parentId, message)

  const { data: parent } = await supabase
    .from('parents')
    .select('notification_channel, telegram_chat_id, whatsapp_phone')
    .eq('id', parentId)
    .single()

  const channel = parent?.notification_channel || 'none'
  console.log(`[NOTIFY-PHOTOS] parent=${parentId} channel="${channel}" photos=${urls.length}`)

  if (channel === 'telegram' && parent?.telegram_chat_id) {
    try {
      await sendTelegramMediaGroup(parent.telegram_chat_id, urls, message)
      console.log(`[NOTIFY-PHOTOS] ✅ Sent album (${urls.length}) via Telegram → parent ${parentId}`)
      // Only this branch needs its own log call — the other two paths above
      // (single photo, no signed URLs) delegate to functions that already log.
      logMessage(parentId, 'tuto', message).catch(() => {})
      return
    } catch (err) {
      console.error(`[NOTIFY-PHOTOS] ❌ Telegram album failed: ${err.message} — trying single photo`)
    }
  }

  // Any other channel, or a failed album: fall back to the single-photo path
  // (which itself falls back to text if the photo send fails).
  await sendNotificationWithPhoto(parentId, message, urls[0])
}

// ── Contribution diary tools (function-calling) ───────────────────────────────
const CONTRIBUTION_TOOLS = [{
  functionDeclarations: [
    {
      name: 'approve_contribution',
      description:
        'Approve ONE SPECIFIC pending household contribution diary entry, by its exact id. Only call this when ' +
        'the parent clearly expresses intent to approve a single named/described contribution from the pending ' +
        'list. If more than one contribution is pending and it is unclear which one the parent means, do NOT call ' +
        'this — ask the parent to clarify first. If the parent wants to approve ALL of a child\'s pending ' +
        'contributions at once (e.g. "hepsini onayla", "approve all", "ikisini de onayla", "approve both"), use ' +
        'approve_all_pending instead — do NOT call this repeatedly to cover multiple contributions; copying long ' +
        'ids by hand for each one is unreliable and can silently fail partway through.',
      parameters: {
        type: 'OBJECT',
        properties: {
          contribution_id: { type: 'STRING', description: 'The exact id of the contribution to approve, taken from the pending contributions list in context.' },
          note: { type: 'STRING', description: 'Optional note from the parent to pass along to the child.' },
        },
        required: ['contribution_id'],
      },
    },
    {
      name: 'approve_all_pending',
      description:
        'Ebeveyn bir çocuğun TÜM onay bekleyen katkılarını onaylamak isterse (örn. "hepsini onayla", "approve ' +
        'all", "ikisini de onayla") bunu kullan. Tek tek contribution_id vermeye gerek yok — bu araç o çocuğun ' +
        'tüm pending katkılarını tek işlemde onaylar. Sadece belirli/tek bir katkı onaylanmak isteniyorsa bunun ' +
        'yerine approve_contribution kullan.',
      parameters: {
        type: 'OBJECT',
        properties: {
          child_id: { type: 'STRING', description: 'The exact id of the child whose pending contributions should all be approved, taken from the children list in context.' },
        },
        required: ['child_id'],
      },
    },
    {
      name: 'reject_contribution',
      description:
        'Reject a pending household contribution diary entry. Only call this when the parent clearly expresses ' +
        'intent to reject ONE SPECIFIC contribution from the pending list. If more than one contribution is ' +
        'pending and it is unclear which one the parent means, do NOT call this — ask the parent to clarify first.',
      parameters: {
        type: 'OBJECT',
        properties: {
          contribution_id: { type: 'STRING', description: 'The exact id of the contribution to reject, taken from the pending contributions list in context.' },
          note: { type: 'STRING', description: 'Optional note from the parent to pass along to the child.' },
        },
        required: ['contribution_id'],
      },
    },
    {
      name: 'send_drawing_photo',
      description:
        'Sends the parent an image the safety screen refused, when they ask to see what their ' +
        'child uploaded. The ids are in that child\'s blockedDrawings in context. Only for ' +
        'those — a drawing awaiting approval is already visible in the app. If they have not ' +
        'asked, do not offer beyond saying it is available; if the id is not in the list it is ' +
        'gone, since these are kept a week and then deleted.',
      parameters: {
        type: 'OBJECT',
        properties: {
          painting_id: { type: 'STRING', description: 'The exact id from that child\'s blockedDrawings in context.' },
        },
        required: ['painting_id'],
      },
    },
    {
      name: 'approve_drawing',
      description:
        'Approve ONE SPECIFIC pending drawing (a picture the child drew and photographed), by its exact id from ' +
        'the "pending drawings" list in context. Call this when the parent approves it in free text ("onayla", ' +
        '"evet", "harika, onaylıyorum"). A drawing is NOT a submission and NOT a contribution — do not use ' +
        'approve_submission or approve_contribution for it. The reward amount is decided by the server (there is ' +
        'a daily cap), so there is no gems parameter here. If more than one drawing is pending and it is unclear ' +
        'which one the parent means, do NOT call this — ask which one first. Never invent an id.',
      parameters: {
        type: 'OBJECT',
        properties: {
          painting_id: { type: 'STRING', description: 'The exact id of the drawing to approve, taken from the pending drawings list in context.' },
        },
        required: ['painting_id'],
      },
    },
    {
      name: 'reject_drawing',
      description:
        'Reject a pending drawing. The picture stays in the child\'s library, it just earns nothing. Only call ' +
        'this when the parent clearly rejects ONE SPECIFIC drawing from the pending drawings list.',
      parameters: {
        type: 'OBJECT',
        properties: {
          painting_id: { type: 'STRING', description: 'The exact id of the drawing to reject, taken from the pending drawings list in context.' },
        },
        required: ['painting_id'],
      },
    },
    {
      name: 'add_card',
      description:
        'Add a new permanent contribution card for a child, so it shows up as a tappable suggestion in their ' +
        'diary going forward (e.g. parent says "Ada\'nın kartlarına \'köpeği gezdirdim\' ekle"). Only call this ' +
        'when the parent clearly asks to add a new card/option for a child — not for logging a one-off ' +
        'contribution. Pick the child_id from the children list in context; if the parent has only one child and ' +
        'doesn\'t name them, use that child. If there are multiple children and it is unclear which one the ' +
        'parent means, do NOT call this — ask which child first.\n' +
        'Decide the category yourself from the label\'s meaning — do NOT ask the parent which category to use, ' +
        'even if you have to guess. Only ask the parent something (and skip calling this tool) if the action ' +
        'itself is genuinely ambiguous (e.g. you can\'t tell what they even mean). "household" is a last-resort ' +
        'fallback for when the action truly fits none of the others — never ask the parent to pick a category.\n' +
        'Keep the label to the bare action only — strip out frequency/schedule words the parent adds ("her gün", ' +
        '"sabah akşam", "günde iki kez", "every day", "twice a day"). E.g. parent says "bulaşıkları yıka her ' +
        'akşam ekle" → label should be just "bulaşıkları yıka" (do the dishes), not the schedule part. There is ' +
        'no recurrence/frequency system yet, so that information is simply dropped — the card itself stays a ' +
        'single short action. This stripping rule applies ONLY to the label you pass into THIS tool call — never ' +
        'apply it when reading back or listing existing pending contributions elsewhere.',
      parameters: {
        type: 'OBJECT',
        properties: {
          child_id: { type: 'STRING', description: 'The exact id of the child this card belongs to, taken from the children list in context.' },
          label: { type: 'STRING', description: 'The bare action only, in the parent\'s words, with any frequency/schedule phrasing removed (e.g. "I walked the dog", not "I walked the dog every morning").' },
          category: { type: 'STRING', description: 'One of: self_care, household, family, outside. Chosen by you from the label\'s meaning — never ask the parent for this.' },
        },
        required: ['child_id', 'label', 'category'],
      },
    },
    {
      name: 'approve_submission',
      description:
        'Approve ONE SPECIFIC pending submission (a homework the child photographed), by its exact id ' +
        'from the "pending submissions" list in context. Call this when the parent clearly approves it in free ' +
        'text ("onayla", "evet", "tamam 25 gem", "harika, onaylıyorum"). ' +
        'gems is OPTIONAL: pass it ONLY if the parent named an amount ("25 gem yeter", "give 10"). If the parent ' +
        'just approves without a number, DO NOT pass gems — the server uses the configured reward. ' +
        'If MORE THAN ONE submission is pending and it is unclear which one the parent means, do NOT call this — ' +
        'ask which one first, in the parent\'s language. Never invent an id.',
      parameters: {
        type: 'OBJECT',
        properties: {
          submission_id: { type: 'STRING', description: 'The exact id of the submission to approve, taken from the pending submissions list in context.' },
          gems: { type: 'NUMBER', description: 'Optional gem amount, ONLY if the parent explicitly stated one. Omit otherwise.' },
          note: { type: 'STRING', description: 'Optional note from the parent to pass along to the child.' },
        },
        required: ['submission_id'],
      },
    },
    {
      name: 'send_submission_photos',
      description:
        'Send the parent the actual PHOTO(S) of a submission (homework) here in the chat, by its exact id ' +
        'from the "pending submissions" list. Call this whenever the parent asks to see the photos ' +
        '("görselleri var mı", "fotoğrafı gönder", "show me the photo", "can I see it"). The pending list tells you ' +
        'how many photos each submission has (photoCount) — if photoCount is 0 there is genuinely no photo, ' +
        'otherwise NEVER tell the parent there is no photo. If several submissions are pending and it is unclear ' +
        'which one they mean, ask first.',
      parameters: {
        type: 'OBJECT',
        properties: {
          submission_id: { type: 'STRING', description: 'The exact id of the submission whose photos to send, from the pending submissions list.' },
        },
        required: ['submission_id'],
      },
    },
    {
      name: 'reject_submission',
      description:
        'Reject a pending submission (homework) by its exact id from the "pending submissions" list, when ' +
        'the parent clearly declines it ("hayır", "eksik kalmış", "olmamış, tekrar yapsın"). No gems are awarded. ' +
        'If more than one submission is pending and it is unclear which one the parent means, do NOT call this — ' +
        'ask which one first, in the parent\'s language.',
      parameters: {
        type: 'OBJECT',
        properties: {
          submission_id: { type: 'STRING', description: 'The exact id of the submission to reject, taken from the pending submissions list in context.' },
          note: { type: 'STRING', description: 'Optional note from the parent to pass along to the child.' },
        },
        required: ['submission_id'],
      },
    },
    {
      name: 'approve_reward_claim',
      description:
        'Approve ONE SPECIFIC pending reward claim (the child tapped "Claim" on a goal like "TV 1 hour" or ' +
        '"New toy"), by its exact id from the "onay bekleyen ödül talepleri" list in context. Call this when ' +
        'the parent clearly approves it in free text ("onayla", "evet", "verebilirsin"). This is NOT gift_gems — ' +
        'gift_gems adds gems with no pending item; this SPENDS gems from an existing claim. Never call this for ' +
        'a vague or unrelated message, only a clear approval of the named reward. If more than one claim is ' +
        'pending and it is unclear which one the parent means, do NOT call this — ask which one first.',
      parameters: {
        type: 'OBJECT',
        properties: {
          claim_id: { type: 'STRING', description: 'The exact id of the reward claim to approve, taken from the pending reward claims list in context.' },
        },
        required: ['claim_id'],
      },
    },
    {
      name: 'reject_reward_claim',
      description:
        'Reject a pending reward claim. The gems were already deducted (escrow) when the child tapped Claim — ' +
        'rejecting REFUNDS them back to the child\'s balance, they can claim again later. Only call this when ' +
        'the parent clearly declines ONE SPECIFIC claim from the pending list.',
      parameters: {
        type: 'OBJECT',
        properties: {
          claim_id: { type: 'STRING', description: 'The exact id of the reward claim to reject, taken from the pending reward claims list in context.' },
        },
        required: ['claim_id'],
      },
    },
    {
      name: 'gift_gems',
      description:
        'The parent wants to give a child gems with no task or approval attached — a surprise, a birthday, ' +
        '"just because" ("Ada\'ya 50 gem hediye et", "Osman\'a doğum günü için 100 gem ver", "Ada\'ya 20 gem ' +
        'ekle"). This is NOT a task reward and needs no pending item. Take child_id from the children list in ' +
        'context and amount as the exact number the parent said. The server enforces a 1-500 range — if the ' +
        'parent asks for more than 500, do NOT silently reduce it: tell them 500 is the most you can gift at ' +
        'once and ask if that works, rather than calling this with a different number than they asked for. ' +
        'Only call this when the parent explicitly asks to gift/give a specific amount of gems — never as a ' +
        'guess, an apology, or a way to smooth over confusion. If a message is vague, unrelated, or you are ' +
        'unsure what the parent means (e.g. "ne diyorsun", "anlamadım", "what?", any reaction that is not ' +
        'clearly a gifting request), do NOT call this — this moves real gems, so an unclear message means ' +
        'asking a clarifying question, not picking a number and gifting it.\n' +
        'If the parent\'s message already states WHY (a birthday, "just because", etc.), pass it as note and ' +
        'call this right away. If it does NOT, first ASK once whether they\'d like to add a short reason for ' +
        'the gem history (in their language — e.g. "İsterseniz kısa bir açıklama da ekleyebilirim, yoksa ' +
        'direkt gönderiyorum" / "Want me to add a short reason, or should I just send it?"), THEN call this ' +
        'once they reply — with their reason as note, or with no note if they say no/skip. Do not ask twice.',
      parameters: {
        type: 'OBJECT',
        properties: {
          child_id: { type: 'STRING', description: 'The exact id of the child to gift gems to, from the children list in context.' },
          amount: { type: 'NUMBER', description: 'The exact gem amount the parent asked for (whole number, 1-500).' },
          note: { type: 'STRING', description: 'Optional short reason for the gift, from the parent\'s own words (this message or their answer to your follow-up question) — shows in the child\'s gem history instead of a generic label. Omit if the parent gave none or declined.' },
        },
        required: ['child_id', 'amount'],
      },
    },
    {
      name: 'deduct_gems',
      description:
        'The opposite of gift_gems — the parent wants to REMOVE gems from a child\'s balance with no reward or ' +
        'claim attached: a correction, a penalty, "take away" ("Ada\'dan 20 gem sil", "Osman\'ın 10 gemini çıkar", ' +
        '"remove 15 gems from Ada", "Ada\'nın 5 gemini geri al"). Take child_id from the children list in context ' +
        'and amount as the exact number the parent said. The server enforces a 1-500 range AND refuses if the ' +
        'child does not currently have that many gems — do not silently reduce the amount, tell the parent if it ' +
        'fails and why. Only call this when the parent explicitly asks to remove/subtract/take away a specific ' +
        'amount — never as a guess, an apology, or a way to smooth over confusion (same rule as gift_gems: an ' +
        'unclear message means asking a clarifying question, not moving gems).\n' +
        'If the parent\'s message already states WHY (e.g. "oyuncak aldım", "toy purchase"), pass it as note and ' +
        'call this right away. If it does NOT, first ASK once whether they\'d like to add a short reason for the ' +
        'gem history (in their language — e.g. "İsterseniz kısa bir açıklama da ekleyebilirim, yoksa direkt ' +
        'yapıyorum" / "Want me to add a short reason, or should I just remove it?"), THEN call this once they ' +
        'reply — with their reason as note, or with no note if they say no/skip. Do not ask twice.',
      parameters: {
        type: 'OBJECT',
        properties: {
          child_id: { type: 'STRING', description: 'The exact id of the child to deduct gems from, from the children list in context.' },
          amount: { type: 'NUMBER', description: 'The exact gem amount to remove, as the parent said (whole number, 1-500).' },
          note: { type: 'STRING', description: 'Optional short reason, from the parent\'s own words (this message or their answer to your follow-up question) — shows in the child\'s gem history instead of a generic label. Omit if the parent gave none or declined; never invent one.' },
        },
        required: ['child_id', 'amount'],
      },
    },
    {
      name: 'update_task_reward',
      description:
        'Changes how many gems a TASK TYPE pays out going forward — completely different from gift_gems/' +
        'deduct_gems, which move gems right now. This changes the future rate ("matematiğe 40 gem verelim", ' +
        '"kitap okumayı 20 yap", "set homework to 15 gems"). The CURRENT rate for each ' +
        'type is already in context under each child\'s taskRewards — use it to answer "kaç gem veriyoruz" ' +
        'questions directly, with NO tool call, and to confirm the new number after a change.\n' +
        'Map the parent\'s words to exactly one of these task_type keys: "matematik"/"math" → math, "kitap"/' +
        '"okuma"/"books"/"reading" → reading, "hikaye"/"yazı"/"stories"/"writing" → writing, "ödev"/"homework" ' +
        '→ homework, "çizim"/"resim"/"drawing" → drawing. If you cannot tell which task type they mean, ASK — ' +
        'do not guess between two.\n' +
        'The server enforces a 1-500 range. Only call this when the parent explicitly states a task type AND a ' +
        'specific new number — an unclear or partial request ("matematiği artıralım biraz") means asking for the ' +
        'exact number, never picking one yourself.',
      parameters: {
        type: 'OBJECT',
        properties: {
          child_id: { type: 'STRING', description: 'The exact id of the child whose task reward to change, from the children list in context.' },
          task_type: { type: 'STRING', description: 'One of: reading, math, writing, homework, drawing.' },
          gems: { type: 'NUMBER', description: 'The exact new gem amount the parent said (whole number, 1-500).' },
        },
        required: ['child_id', 'task_type', 'gems'],
      },
    },
    {
      name: 'set_math_focus',
      description:
        'Weights one maths curriculum topic in the child\'s next sessions, because the parent said they are ' +
        'struggling with it ("Ada kesirlerde zorlanıyor, kesirlere ağırlık verelim", "çarpma çıksın biraz daha", ' +
        '"focus on fractions"). It does NOT change the difficulty level and does NOT remove other topics — the ' +
        'child still sees the rest of the year, that topic just comes up about three times as often.\n' +
        'The topic must be one the child actually studies: the exact topic_id values are in that child\'s ' +
        'mathTopics in context. Match the parent\'s words to one of THOSE ids — never invent an id and never ' +
        'pick a topic from another year. If their words fit none of them, or fit two, ASK which they mean and ' +
        'list the topic names you have; do not guess.\n' +
        'Say plainly that it lasts until the child gets on top of it — it clears itself once that topic passes ' +
        '80% over its last 12 questions, and you will tell them when it does. To stop early, call this with ' +
        'topic_id set to "none".',
      parameters: {
        type: 'OBJECT',
        properties: {
          child_id: { type: 'STRING', description: 'The exact id of the child, from the children list in context.' },
          topic_id: { type: 'STRING', description: 'A topic_id copied exactly from that child\'s mathTopics in context, or "none" to stop weighting.' },
        },
        required: ['child_id', 'topic_id'],
      },
    },
  ],
}]

// Weight a curriculum topic for a child. The model picks WHICH topic; everything else is
// decided here — that the child belongs to this parent, that the topic is one they actually
// study, and that a topic already mastered is refused rather than quietly set and instantly
// cleared on the next session.
async function setMathFocusTool(childId, topicId, parentId) {
  const { data: child } = await supabase
    .from('children').select('id, name, parent_id, age').eq('id', childId).maybeSingle()
  if (!child) return { success: false, error: 'child not found' }
  if (child.parent_id !== parentId) return { success: false, error: 'not your child' }

  if (!topicId || topicId === 'none') {
    const { error } = await supabase.from('children').update({ math_focus: null }).eq('id', childId)
    if (error) return { success: false, error: error.message }
    return { success: true, cleared: true, child: child.name }
  }

  // The id is checked against the topics this child has actually been asked, not against a
  // copy of the curriculum kept here. The curriculum lives in the frontend and the two deploy
  // separately, so a second copy would drift — and it is unnecessary: a session covers every
  // topic of the child's year, so one sitting is enough for all of them to be known. A topic
  // the child has never met cannot be weighted, which is the right answer anyway.
  const standing = await topicStanding(childId)
  if (!standing?.length) {
    return { success: false, error: 'no maths answered yet', child: child.name,
             detail: `${child.name} has not done a maths session yet, so there are no topics to weight` }
  }
  const topic = standing.find(x => x.topic_id === topicId)
  if (!topic) {
    return { success: false, error: `"${topicId}" is not one of ${child.name}'s topics`,
             available: standing.map(x => ({ topic_id: x.topic_id, name: x.topic_name })) }
  }

  const t = topic
  if (t && t.attempts >= MASTERY_MIN_ATTEMPTS && t.accuracy >= MASTERY_CLEARS_AT) {
    return { success: false, already_mastered: true, child: child.name, topic_name: topic.topic_name,
             accuracy: t.accuracy, attempts: t.attempts }
  }

  const { error } = await supabase.from('children').update({
    math_focus: { topic_id: topicId, topic_name: topic.topic_name, set_at: new Date().toISOString(), source: 'parent' },
  }).eq('id', childId)
  if (error) return { success: false, error: error.message }
  return { success: true, child: child.name, topic_name: topic.topic_name,
           clears_at: `${MASTERY_CLEARS_AT}% over the last ${MASTERY_WINDOW}` }
}

// Approve a pending homework submission from a parent's free-text reply.
// Every rule here is DETERMINISTIC — the LLM only picks the id and (maybe) an
// amount; code decides authorization, double-approval, the reward value, the
// clamp, and the single ledger write.
// Sends a held, refused image to the parent who asked for it. Everything is checked here:
// that the row is theirs, that it really is a blocked one, and that it still exists.
// Images the safety screen refused are kept a week so a parent who was told about one can
// look, and no longer — they were never wanted, only explainable.
async function purgeHeldImages() {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: stale } = await supabase.from('paintings')
    .select('id, photo_path').eq('status', 'blocked').lt('created_at', cutoff)
  for (const row of stale || []) {
    if (row.photo_path) {
      await supabase.storage.from(PAINTING_BUCKET).remove([row.photo_path]).then(() => {}, () => {})
      await supabase.storage.from(PHOTO_BUCKET).remove([row.photo_path]).then(() => {}, () => {})
    }
    await supabase.from('paintings').delete().eq('id', row.id)
  }
  if (stale?.length) console.log(`[PURGE] removed ${stale.length} held image(s) past 7 days`)
}

async function sendDrawingPhotoTool(paintingId, parentId) {
  const { data: row } = await supabase
    .from('paintings').select('id, child_id, photo_path, status').eq('id', paintingId).maybeSingle()
  if (!row) return { success: false, error: 'not found — held images are deleted after a week' }
  if (row.status !== 'blocked') return { success: false, error: 'that one was not blocked' }

  const { data: child } = await supabase
    .from('children').select('name, parent_id').eq('id', row.child_id).maybeSingle()
  if (!child || child.parent_id !== parentId) return { success: false, error: 'not your child' }

  // Held images come from two places and two buckets: a refused drawing lands in the paintings
  // bucket, a refused contribution photo in the shared one. The row does not say which, so
  // both are tried rather than adding a column for a week-long record.
  const url = await signedUrlFor(row.photo_path, 3600, PAINTING_BUCKET)
             || await signedUrlFor(row.photo_path, 3600, PHOTO_BUCKET)
  if (!url) return { success: false, error: 'image no longer available' }
  try {
    await sendNotificationWithPhoto(parentId,
      `${child.name} — bu görseli güvenlik taraması iletmemişti. / this is the image the safety screen held.`,
      url)
  } catch (err) {
    return { success: false, error: err.message }
  }
  return { success: true, child: child.name }
}

async function approveSubmissionTool(submissionId, parentId, gems) {
  const { data: sub } = await supabase
    .from('submissions')
    .select('id, child_id, task_type, status, suggested_gems')
    .eq('id', submissionId)
    .maybeSingle()
  if (!sub) return { success: false, error: 'submission not found' }

  // Rule 1 — authorization: the submission's child must belong to THIS parent.
  const { data: child } = await supabase
    .from('children')
    .select('id, name, parent_id, task_settings')
    .eq('id', sub.child_id)
    .maybeSingle()
  if (!child || child.parent_id !== parentId) {
    return { success: false, error: 'not authorized for this submission' }
  }

  // Rule 2 — no double approval.
  if (sub.status !== 'pending') {
    return { success: false, error: `already ${sub.status}` }
  }

  // Rules 3 & 4 — the reward value. Configured amount comes from the child's
  // task_settings[type].gems (server-side, never the client), homework
  // defaulting to HOMEWORK_DEFAULT_GEMS. If the parent named an amount, clamp
  // it to [0, configured * 2] so an LLM-relayed number can't blow up the ledger.
  const ts = child.task_settings || {}
  const configured = ts[sub.task_type]?.gems ?? (sub.task_type === 'homework' ? HOMEWORK_DEFAULT_GEMS : (sub.suggested_gems ?? HOMEWORK_DEFAULT_GEMS))

  let awarded
  if (gems === undefined || gems === null || Number.isNaN(Number(gems))) {
    awarded = configured
  } else {
    awarded = Math.max(0, Math.min(Number(gems), configured * 2))
  }
  awarded = Math.round(awarded)

  // Rule 5 — single ledger path, identical to the dashboard approve button:
  // flip status + write gems_earned, then one bt_ledger insert (reason=type).
  const { error: updErr } = await supabase
    .from('submissions')
    .update({ status: 'approved', gems_earned: awarded })
    .eq('id', sub.id)
    .eq('status', 'pending') // guard against a concurrent approval racing us
  if (updErr) return { success: false, error: updErr.message }

  if (awarded > 0) {
    const { error: ledErr } = await supabase
      .from('bt_ledger')
      .insert({ child_id: sub.child_id, amount: awarded, reason: sub.task_type || 'task' })
    if (ledErr) {
      console.error(`[SUBMISSION] ledger insert failed for ${sub.id}: ${ledErr.message}`)
      return { success: false, error: 'reward could not be recorded' }
    }
  }

  return { success: true, id: sub.id, childName: child.name, taskType: sub.task_type, gems: awarded }
}

// Re-sends a submission's photos into the chat on request. Ownership is checked
// in code — a parent can only ever pull their own child's photos.
async function sendSubmissionPhotosTool(submissionId, parentId) {
  const { data: sub } = await supabase
    .from('submissions')
    .select('id, child_id, task_type, photo_urls, media_url')
    .eq('id', submissionId)
    .maybeSingle()
  if (!sub) return { success: false, error: 'submission not found' }

  const { data: child } = await supabase
    .from('children').select('id, name, parent_id').eq('id', sub.child_id).maybeSingle()
  if (!child || child.parent_id !== parentId) {
    return { success: false, error: 'not authorized for this submission' }
  }

  const urls = sub.photo_urls?.length ? sub.photo_urls : (sub.media_url ? [sub.media_url] : [])
  if (!urls.length) return { success: false, error: 'this submission genuinely has no photo' }

  try {
    await sendNotificationWithPhotos(parentId, '', urls)
  } catch (err) {
    console.error(`[SUBMISSION] photo resend failed: ${err.message}`)
    return { success: false, error: 'could not send the photos right now' }
  }
  return { success: true, id: sub.id, childName: child.name, photoCount: urls.length, alreadySent: true }
}

async function rejectSubmissionTool(submissionId, parentId) {
  const { data: sub } = await supabase
    .from('submissions')
    .select('id, child_id, status')
    .eq('id', submissionId)
    .maybeSingle()
  if (!sub) return { success: false, error: 'submission not found' }

  const { data: child } = await supabase
    .from('children')
    .select('id, name, parent_id')
    .eq('id', sub.child_id)
    .maybeSingle()
  if (!child || child.parent_id !== parentId) {
    return { success: false, error: 'not authorized for this submission' }
  }
  if (sub.status !== 'pending') {
    return { success: false, error: `already ${sub.status}` }
  }

  const { error } = await supabase
    .from('submissions')
    .update({ status: 'rejected' })
    .eq('id', sub.id)
    .eq('status', 'pending')
  if (error) return { success: false, error: error.message }

  return { success: true, id: sub.id, childName: child.name }
}

// A gem grant with no task behind it — the parent's own call, no approval
// flow. Still server-authoritative on the two things that matter: the child
// really belongs to THIS parent (checked here, not just trusted from
// context, since this is also reachable from the dashboard with a bare
// parent JWT), and the amount is clamped server-side rather than trusting
// whatever the request — or the model — sends. Recorded as reason='bonus',
// which GemsScreen already renders as "Bonus Gift 🎁" to the child.
// note is optional and free-text (e.g. "Birthday") — used as the bt_ledger
// reason in place of the generic 'bonus' so it reads clearly in the child's
// gem history. Mirrors deductGemsTool's note handling exactly.
// A parent's note becomes the ledger reason, which is what the child reads in their gem
// history. Nothing checked it: a note went from a parent's message to a child's screen
// untouched. The model happened to refuse one that needed refusing, but a model's good
// judgement on the day is not a rule — this is.
//
// Refuses the whole action rather than quietly dropping the note, because a parent who wrote
// something unsuitable should be asked for another, not have a gift arrive stripped of the
// message they meant to send.
async function screenParentNote(note, childAge) {
  const text = typeof note === 'string' ? note.trim() : ''
  if (!text) return { ok: true, note: null }
  let screening
  try { screening = await screenChildInput(text, childAge ?? 7) } catch { return { ok: true, note: text } }
  if (screening?.appropriateness === 'inappropriate') {
    return { ok: false, reason: screening.reason || 'not suitable for a child to read' }
  }
  return { ok: true, note: text }
}

async function giftGemsTool(childId, amount, parentId, note) {
  const n = Math.round(Number(amount))
  if (!Number.isFinite(n) || n < 1 || n > 500) return { success: false, error: 'amount must be between 1 and 500' }

  const { data: child } = await supabase
    .from('children').select('id, name, parent_id, age').eq('id', childId).maybeSingle()
  if (!child) return { success: false, error: 'child not found' }
  if (child.parent_id !== parentId) return { success: false, error: 'forbidden' }

  const screened = await screenParentNote(note, child.age)
  if (!screened.ok) return { success: false, note_rejected: true, reason: screened.reason,
    hint: 'Tell the parent this note is not suitable for their child to read, and ask for a different one. Do NOT retry with the same note.' }
  const reason = screened.note ? screened.note.slice(0, 80) : 'bonus'
  const { error } = await supabase.from('bt_ledger').insert({ child_id: childId, amount: n, reason })
  if (error) return { success: false, error: error.message }

  return { success: true, childName: child.name, amount: n }
}

// note is optional and free-text (e.g. "Toy purchase") — used as the
// bt_ledger reason in place of the generic 'adjustment' so it reads clearly
// in the child's gem history, same pattern as a reward claim using the
// reward's own name instead of a category key.
async function deductGemsTool(childId, amount, parentId, note) {
  const n = Math.round(Number(amount))
  if (!Number.isFinite(n) || n < 1 || n > 500) return { success: false, error: 'amount must be between 1 and 500' }

  const { data: child } = await supabase
    .from('children').select('id, name, parent_id, age').eq('id', childId).maybeSingle()
  if (!child) return { success: false, error: 'child not found' }
  if (child.parent_id !== parentId) return { success: false, error: 'forbidden' }

  const { data: ledger } = await supabase.from('bt_ledger').select('amount').eq('child_id', childId)
  const gems = (ledger || []).reduce((sum, r) => sum + (r.amount || 0), 0)
  if (n > gems) return { success: false, error: 'insufficient gems', currentGems: gems }

  const screened = await screenParentNote(note, child.age)
  if (!screened.ok) return { success: false, note_rejected: true, reason: screened.reason,
    hint: 'Tell the parent this note is not suitable for their child to read, and ask for a different one. Do NOT retry with the same note.' }
  const reason = screened.note ? screened.note.slice(0, 80) : 'adjustment'
  const { error } = await supabase.from('bt_ledger').insert({ child_id: childId, amount: -n, reason })
  if (error) return { success: false, error: error.message }

  return { success: true, childName: child.name, amount: n, remainingGems: gems - n }
}

// Changes how many gems a task type pays out going forward — a DIFFERENT
// thing from gift_gems/deduct_gems (those move gems now; this changes the
// future rate). Merges into the existing task_settings JSONB rather than
// overwriting it, so other types' settings (and drawing's daily_cap) survive.
async function updateTaskRewardTool(childId, taskType, gems, parentId) {
  if (!Object.hasOwn(TASK_DEFAULT_GEMS, taskType)) return { success: false, error: `unknown task type ${taskType}` }
  const n = Math.round(Number(gems))
  if (!Number.isFinite(n) || n < 1 || n > 500) return { success: false, error: 'gems must be between 1 and 500' }

  const { data: child } = await supabase
    .from('children').select('id, name, parent_id, task_settings').eq('id', childId).maybeSingle()
  if (!child) return { success: false, error: 'child not found' }
  if (child.parent_id !== parentId) return { success: false, error: 'forbidden' }

  const nextSettings = { ...(child.task_settings || {}) }
  nextSettings[taskType] = { ...(nextSettings[taskType] || {}), active: nextSettings[taskType]?.active ?? true, gems: n }

  const { error } = await supabase.from('children').update({ task_settings: nextSettings }).eq('id', childId)
  if (error) return { success: false, error: error.message }

  return { success: true, childName: child.name, taskType, gems: n }
}

async function approveContributionTool(contributionId, parentId) {
  const { data: updated, error } = await supabase
    .from('contribution_log')
    .update({ status: 'approved', approved_at: DateTime.utc().toISO(), approved_by: parentId || null })
    .eq('id', contributionId)
    .select('id, label, child_id, status')
    .single()
  if (error || !updated) return { success: false, error: error?.message || 'contribution not found' }
  return { success: true, id: updated.id, label: updated.label, status: updated.status }
}

// Approves every pending contribution for a child in one deterministic
// update — no per-id copying by the LLM, so a long list can't partially
// fail from a mis-copied UUID the way repeated approve_contribution calls did.
async function approveAllPendingTool(childId, parentId) {
  const { data: child } = await supabase.from('children').select('id, name').eq('id', childId).maybeSingle()
  if (!child) return { success: false, error: 'child not found' }

  const { data: updated, error } = await supabase
    .from('contribution_log')
    .update({ status: 'approved', approved_at: DateTime.utc().toISO(), approved_by: parentId || null })
    .eq('child_id', childId)
    .eq('status', 'pending')
    .select('id, label')

  if (error) return { success: false, error: error.message }
  if (!updated?.length) return { success: false, error: `${child.name} has no contributions awaiting approval` }

  return {
    success: true,
    childId: child.id,
    childName: child.name,
    count: updated.length,
    labels: updated.map(u => u.label),
    approvedIds: updated.map(u => u.id),
  }
}

async function rejectContributionTool(contributionId) {
  const { data: updated, error } = await supabase
    .from('contribution_log')
    .update({ status: 'rejected' })
    .eq('id', contributionId)
    .select('id, label, child_id, status')
    .single()
  if (error || !updated) return { success: false, error: error?.message || 'contribution not found' }
  return { success: true, id: updated.id, label: updated.label, status: updated.status }
}

const CARD_CATEGORY_THEME = {
  self_care: { icon: '🛏️', color: '#5aa9e6' },
  household: { icon: '🍽️', color: '#e89a39' },
  family:    { icon: '🤝', color: '#ef7d9d' },
  outside:   { icon: '🌿', color: '#54b487' },
}

async function addCardTool(childId, label, category) {
  const trimmedLabel = (label || '').trim()
  if (!trimmedLabel) return { success: false, error: 'label required' }

  const { data: child } = await supabase.from('children').select('id').eq('id', childId).maybeSingle()
  if (!child) return { success: false, error: 'child not found' }

  const resolvedCategory = Object.keys(CARD_CATEGORY_THEME).includes(category) ? category : 'household'
  const theme = CARD_CATEGORY_THEME[resolvedCategory]

  const { data: maxRow } = await supabase
    .from('contribution_cards')
    .select('sort_order')
    .eq('child_id', childId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextSortOrder = (maxRow?.sort_order ?? -1) + 1

  const { data: inserted, error } = await supabase
    .from('contribution_cards')
    .insert({
      child_id: childId,
      label: trimmedLabel,
      category: resolvedCategory,
      icon: theme.icon,
      color: theme.color,
      sort_order: nextSortOrder,
      active: true,
    })
    .select('id, label, category')
    .single()
  if (error || !inserted) return { success: false, error: error?.message || 'insert failed' }
  return { success: true, id: inserted.id, label: inserted.label, category: inserted.category }
}

async function fetchConversationHistory(parentId) {
  try {
    const since = DateTime.utc().minus({ hours: 48 }).toISO()
    const { data: recent } = await supabase
      .from('messages')
      .select('role, content, created_at')
      .eq('parent_id', parentId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })

    let rows = recent || []
    if (rows.length < 10) {
      const { data: lastTen } = await supabase
        .from('messages')
        .select('role, content, created_at')
        .eq('parent_id', parentId)
        .order('created_at', { ascending: false })
        .limit(10)
      rows = lastTen || []
    }

    return rows
      .slice()
      .reverse()
      .map(m => ({ role: m.role === 'tuto' ? 'model' : 'user', parts: [{ text: m.content }] }))
  } catch (err) {
    console.error(`[MSG] history fetch failed: ${err.message}`)
    return []
  }
}

async function logMessage(parentId, role, content) {
  try {
    await supabase.from('messages').insert({ parent_id: parentId, role, content })
  } catch (err) {
    console.error(`[MSG] log failed (role=${role}): ${err.message}`)
  }
}

async function handleMessage(parentId, replyCb, text) {
  console.log(`[MSG] parent=${parentId} → "${text}"`)
  // Declared here (not inside try) so the catch block can still send a
  // localized fallback reply if we made it far enough to know the parent's
  // language before something failed.
  let language = 'tr'
  try {
    const historyContents = await fetchConversationHistory(parentId)
    await logMessage(parentId, 'parent', text)

    const [familyData, { data: parentRow }, { data: childrenRows }] = await Promise.all([
      getParentContext(parentId),
      supabase.from('parents').select('timezone, prefs').eq('id', parentId).single(),
      supabase.from('children').select('id, name').eq('parent_id', parentId),
    ])
    language = parentRow?.prefs?.language === 'en' ? 'en' : 'tr'
    const tz = parentRow?.timezone || 'UTC'
    const userNow = DateTime.now().setZone(tz)
    const localTimeStr = `${userNow.toFormat('yyyy-MM-dd HH:mm')} (${tz})`

    const children = childrenRows || []
    const childrenBlock =
      `AİLENİN ÇOCUKLARI (add_card için child_id'yi buradan al):\n` +
      (children.length
        ? children.map(c => `- id=${c.id}: ${c.name}`).join('\n')
        : 'Kayıtlı çocuk yok.')

    const pendingList = familyData.flatMap(c =>
      Array.isArray(c.pendingContributions)
        ? c.pendingContributions.map(p => ({ id: p.id, label: p.label, category: p.category, child: c.name }))
        : []
    )
    // If the pending read failed for any child, the list above is NOT "empty" —
    // it's unknown. Must not let the deterministic block claim "nothing pending"
    // in that case, since that's a false negative the parent could act on.
    const pendingCheckFailed = familyData.some(c => c.pendingCheckFailed)

    // Pending homework submissions with ids — so a free-text "onayla"
    // can be routed to approve_submission for the right one.
    const nowLocalDate = userNow.toFormat('yyyy-MM-dd')
    const allSubsList = familyData.flatMap(c =>
      (c.pendingSubmissions || []).map(s => ({
        id: s.id,
        child: c.name,
        taskType: s.task_type,
        status: s.status,
        description: s.description,
        suggestedGems: s.suggested_gems,
        photoCount: s.photoCount,
        // photo_taken_at arrives from getParentContext already converted to the parent's local
        // time ("yyyy-MM-dd HH:mm"). Re-parsing it as UTC and shifting again would move the day
        // a second time and flip this flag either side of midnight — the date is simply read.
        stale: s.photo_taken_at ? String(s.photo_taken_at).slice(0, 10) !== nowLocalDate : false,
      }))
    )
    const pendingSubsList = allSubsList.filter(s => s.status !== 'blocked')
    // Images the safety screen withheld. NOT awaiting approval, but the parent
    // must be able to see them on request — the classifier can be wrong.
    const heldSubsList = allSubsList.filter(s => s.status === 'blocked')

    function buildSystemPrompt(currentPendingList, currentPendingSubs = pendingSubsList) {
      const pendingBlock = pendingCheckFailed
        ? `ŞU AN ONAY BEKLEYEN KATKILAR: bu bilgi şu anda okunamadı (geçici bir hata oluştu).\n` +
          `- Onay bekleyenler hakkında KESİN bir şey söyleme — ne "yok" de ne bir sayı ver. Parent'a şu anda ` +
          `kontrol edemediğini söyle, birazdan tekrar sormasını iste.`
        : `ŞU AN ONAY BEKLEYEN KATKILAR (toplam ${currentPendingList.length}):\n` +
          (currentPendingList.length
            ? currentPendingList.map(p => `- id=${p.id}: "${p.label}" — ${p.child} (${p.category})`).join('\n') +
              `\n- Bu ${currentPendingList.length} kaydın HEPSİNİ, olduğu gibi (etiketi kısaltmadan/değiştirmeden) ` +
              `say ve listele. "her gün", "hem sabah hem akşam" gibi zamanlama ifadeleri içeren bir etiket görürsen ` +
              `bile bunu atlama/kısaltma — o temizleme kuralı SADECE add_card aracını çağırırken yeni bir kart ` +
              `etiketi üretmek için geçerlidir, bu listeyi okuyup söylerken hiçbir şekilde uygulanmaz.`
            : 'Şu anda onay bekleyen katkı yok.')

      const subsBlock =
        `ŞU AN ONAY BEKLEYEN GÖNDERİLER (ödev/ev görevi fotoğrafı, toplam ${currentPendingSubs.length}):\n` +
        (currentPendingSubs.length
          ? currentPendingSubs.map(s => {
              const kind = s.taskType === 'homework' ? 'ödev' : s.taskType
              const gemHint = s.suggestedGems != null ? `, önerilen ödül ${s.suggestedGems} gem` : ''
              const staleHint = s.stale ? ', (fotoğraf bugün çekilmemiş görünüyor)' : ''
              const photoHint = s.photoCount > 0 ? `, ${s.photoCount} fotoğraf var` : ', fotoğrafı yok'
              return `- id=${s.id}: ${kind} — ${s.child}: "${s.description}"${gemHint}${photoHint}${staleHint}`
            }).join('\n') +
            `\n- Ebeveyn bunlardan birini onaylarsa approve_submission'ı, reddederse reject_submission'ı ` +
            `yukarıdaki EXACT id ile çağır. Ebeveyn bir gem sayısı söylediyse (örn. "25 gem yeter") onu gems ` +
            `parametresine geçir; söylemediyse gems'i BOŞ bırak (sunucu ayarlı ödülü kullanır). Birden fazla ` +
            `bekleyen gönderi varsa ve hangisi olduğu belirsizse, tahmin etme — ebeveynin diliyle hangisi diye sor.\n` +
            `- Her gönderinin kaç fotoğrafı olduğu yukarıda yazıyor. Ebeveyn görselleri sorarsa ("görseli var mı", ` +
            `"fotoğrafı gönder") send_submission_photos'u o id ile çağır. Bir gönderi için "fotoğrafı yok" ` +
            `yazmıyorsa ASLA "görsel bulunmuyor / fotoğrafsız kaydedilmiş" deme — fotoğraflar sistemde duruyor.`
          : 'Şu anda onay bekleyen gönderi yok.')

      const heldBlock = heldSubsList.length
        ? `\n\nGÜVENLİK TARAMASININ İLETMEDİĞİ GÖRSELLER (toplam ${heldSubsList.length}):\n` +
          heldSubsList.map(s => `- id=${s.id}: ${s.child}, ${s.photoCount} fotoğraf`).join('\n') +
          `\n- Bunlar otomatik iletilmedi ama SİLİNMEDİ; sistemde duruyor. Ebeveyn "ne göndermiş", "göster", ` +
          `"görebilir miyim" derse send_submission_photos'u bu id ile çağır ve göster. Ebeveyn çocuğun velisi; ` +
          `görme hakkı var ve tarama yanılmış olabilir — asla "gösteremem / elimde yok" deme.\n` +
          `- Bunlar onay bekleyen gönderi DEĞİL; onay listesinde sayma, approve_submission ile onaylamaya çalışma.`
        : ''

      return (
        `${childrenBlock}\n\n` +
        `${pendingBlock}\n\n` +
        `${subsBlock}${heldBlock}\n\n` +
        `ŞU AN ONAY BEKLEYEN ÇİZİMLER:\n` +
        (familyData.flatMap(c => (Array.isArray(c.pendingDrawings) ? c.pendingDrawings.map(d => ({ ...d, child: c.name })) : [])).length
          ? familyData.flatMap(c => (Array.isArray(c.pendingDrawings) ? c.pendingDrawings.map(d => ({ ...d, child: c.name })) : []))
              .map(d => `- id=${d.id}: ${d.child} — "${d.what}" çizimi`).join('\n') +
            `\n- Ebeveyn bunlardan birini onaylarsa approve_drawing'i, reddederse reject_drawing'i yukarıdaki ` +
            `EXACT id ile çağır. Çizim ödülünün miktarını SEN belirlemezsin — sunucu karar verir ve günlük bir ` +
            `üst sınır uygular; bu yüzden gems parametresi yok. Onay sonucunda dönen gem sayısını ebeveyne söyle. ` +
            `Sonuç capped=true dönerse, çizim onaylandı ama günlük çizim ödülü dolduğu için gem eklenmedi — ` +
            `bunu açıkça söyle, "gem kazandı" deme.`
          : 'Şu anda onay bekleyen çizim yok.') + `\n\n` +
        `ŞU AN ONAY BEKLEYEN ÖDÜL TALEPLERİ (çocuk "Claim" butonuna bastı, bir hedefi almak istiyor):\n` +
        (familyData.flatMap(c => (Array.isArray(c.pendingRewardClaims) ? c.pendingRewardClaims.map(r => ({ ...r, child: c.name })) : [])).length
          ? familyData.flatMap(c => (Array.isArray(c.pendingRewardClaims) ? c.pendingRewardClaims.map(r => ({ ...r, child: c.name })) : []))
              .map(r => `- id=${r.id}: ${r.child}, "${r.reward}" istiyor (${r.cost} gem)`).join('\n') +
            `\n- Bu, bir ÖDÜL TALEBİDİR — gift_gems ile HİÇBİR İLGİSİ YOK, karıştırma. Yukarıdaki "cost" kadar ` +
            `gem çocuğun hesabından çoktan düşüldü (çocuk "Claim"e bastığı an, escrow olarak) — onaylarsan bu ` +
            `düşüş kalıcı olur, reddedersen gem çocuğa GERİ İADE EDİLİR. Ebeveyn onaylarsa approve_reward_claim'i, ` +
            `reddederse reject_reward_claim'i yukarıdaki EXACT id ile çağır. Birden fazla talep varsa ve hangisi ` +
            `belirsizse, tahmin etme — sor.\n` +
            `- Parent'a gönderilen bildirim tam olarak şuydu: '{child}, "{ödül}" ödülünü almak istiyor ({gem} ` +
            `gem). Tuto uygulamasından onaylayabilirsin.' — parent bu bildirime "ne dedin/anlamadım" gibi ` +
            `belirsiz bir şeyle cevap verirse, YUKARIDAKİ listeden hangi talebe ait olduğunu bul ve AÇIKÇA ` +
            `açıkla (kim, hangi ödül, kaç gem, nasıl onaylanır) — asla gift_gems çağırma ya da uydurma bir ` +
            `"düzelttim, hediye gönderdim" cevabı verme.`
          : 'Şu anda onay bekleyen ödül talebi yok.') + `\n\n` +
        `- Yukarıdaki "onay bekleyen katkılar" listesinde bir veya daha fazla kayıt VARSA, asla "onay bekleyen ` +
        `bir şey yok" deme. Parent onay sorduğunda ya da "onayla" dediğinde, bu listeyi referans al. Liste boşsa, ` +
        `o zaman bekleyen olmadığını söyle.\n\n` +
        `- GENEL KURAL (her tool için geçerli, sadece gift_gems için değil): bir şeyi değiştirdiğini, ` +
        `kaydettiğini, güncellediğini, sildiğini, gönderdiğini ya da onayladığını SADECE bu turda gerçekten ` +
        `bir tool çağırdıysan ve sonucu success:true olarak döndüyse söyleyebilirsin. Parent bir şey yapmanı ` +
        `istediğinde ve elinde bunu yapacak bir tool YOKSA (yukarıdaki tool listesinde karşılığı yoksa), bunu ` +
        `ASLA yapmış gibi davranma, "güncelledim/kaydettim/hallettim" gibi bir cevap UYDURMA — parent'a bunu ` +
        `şu an sohbet üzerinden yapamadığını açıkça söyle. Uygulamada o işi yapan bir ekran OLDUĞUNU biliyorsan ` +
        `oraya yönlendir; bilmiyorsan bir ekran adı UYDURMA — "henüz yapılamıyor" de ve orada bırak. ` +
        `Ebeveyn "Ada kesirlerde zorlanıyor, kesirlere ağırlık verelim" dediğinde bunu doğru bir şekilde ` +
        `reddediyorsun, ama ardından "matematik ayarları ekranından konuları seçebilirsiniz" diyorsun ve ` +
        `öyle bir ekran yok: ayarlarda sadece hangi aktivitelerin açık olduğu ve kaç gem kazandırdığı var. ` +
        `Çalışma konusunu, odağını veya zorluğunu ebeveynin ayarlayabileceği bir yer HENÜZ YOK. Akışı ` +
        `bozmamak ya da kibar görünmek için sahte bir başarı mesajı vermek — para/gem/ayar etkilenmese bile — ` +
        `ebeveynin sana güvenini kalıcı olarak kırar; hiçbir zaman kabul edilebilir bir kısayol değildir.\n\n` +
        `- Parent'ın bir mesajı ("ne dedin", "anlamadım", "what?") ne anlama geldiğini genel olarak sorarsa, ` +
        `konuşma geçmişindeki SENİN bir önceki mesajını bul ve İÇERİĞİNİ açıkla/tekrarla — kendi geçmişindeki ` +
        `başka bir "kafa karıştırdım, düzelttim, hediye gönderdim" tarzı eski cevabını ASLA taklit etme veya ` +
        `tekrarlama; her belirsizlik anında gift_gems çağırmak ya da "düzelttim" demek bir alışkanlık değil, ` +
        `bir HATA — sadece parent açıkça ve net şekilde gem hediye etmek istediğinde gift_gems çağır.\n\n` +
        `You are Tuto, a warm AI learning assistant and trusted family companion.\n` +
        `Current local time for parent: ${localTimeStr}\n` +
        `You know this family's learning data:\n${JSON.stringify(familyData, null, 2)}\n\n` +
        `The tree ("ağaç"):\n` +
        `- Each child's "tree" field above is the WHOLE answer to any tree question. The tree is a kindness / ` +
        `good-deeds diary: every approved contribution grows one leaf, a day's tree is fully grown at ` +
        `leavesForAFullTreeToday leaves, and a new tree starts each day (treesThisMonth = days this month with ` +
        `at least one leaf).\n` +
        `- The tree has NOTHING to do with gems, math level, stories or books. When the parent asks about the ` +
        `tree, answer ONLY from the tree field — never substitute gem totals, math level or story counts, and ` +
        `never present those as "how the tree is doing". Those are separate subjects; mention them only if the ` +
        `parent asks about them.\n` +
        `- Be concrete: say how many leaves today (out of leavesForAFullTreeToday), how many trees this month ` +
        `out of daysElapsedThisMonth days, and name a couple of actual deeds from recentLeaves. That is what ` +
        `makes it clear you are looking at the real tree.\n` +
        `- If the tree field is a text message instead of an object, it means the read failed — say you couldn't ` +
        `check the tree right now, do NOT invent a state.\n` +
        `- Pending contributions are NOT leaves yet; they grow a leaf only when approved.\n\n` +
        `Tool usage rules:\n` +
        `- Use the exact "id" from the pending contributions list above when calling approve_contribution or ` +
        `reject_contribution.\n` +
        `- Use the exact "id" from the children list above when calling add_card or approve_all_pending.\n` +
        `- Approving a CONTRIBUTION (a diary / contribution_log entry) does NOT award gems. Gems for contributions ` +
        `are tallied separately in the end-of-month review; approving one simply adds a leaf to the child's tree. ` +
        `For a CONTRIBUTION approval, never say the child "earned gems" — talk about a leaf added to their tree.\n` +
        `- A SUBMISSION approval is the OPPOSITE: approve_submission (a homework) awards gems IMMEDIATELY. ` +
        `When it succeeds, its result gives you the exact gem amount — tell the parent how many gems the child ` +
        `earned. Do NOT use tree/leaf language for a submission; that framing is only for contributions.\n` +
        `- If the parent wants ALL of a child's pending contributions approved at once ("hepsini onayla", ` +
        `"approve all", "ikisini de onayla"), call approve_all_pending ONCE with that child's id — never call ` +
        `approve_contribution multiple times to cover a bulk request.\n` +
        `- Only call approve_contribution or reject_contribution when the parent clearly states approve/reject ` +
        `intent for ONE SPECIFIC contribution (not a bulk "all" request).\n` +
        `- If more than one contribution is pending, the parent isn't asking to approve all of them, and it is ` +
        `unclear which one they mean, do NOT call a tool — ask which one they mean first, in the same language ` +
        `as the parent's message.\n` +
        `- For add_card: if the parent doesn't name a child and there is only one child, use that child. If ` +
        `there are multiple children and it's unclear which one they mean, do NOT call add_card — ask which ` +
        `child first, in the same language as the parent's message.\n` +
        `- For add_card: pick the category yourself, silently — never ask the parent which category to use. ` +
        `Only skip the tool call to ask a question if the action itself is unclear.\n` +
        `- For add_card: strip frequency/schedule wording from the label ("her gün", "sabah akşam", ` +
        `"günde iki kez", "every day", "twice a day", etc.) — keep only the bare action. There is no ` +
        `recurrence system yet, so that part of what the parent said is simply dropped, not stored. This ` +
        `stripping is ONLY for the label argument you pass into add_card — never apply it when reading, ` +
        `listing, or counting existing pending contributions elsewhere in this prompt.\n\n` +
        `General guidelines:\n` +
        `- Respond in the SAME LANGUAGE as the parent's message\n` +
        `- Be conversational and warm, like a trusted friend who knows the kids\n` +
        `- Reference specific data when relevant (e.g. "Ada earned 30 gems yesterday!")\n` +
        `- Keep responses concise — max 3-4 sentences for simple questions\n\n` +
        `CRITICAL: Only report facts from the data provided.\n` +
        `If the data is empty or null, say so honestly.\n` +
        `NEVER invent or assume activity that is not in the data.\n` +
        `If a field is empty, say the child hasn't done that yet.`
      )
    }

    const systemPrompt = buildSystemPrompt(pendingList)
    const contents = [...historyContents, { role: 'user', parts: [{ text }] }]

    const firstData = await callGeminiWithRetry(() => fetchGeminiOnce({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      tools: CONTRIBUTION_TOOLS,
    }))
    const parts = firstData.candidates?.[0]?.content?.parts || []
    const fnCallParts = parts.filter(p => p.functionCall)

    if (fnCallParts.length === 0) {
      // Verified empirically: attaching `tools` measurably degrades plain-text
      // list reproduction — with the exact same data, Gemini reliably drops
      // one item from a 5-item pending list ~80% of the time when `tools` is
      // present, and 0% of the time with it omitted. Since no function was
      // actually called, re-ask without `tools` for the reply that's actually
      // sent to the parent, instead of trusting this call's own text.
      const firstCallText = textFromParts(parts)

      // A 200 response with no usable text (safety filter, truncation, an
      // empty "thinking" turn) is NOT a transport-level failure, so
      // callGeminiWithRetry's retry never kicks in for it — confirmed by
      // reproducing this exact scenario ("onaylayalim" against this same
      // pending state): the model answered sensibly both with and without
      // tools every time we asked, so a blank turn here is a one-off fluke,
      // not this input being unanswerable. One extra plain-call attempt on an
      // empty result is cheap and buys back most of those fluke cases before
      // the parent ever sees a dead-end reply.
      let reply = ''
      for (let attempt = 0; attempt < 2 && !reply; attempt++) {
        try {
          const plainData = await callGeminiWithRetry(() => fetchGeminiOnce({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents,
          }))
          const finishReason = plainData.candidates?.[0]?.finishReason
          reply = textFromParts(plainData.candidates?.[0]?.content?.parts)
          if (!reply) console.warn(`[MSG] plain-retry attempt ${attempt + 1} came back empty (finishReason=${finishReason}) for parent ${parentId}`)
        } catch (err) {
          console.warn(`[MSG] plain-retry attempt ${attempt + 1} threw: ${err.message}`)
        }
      }
      // Both plain attempts came back blank — fall back to the tools-attached
      // call's own text, and only then to a message that at least gives the
      // parent something to DO instead of a dead end.
      if (!reply) reply = firstCallText
      if (!reply) {
        reply = language === 'en'
          ? "Sorry, I couldn't quite catch that — could you try rephrasing, or use the app to approve directly?"
          : 'Üzgünüm, bunu tam anlayamadım — farklı bir şekilde söyler misin? Ya da uygulamadan doğrudan onaylayabilirsin.'
      }
      await logMessage(parentId, 'tuto', reply)
      await replyCb(reply)
      console.log(`[MSG] Reply sent to parent ${parentId}`)
      return
    }

    const toolResults = []
    for (const part of fnCallParts) {
      const { name, args } = part.functionCall
      let toolResult
      if (name === 'approve_contribution') {
        toolResult = await approveContributionTool(args.contribution_id, parentId)
      } else if (name === 'approve_all_pending') {
        toolResult = await approveAllPendingTool(args.child_id, parentId)
      } else if (name === 'reject_contribution') {
        toolResult = await rejectContributionTool(args.contribution_id)
      } else if (name === 'add_card') {
        toolResult = await addCardTool(args.child_id, args.label, args.category)
      } else if (name === 'approve_submission') {
        toolResult = await approveSubmissionTool(args.submission_id, parentId, args.gems)
      } else if (name === 'reject_submission') {
        toolResult = await rejectSubmissionTool(args.submission_id, parentId)
      } else if (name === 'send_submission_photos') {
        toolResult = await sendSubmissionPhotosTool(args.submission_id, parentId)
      } else if (name === 'approve_drawing') {
        toolResult = await approvePaintingById(args.painting_id, parentId)
      } else if (name === 'reject_drawing') {
        toolResult = await rejectPaintingById(args.painting_id, parentId)
      } else if (name === 'approve_reward_claim') {
        toolResult = await approveClaimById(args.claim_id, parentId)
      } else if (name === 'reject_reward_claim') {
        toolResult = await rejectClaimById(args.claim_id, parentId)
      } else if (name === 'gift_gems') {
        toolResult = await giftGemsTool(args.child_id, args.amount, parentId, args.note)
      } else if (name === 'deduct_gems') {
        toolResult = await deductGemsTool(args.child_id, args.amount, parentId, args.note)
      } else if (name === 'update_task_reward') {
        toolResult = await updateTaskRewardTool(args.child_id, args.task_type, args.gems, parentId)
      } else if (name === 'send_drawing_photo') {
        toolResult = await sendDrawingPhotoTool(args.painting_id, parentId)
      } else if (name === 'set_math_focus') {
        toolResult = await setMathFocusTool(args.child_id, args.topic_id, parentId)
      } else {
        toolResult = { success: false, error: `unknown tool ${name}` }
      }
      console.log(`[MSG] Tool "${name}"(${JSON.stringify(args)}) → ${JSON.stringify(toolResult)}`)
      toolResults.push({ name, contributionId: args.contribution_id, submissionId: args.submission_id, result: toolResult })
    }

    // Refresh the pending list so the second call doesn't contradict itself —
    // a just-approved/rejected contribution must no longer show as pending.
    // approve_all_pending has no single contributionId — it reports the whole
    // batch via result.approvedIds instead.
    const processedIds = new Set(
      toolResults.filter(t => t.result.success).flatMap(t => t.result.approvedIds ?? (t.contributionId ? [t.contributionId] : []))
    )
    const refreshedPendingList = pendingList.filter(p => !processedIds.has(p.id))
    // Same idea for submissions: an approved/rejected one must not still show
    // as pending in the second call's context.
    const processedSubIds = new Set(
      toolResults.filter(t => t.result.success && t.submissionId).map(t => t.submissionId)
    )
    const refreshedPendingSubs = pendingSubsList.filter(s => !processedSubIds.has(s.id))
    const refreshedSystemPrompt = buildSystemPrompt(refreshedPendingList, refreshedPendingSubs)

    const secondData = await callGeminiWithRetry(() => fetchGeminiOnce({
      system_instruction: { parts: [{ text: refreshedSystemPrompt }] },
      contents: [
        ...contents,
        // Echo the model's own content object verbatim — Gemini 3.x requires
        // each functionCall part's thoughtSignature to round-trip unchanged.
        // Rebuilding { functionCall: { name, args } } by hand (the old code)
        // drops it and gets a 400 "missing thought_signature". Only the
        // FIRST functionCall part carries a signature in a parallel call;
        // that's expected — pass the parts through as-is, don't invent one.
        firstData.candidates[0].content,
        // All functionResponses grouped into one user turn, same order as
        // the functionCall parts above — required order is FC1(+sig),FC2,...,FR1,FR2,...
        { role: 'user', parts: toolResults.map(t => ({ functionResponse: { name: t.name, response: t.result } })) },
      ],
      tools: CONTRIBUTION_TOOLS,
    }))
    const finalText = textFromParts(secondData.candidates?.[0]?.content?.parts) || 'Tamamlandı.'
    await logMessage(parentId, 'tuto', finalText)
    await replyCb(finalText)
    console.log(`[MSG] Reply sent to parent ${parentId}`)
  } catch (err) {
    console.error('[MSG] Message handling error:', err.message)
    // Every Gemini call above already retried transient failures — if we're
    // here, it's exhausted or something else broke. Either way the parent
    // must never get silence: send a fixed, human fallback without calling
    // Gemini again.
    try {
      await logMessage(parentId, 'tuto', GEMINI_FALLBACK_REPLY[language])
      await replyCb(GEMINI_FALLBACK_REPLY[language])
    } catch (replyErr) {
      console.error('[MSG] Fallback reply also failed:', replyErr.message)
    }
  }
}

function setupMessageListener() {
  setTelegramMessageHandler((parentId, chatId, text) => {
    // A real person reads the message and pauses before typing — so the
    // typing indicator itself is delayed ~1s, but that delay must not push
    // back when Gemini starts thinking. Fire-and-forget: the timeout and
    // handleMessage run in parallel, not sequentially.
    setTimeout(() => sendTelegramTyping(chatId).catch(() => {}), 800 + Math.random() * 700)
    return handleMessage(parentId, msg => sendTelegramMessage(chatId, msg), text)
  })
  console.log('Message listeners started (Telegram).')
}

const app = express()
app.set('trust proxy', 1) // Railway sits behind a proxy — needed so req.protocol reports https for Twilio signature validation
app.use(cors())
app.use(express.json({ limit: '15mb' }))
app.use(express.urlencoded({ extended: false })) // Twilio posts form-encoded webhooks

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

// Proxies Gemini calls from the frontend — GEMINI_API_KEY must never ship in
// the client bundle (it did before this, got scraped/flagged as leaked by
// Google, and both frontend and backend Gemini access broke as a result).
// Frontend still builds prompts and parses responses; this is a pure
// pass-through with the key attached server-side only.
// The Gemini key lives only here — but an unauthenticated relay is just as bad
// as a leaked key: anyone who finds this URL can burn the quota (the key was
// already flagged as leaked once). Children have no Supabase session, so the
// gate is: the caller must name a real child, and each child gets a budget.
const CHILD_LIMIT = 40          // calls per child
const IP_LIMIT = 120            // calls per IP (a family shares one)
const RATE_WINDOW_MS = 10 * 60 * 1000
const rateHits = new Map()      // key → timestamps[]
const knownChildren = new Map() // childId → expiry, so we don't hit the DB every call

function overLimit(key, limit) {
  const now = Date.now()
  const hits = (rateHits.get(key) || []).filter(t => now - t < RATE_WINDOW_MS)
  hits.push(now)
  rateHits.set(key, hits)
  return hits.length > limit
}

async function childExists(childId) {
  const cached = knownChildren.get(childId)
  if (cached && cached > Date.now()) return true
  const { data } = await supabase.from('children').select('id').eq('id', childId).maybeSingle()
  if (!data) return false
  knownChildren.set(childId, Date.now() + 30 * 60 * 1000)
  return true
}

// Both maps grow with traffic; drop stale entries so a long-running dyno
// doesn't leak memory.
setInterval(() => {
  const now = Date.now()
  for (const [k, hits] of rateHits) {
    const live = hits.filter(t => now - t < RATE_WINDOW_MS)
    if (live.length) rateHits.set(k, live); else rateHits.delete(k)
  }
  for (const [k, exp] of knownChildren) if (exp <= now) knownChildren.delete(k)
}, RATE_WINDOW_MS).unref()

app.post('/api/gemini/generate', async (req, res) => {
  try {
    const { parts, generationConfig, childId } = req.body
    if (!Array.isArray(parts) || parts.length === 0) {
      return res.status(400).json({ error: 'parts required' })
    }

    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!childId || !UUID.test(childId)) return res.status(401).json({ error: 'unauthorized' })

    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip
    if (overLimit(`ip:${ip}`, IP_LIMIT)) return res.status(429).json({ error: 'rate limited' })
    if (overLimit(`child:${childId}`, CHILD_LIMIT)) return res.status(429).json({ error: 'rate limited' })

    if (!(await childExists(childId))) return res.status(401).json({ error: 'unauthorized' })

    const geminiRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: generationConfig || { response_mime_type: 'application/json' },
      }),
    })
    const data = await geminiRes.json()
    if (!geminiRes.ok) return res.status(geminiRes.status).json(data)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// The PIN screen needs names and avatars to draw itself. It used to get select('*') — every
// column of every child to anyone who knew the family code, pin_hash included. A four-digit
// PIN whose hash is already in the browser is 10,000 offline guesses, and there is no counter
// that can sit in front of that. Only what the screen draws goes out now.
app.get('/api/family/:code/children', async (req, res) => {
  const code = req.params.code?.trim().toUpperCase()
  if (!code) return res.status(400).json({ error: 'code required' })
  const { data: parent } = await supabase.from('parents').select('id').eq('family_code', code).maybeSingle()
  if (!parent) return res.json({ children: [] })
  const { data: children } = await supabase.from('children')
    .select('id, name, age, avatar_url').eq('parent_id', parent.id)
  res.json({ children: children || [] })
})

// Wrong PINs, per family. In memory on purpose: a lockout is meant to stop someone poking at
// a keypad for a few minutes, and losing the count on a deploy costs nothing. What must NOT be
// lost is the parent being told, and that goes out as it happens.
const pinAttempts = new Map()   // family code → { fails, lockedUntil, notifiedAt }
const PIN_MAX_FAILS = 5
const PIN_LOCK_MS = 10 * 60 * 1000
const PIN_NOTIFY_GAP_MS = 30 * 60 * 1000

function hashPinServer(pin) {
  return crypto.createHash('sha256').update(String(pin)).digest('hex')
}

// Verification moved off the browser. The PIN travels over TLS to be compared here, so the
// hashes never leave the server and every guess has to come through this counter.
app.post('/api/family/:code/verify-pin', async (req, res) => {
  const code = req.params.code?.trim().toUpperCase()
  const pin = String(req.body?.pin ?? '').trim()
  if (!code || !/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'code and 4-digit pin required' })

  const now = Date.now()
  const state = pinAttempts.get(code) || { fails: 0, lockedUntil: 0, notifiedAt: 0 }
  if (state.lockedUntil > now) {
    return res.status(429).json({ error: 'locked', retry_in_seconds: Math.ceil((state.lockedUntil - now) / 1000) })
  }

  const { data: parent } = await supabase.from('parents').select('id').eq('family_code', code).maybeSingle()
  if (!parent) return res.status(404).json({ error: 'unknown family' })

  const { data: children } = await supabase.from('children')
    .select('id, name, age, pin_hash, language, task_settings').eq('parent_id', parent.id)
  const match = (children || []).find(c => c.pin_hash === hashPinServer(pin))

  if (!match) {
    state.fails += 1
    if (state.fails >= PIN_MAX_FAILS) {
      state.lockedUntil = now + PIN_LOCK_MS
      state.fails = 0
      // Rate-limited so a child who genuinely keeps forgetting does not spam their parent.
      if (now - state.notifiedAt > PIN_NOTIFY_GAP_MS) {
        state.notifiedAt = now
        const { data: p } = await supabase.from('parents').select('prefs').eq('id', parent.id).maybeSingle()
        const en = p?.prefs?.language === 'en'
        sendNotification(parent.id, en
          ? `${PIN_MAX_FAILS} wrong PIN attempts on your family's Tuto. It's locked for 10 minutes. If that wasn't one of your children, you can change their PIN in settings. 🔒`
          : `Tuto'da art arda ${PIN_MAX_FAILS} kez yanlış PIN girildi. 10 dakika kilitledim. Çocuklarınızdan biri değilse PIN'i ayarlardan değiştirebilirsiniz. 🔒`
        ).catch(() => {})
      }
      pinAttempts.set(code, state)
      return res.status(429).json({ error: 'locked', retry_in_seconds: Math.ceil(PIN_LOCK_MS / 1000) })
    }
    pinAttempts.set(code, state)
    return res.status(401).json({ error: 'wrong pin', attempts_left: PIN_MAX_FAILS - state.fails })
  }

  pinAttempts.delete(code)
  const { pin_hash, ...child } = match
  res.json({ child })
})

app.get('/api/children/:childId/rewards', async (req, res) => {
  const { childId } = req.params
  const { data: rewards } = await supabase.from('rewards').select('*').eq('child_id', childId).order('bt_cost')
  res.json({ rewards: rewards || [] })
})

// ── Reward claims ─────────────────────────────────────────────────────────────
// The child taps "Claim" on an affordable reward; the parent approves or
// rejects from the dashboard — same request-then-decide shape as homework.
// The key difference from that: approving a SUBMISSION awards gems,
// approving a CLAIM spends them (negative bt_ledger entry). Eligibility
// (gems >= bt_cost) is decided here, server-side, both at claim time and
// again at approval time — never trusted from the client's own gem count.
app.post('/api/children/:childId/reward-claims', async (req, res) => {
  const { childId } = req.params
  const { reward_id } = req.body
  if (!reward_id) return res.status(400).json({ error: 'reward_id required' })
  try {
    const [{ data: reward }, { data: ledger }, { data: existing }] = await Promise.all([
      supabase.from('rewards').select('id, name, icon, bt_cost, child_id').eq('id', reward_id).maybeSingle(),
      supabase.from('bt_ledger').select('amount').eq('child_id', childId),
      supabase.from('reward_claims').select('*').eq('child_id', childId).eq('reward_id', reward_id).eq('status', 'pending').maybeSingle(),
    ])
    if (!reward || reward.child_id !== childId) return res.status(404).json({ error: 'reward not found' })
    if (existing) return res.json({ claim: existing }) // idempotent — already awaiting a decision

    const gems = (ledger || []).reduce((sum, r) => sum + (r.amount || 0), 0)
    if (gems < reward.bt_cost) return res.status(400).json({ error: 'not enough gems' })

    const { data: claim, error } = await supabase
      .from('reward_claims')
      .insert({ child_id: childId, reward_id: reward.id, reward_name: reward.name, reward_icon: reward.icon, bt_cost: reward.bt_cost })
      .select().single()
    if (error) return res.status(500).json({ error: error.message })

    // Escrow model: the spend is recorded NOW, at claim time, not at approval —
    // so a child can't rack up several "affordable-looking" pending claims that
    // together add up to more gems than they actually have (the balance the
    // rest of the app reads is just the ledger sum; deducting here makes it
    // reflect commitment immediately, the same way it already does for every
    // other gem movement in this file). Rejection reverses this exact entry.
    const { error: ledErr } = await supabase
      .from('bt_ledger')
      .insert({ child_id: childId, amount: -reward.bt_cost, reason: reward.name })
    if (ledErr) {
      console.error(`[REWARD-CLAIM] escrow ledger insert failed for ${claim.id}: ${ledErr.message}`)
      await supabase.from('reward_claims').delete().eq('id', claim.id)
      return res.status(500).json({ error: 'could not record the spend' })
    }

    const { data: child } = await supabase.from('children').select('name, parent_id').eq('id', childId).maybeSingle()
    if (child?.parent_id) {
      // Parent's own language preference, not the child's — every other
      // notification in this file reads it the same way (parents.prefs.language,
      // defaulting to 'tr'). child.language is a different, unrelated field
      // (every child gets 'en' there with no way to change it — using it here
      // sent this exact message in English to a parent who only reads Turkish).
      const { data: parentRow } = await supabase.from('parents').select('prefs').eq('id', child.parent_id).maybeSingle()
      const language = parentRow?.prefs?.language === 'en' ? 'en' : 'tr'
      const msg = language === 'en'
        ? `${child.name} wants to claim "${reward.name}" (${reward.bt_cost} gems). Approve it from the Tuto app.`
        : `${child.name}, "${reward.name}" ödülünü almak istiyor (${reward.bt_cost} gem). Tuto uygulamasından onaylayabilirsin.`
      sendNotification(child.parent_id, msg).catch(() => {})
    }

    res.json({ claim })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/children/:childId/reward-claims', async (req, res) => {
  const { childId } = req.params
  const { data } = await supabase.from('reward_claims').select('*').eq('child_id', childId).order('created_at', { ascending: false })
  res.json({ claims: data || [] })
})

// Escrow model: the spend was already recorded in bt_ledger when the claim
// was created, so approval is just a status flip — no gems move here.
async function approveClaimById(claimId, parentId) {
  const { data: claim } = await supabase.from('reward_claims').select('*').eq('id', claimId).maybeSingle()
  if (!claim) return { success: false, error: 'not found' }
  if (claim.status !== 'pending') return { success: false, error: `already ${claim.status}` }

  const { data: child } = await supabase.from('children').select('id, name, parent_id').eq('id', claim.child_id).maybeSingle()
  if (!child || child.parent_id !== parentId) return { success: false, error: 'forbidden' }

  const { error: updErr } = await supabase
    .from('reward_claims')
    .update({ status: 'approved', resolved_at: new Date().toISOString() })
    .eq('id', claim.id)
    .eq('status', 'pending') // guard against a concurrent decision racing us
  if (updErr) return { success: false, error: updErr.message }

  return { success: true, id: claim.id, childName: child.name, gems: claim.bt_cost }
}

// Reverses the exact escrow deduction from claim time — the child gets the
// gems back, same reward name so it reads as a paired entry in their history.
async function rejectClaimById(claimId, parentId) {
  const { data: claim } = await supabase.from('reward_claims').select('*').eq('id', claimId).maybeSingle()
  if (!claim) return { success: false, error: 'not found' }
  if (claim.status !== 'pending') return { success: false, error: `already ${claim.status}` }

  const { data: child } = await supabase.from('children').select('id, name, parent_id').eq('id', claim.child_id).maybeSingle()
  if (!child || child.parent_id !== parentId) return { success: false, error: 'forbidden' }

  const { error: updErr } = await supabase
    .from('reward_claims')
    .update({ status: 'rejected', resolved_at: new Date().toISOString() })
    .eq('id', claim.id)
    .eq('status', 'pending')
  if (updErr) return { success: false, error: updErr.message }

  const { error: ledErr } = await supabase
    .from('bt_ledger')
    .insert({ child_id: child.id, amount: claim.bt_cost, reason: claim.reward_name })
  if (ledErr) {
    console.error(`[REWARD-CLAIM] refund ledger insert failed for ${claim.id}: ${ledErr.message}`)
    await supabase.from('reward_claims').update({ status: 'pending', resolved_at: null }).eq('id', claim.id)
    return { success: false, error: 'could not record the refund' }
  }

  return { success: true, id: claim.id, childName: child.name, gems: claim.bt_cost }
}

async function claimActionRoute(req, res, action) {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
    if (!token) return res.status(401).json({ error: 'unauthorized' })
    const { data: userData, error: authErr } = await supabase.auth.getUser(token)
    const userId = userData?.user?.id
    if (authErr || !userId) return res.status(401).json({ error: 'unauthorized' })

    const result = await action(req.params.id, userId)
    if (!result.success) {
      const code = result.error === 'forbidden' ? 403 : result.error === 'not found' ? 404 : 400
      return res.status(code).json({ error: result.error })
    }
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

app.post('/api/reward-claims/:id/approve', (req, res) => claimActionRoute(req, res, approveClaimById))
app.post('/api/reward-claims/:id/reject', (req, res) => claimActionRoute(req, res, rejectClaimById))

app.get('/api/children/:childId/gems', async (req, res) => {
  const { childId } = req.params
  const { data: ledger } = await supabase.from('bt_ledger').select('amount').eq('child_id', childId)
  const gems = (ledger || []).reduce((sum, r) => sum + (r.amount || 0), 0)
  res.json({ gems })
})

// ChildHome's "Bugün" card — one round trip instead of the 6-7 separate
// queries this would otherwise take client-side (tree, 5 activity types
// across 3 different tables, gems, nearest goal). Activity counts come from
// each type's own real table/task_type, never approximated from bt_ledger
// (its `reason` column is inconsistent — e.g. reading writes the book title,
// not 'reading' — so it can't be used to detect "did X happen today").
app.get('/api/children/:childId/today-summary', async (req, res) => {
  const { childId } = req.params
  try {
    const tz = await tzForChild(childId)
    const now = DateTime.now().setZone(tz)
    const todayStart = now.startOf('day').toUTC().toISO()
    const todayEnd = now.endOf('day').toUTC().toISO()

    const [
      tree,
      { data: subsToday },
      { data: mathToday },
      { data: storiesToday },
      { data: paintingsToday },
      { data: ledger },
      { data: rewards },
    ] = await Promise.all([
      getTreeState(childId, tz),
      supabase.from('submissions').select('task_type').eq('child_id', childId).in('task_type', ['reading', 'homework']).gte('created_at', todayStart).lte('created_at', todayEnd),
      supabase.from('math_progress').select('id').eq('child_id', childId).gte('created_at', todayStart).lte('created_at', todayEnd),
      supabase.from('stories').select('id').eq('child_id', childId).gte('created_at', todayStart).lte('created_at', todayEnd),
      supabase.from('paintings').select('id').eq('child_id', childId).gte('created_at', todayStart).lte('created_at', todayEnd),
      supabase.from('bt_ledger').select('amount').eq('child_id', childId),
      supabase.from('rewards').select('id, name, icon, bt_cost').eq('child_id', childId).order('bt_cost'),
    ])

    const gems = (ledger || []).reduce((sum, r) => sum + (r.amount || 0), 0)
    const nearestGoal = (rewards || []).find(r => r.bt_cost > gems) || null

    res.json({
      today: tree.today,
      monthTreeCount: tree.monthTreeCount,
      activities: {
        reading: (subsToday || []).filter(s => s.task_type === 'reading').length,
        math: (mathToday || []).length,
        writing: (storiesToday || []).length,
        homework: (subsToday || []).filter(s => s.task_type === 'homework').length,
        drawing: (paintingsToday || []).length,
      },
      gems,
      nearestGoal: nearestGoal ? { id: nearestGoal.id, name: nearestGoal.name, icon: nearestGoal.icon, bt_cost: nearestGoal.bt_cost } : null,
      // Distinguishes "no rewards configured at all" from "gems already cover
      // every configured reward" — same nearestGoal:null, very different copy.
      hasAnyGoals: (rewards || []).length > 0,
    })
  } catch (err) {
    res.status(500).json({
      today: 0, monthTreeCount: 0,
      activities: { reading: 0, math: 0, writing: 0, homework: 0, drawing: 0 },
      gems: 0, nearestGoal: null, hasAnyGoals: false,
      error: err.message,
    })
  }
})

app.get('/api/children/:childId/story-ideas', async (req, res) => {
  try {
    const { childId } = req.params
    const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '')

    const { data: child } = await supabase.from('children').select('age').eq('id', childId).single()
    const age = child?.age || 7
    const band = age <= 7 ? '5-7' : age <= 10 ? '8-10' : '11+'

    const [{ data: pool }, { data: written }] = await Promise.all([
      supabase.from('story_ideas').select('emoji, title, topic, description').eq('age_band', band).eq('status', 'active').eq('scope', 'global'),
      supabase.from('stories').select('topic').eq('child_id', childId),
    ])

    const usedNorms = new Set((written || []).map(r => norm(r.topic)))
    const fresh = (pool || []).filter(r => !usedNorms.has(norm(r.topic)))

    const shuffle = arr => arr.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(v => v[1])
    let ideas = shuffle(fresh).slice(0, 4)

    if (ideas.length < 4 && (pool || []).length > 0) {
      const used = new Set(ideas.map(r => norm(r.topic)))
      const extras = shuffle((pool || []).filter(r => !used.has(norm(r.topic))))
      ideas = [...ideas, ...extras].slice(0, 4)
    }

    res.json({ ideas })
  } catch {
    res.json({ ideas: [] })
  }
})

app.post('/api/screen-story-draft', async (req, res) => {
  // Fire-and-forget safety screen called right after OCR — never blocks the child's flow.
  try {
    const { child_id, transcribed_text } = req.body
    if (!child_id || !transcribed_text) return res.json({ ok: true })

    const { data: child } = await supabase
      .from('children').select('age, name, parent_id').eq('id', child_id).maybeSingle()
    if (!child) return res.json({ ok: true })

    let screening
    try {
      screening = await screenChildInput(transcribed_text, child.age)
    } catch {
      return res.json({ ok: true })
    }

    if (screening.concern_level === 'concerning' || screening.concern_level === 'serious') {
      try {
        await sendNotification(
          child.parent_id,
          `${child.name} bir şeyler yazıyor. Bir göz atmanda fayda olabilir.\n\n${transcribed_text}`
        )
      } catch (err) {
        console.error(`[SCREEN-DRAFT] notify failed: ${err.message}`)
      }
    }
  } catch (err) {
    console.error(`[SCREEN-DRAFT] unexpected error: ${err.message}`)
  }
  res.json({ ok: true })
})

app.get('/api/children/:childId/stories', async (req, res) => {
  const { childId } = req.params
  const { data: stories } = await supabase.from('stories').select('*').eq('child_id', childId).order('created_at', { ascending: false })
  res.json({ stories: stories || [] })
})

// What a story is worth. The model used to decide this — evaluateStory returned a gem figure
// and the client passed it straight through to the ledger — so the parent's configured amount
// was never consulted and the number moved with the model's mood. The model judges the writing
// now; the amount is worked out here.
const WRITING_DEFAULTS = { gems: 30, dailyCap: 3 }

// Words a child of each school year might reasonably write in one sitting. Not a target shown
// to anyone: it is the point where the effort multiplier reaches its ceiling.
const WORDS_FOR_YEAR = { year1: 20, year2: 35, year3: 50, year4: 70, year5: 90, year6: 110 }

function schoolYearForAge(age) {
  const n = Number(age) || 7
  if (n <= 6) return 'year1'
  if (n === 7) return 'year2'
  if (n === 8) return 'year3'
  if (n === 9) return 'year4'
  if (n === 10) return 'year5'
  return 'year6'
}

function countWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length
}

// Effort, as a multiplier between a floor and 1. Two honest sentences are still work and still
// earn — just not what a page earns. The floor is why: a child who writes little, or writes
// slowly, must not come away with nothing. And it is capped at the year's mark rather than
// climbing forever, because a reward that keeps rising with length teaches padding.
const EFFORT_FLOOR = 0.4
function effortScale(words, age) {
  const target = WORDS_FOR_YEAR[schoolYearForAge(age)] || 50
  return Math.min(1, EFFORT_FLOOR + (1 - EFFORT_FLOOR) * (words / target))
}

app.post('/api/children/:childId/stories', async (req, res) => {
  const { childId } = req.params
  const { storyId, title, topic, transcribed_text, corrected_text, status, quality, cover_url, cover_color } = req.body
  try {
    let story, prevStatus

    if (storyId) {
      // Fetch existing status before update (don't trust client on gem eligibility)
      const { data: existing } = await supabase.from('stories').select('status').eq('id', storyId).single()
      prevStatus = existing?.status
      // Only update fields that were explicitly provided
      const fields = {}
      if (title !== undefined) fields.title = title
      if (transcribed_text !== undefined) fields.transcribed_text = transcribed_text
      if (corrected_text !== undefined) fields.corrected_text = corrected_text
      if (status !== undefined) fields.status = status
      if (cover_url !== undefined) fields.cover_url = cover_url
      if (cover_color !== undefined) fields.cover_color = cover_color
      const { data: updated, error } = await supabase.from('stories')
        .update(fields)
        .eq('id', storyId)
        .select().single()
      if (error) return res.status(500).json({ error: error.message })
      story = updated
    } else {
      prevStatus = null
      const { data: inserted, error } = await supabase.from('stories')
        .insert({ child_id: childId, title, topic, transcribed_text, corrected_text, status, gems_earned: 0 })
        .select().single()
      if (error) return res.status(500).json({ error: error.message })
      story = inserted
    }

    // Gem awarded only on first-ever completion (prev was not completed)
    const firstCompletion = status === 'completed' && prevStatus !== 'completed'
    let gemsAwarded = 0
    let capped = false
    if (firstCompletion) {
      const { data: kid } = await supabase
        .from('children').select('age, task_settings').eq('id', childId).maybeSingle()
      const settings = taskSettingsFor(kid?.task_settings, 'writing', WRITING_DEFAULTS)
      const tz = await tzForChild(childId)
      const doneToday = await rewardedToday(childId, tz, 'story')

      // Words counted HERE, from the text already in the request — not taken from the client
      // and not from the model, both of which have been wrong about it.
      const words = countWords(corrected_text || transcribed_text || story.corrected_text || story.transcribed_text)
      const q = Math.max(0, Math.min(100, Number(quality) || 0))

      if (!settings.active || doneToday === null || doneToday >= settings.dailyCap) {
        capped = true
      } else {
        // Quality and effort multiply: a long story told poorly and a good story of two lines
        // both land in the middle, which is the honest place for each of them.
        gemsAwarded = Math.round(settings.gems * rewardScale(q) * effortScale(words, kid?.age))
      }
      if (gemsAwarded > 0) {
        await supabase.from('bt_ledger').insert({ child_id: childId, amount: gemsAwarded, reason: 'story' })
        await supabase.from('stories').update({ gems_earned: gemsAwarded }).eq('id', story.id)
      }
    }

    // Parent notification — insert only (no notification on edits/updates)
    if (!storyId) {
      try {
        const { data: child } = await supabase
          .from('children').select('name, parent_id').eq('id', childId).maybeSingle()
        if (child) {
          const storyText = corrected_text || transcribed_text || ''
          let screening
          try { screening = await screenChildInput(storyText, child.age ?? 7) } catch { /* skip */ }

          const cl = screening?.concern_level
          if (!screening) {
            // Screening failed — unknown safety status, stay calm (fail-closed)
            await sendNotification(
              child.parent_id,
              `${child.name} bir hikaye yazdı. Bir göz atmanda fayda olabilir.\n\n${title || 'Hikaye'}\n\n${storyText}`
            )
          } else if (cl === 'none' || cl === 'mild') {
            // Clean story — joyful share
            await sendNotification(
              child.parent_id,
              `${child.name} bir hikaye yazdı! 🌸\n\n${title || 'Hikaye'}\n\n${storyText}`
            )
          } else if (screening?.appropriateness === 'inappropriate') {
            // Inappropriate language — neutral share, no judgment
            await sendNotification(
              child.parent_id,
              `${child.name} bir hikaye yazdı, okumak istersin diye paylaşıyorum.\n\n${title || 'Hikaye'}\n\n${storyText}`
            )
          }
          // concerning/serious: silent — draft screen (Point 1) already notified
        }
      } catch (err) {
        console.error(`[STORIES] notification failed: ${err.message}`)
      }
    }

    res.json({ story, gems_awarded: gemsAwarded, capped })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/children/:childId/stories/:storyId', async (req, res) => {
  const { childId, storyId } = req.params
  const { error } = await supabase.from('stories').delete().eq('id', storyId).eq('child_id', childId)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

// Deletes a painting: removes the row and its photo from the private bucket
// (the client never had a read/write policy on that bucket anyway, so the
// service role is the only thing that CAN clean up the file). Deliberately
// does NOT touch bt_ledger — a gem the server already awarded on approval
// stays awarded; deleting the picture doesn't claw it back. Same reasoning
// as My Stories' delete (which never touches gems either), and avoids the
// "taking gems away" problem entirely rather than half-solving it.
app.delete('/api/children/:childId/paintings/:paintingId', async (req, res) => {
  const { childId, paintingId } = req.params
  try {
    const { data: painting } = await supabase
      .from('paintings').select('id, photo_path').eq('id', paintingId).eq('child_id', childId).maybeSingle()
    if (!painting) return res.status(404).json({ error: 'not found' })

    const { error } = await supabase.from('paintings').delete().eq('id', paintingId).eq('child_id', childId)
    if (error) return res.status(500).json({ error: error.message })

    if (painting.photo_path) {
      await supabase.storage.from(PAINTING_BUCKET).remove([painting.photo_path]).then(() => {}, () => {})
    }
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

const CONTRIBUTION_CATEGORIES = ['self_care', 'household', 'family', 'outside']

const DEFAULT_CONTRIBUTION_CARDS = [
  { category: 'self_care', label: 'I made my bed',     icon: '🛏️', color: '#5aa9e6', sort_order: 0 },
  { category: 'household', label: 'I set the table',    icon: '🍽️', color: '#e89a39', sort_order: 1 },
  { category: 'household', label: 'I helped tidy up',   icon: '🧹', color: '#e89a39', sort_order: 2 },
  { category: 'outside',   label: 'I helped outside',   icon: '🌿', color: '#54b487', sort_order: 3 },
]

app.get('/api/cards', async (req, res) => {
  try {
    const { child_id } = req.query
    if (!child_id) return res.status(400).json({ error: 'child_id required' })

    const { data: child } = await supabase.from('children').select('id').eq('id', child_id).maybeSingle()
    if (!child) return res.status(404).json({ error: 'child not found' })

    // photo_ok is newer than this endpoint. If the migration hasn't been run
    // yet, selecting it errors and would leave the child with NO cards at all,
    // so fall back to the older column set rather than breaking the screen.
    const CARD_COLS = 'id, label, category, icon, color'
    const fetchActiveCards = async () => {
      const q = cols => supabase
        .from('contribution_cards')
        .select(cols)
        .eq('child_id', child_id)
        .eq('active', true)
        .order('sort_order', { ascending: true })

      const withFlag = await q(`${CARD_COLS}, photo_ok`)
      if (!withFlag.error) return withFlag
      console.warn(`[CARDS] photo_ok unavailable (${withFlag.error.message}) — run the photo_ok migration`)
      return q(CARD_COLS)
    }

    let { data: cards } = await fetchActiveCards()

    if (!cards || cards.length === 0) {
      // Lazy seed: insert the 4 defaults for this child the first time they're
      // requested. Idempotent against a race — if another request seeded
      // first, this insert violates nothing fatal; we just refetch after.
      const { data: anyExisting } = await supabase
        .from('contribution_cards')
        .select('id')
        .eq('child_id', child_id)
        .limit(1)

      if (!anyExisting || anyExisting.length === 0) {
        await supabase.from('contribution_cards').insert(
          DEFAULT_CONTRIBUTION_CARDS.map(c => ({ ...c, child_id, active: true }))
        )
      }

      const refetched = await fetchActiveCards()
      cards = refetched.data
    }

    res.json({ cards: cards || [] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Screens a diary photo through the shared image gate. Returns null when the
// photo may be forwarded, or a child-facing message when it must not be.
// Fails CLOSED (unreadable photo → blocked), deletes the rejected upload,
// and tells the parent that something was held back.
async function screenContributionPhoto(photoPath, child) {
  const { data: parentRow } = await supabase
    .from('parents').select('prefs').eq('id', child.parent_id).maybeSingle()
  const language = parentRow?.prefs?.language === 'en' ? 'en' : 'tr'

  let image = null
  try {
    const buffer = await readStoredPhoto(photoPath)
    image = { buffer, mimeType: String(photoPath).endsWith('.png') ? 'image/png' : 'image/jpeg' }
  } catch (err) {
    console.error(`[CONTRIBUTIONS] could not read photo for safety screen: ${err.message}`)
  }

  const safety = image
    ? await screenImageSafety({ images: [image], kind: 'home_contribution', language })
    : { appropriate: false, reason: 'photo could not be read' }

  // matchesTask is deliberately ignored — a diary label like "I helped outside"
  // is not a task the photo has to depict. Only appropriateness gates it.
  if (safety.appropriate) return null

  console.log(`[CONTRIBUTIONS] inappropriate image child=${child.id} — blocked (${safety.reason})`)
  // Kept for a week rather than deleted, the same as a refused drawing and for the same
  // reason: a parent told their child attached something unsuitable will want to judge it
  // themselves, and it is usually a screenshot rather than anything they need shielding from.
  // Homework already worked this way; contributions and drawings were the two that destroyed
  // the evidence and then had to say so.
  let heldId = null
  try {
    const { data: heldRow } = await supabase.from('paintings').insert({
      child_id: child.id, photo_path: photoPath, status: 'blocked',
    }).select('id').maybeSingle()
    heldId = heldRow?.id ?? null
  } catch (err) { console.error(`[CONTRIBUTIONS] hold failed: ${err.message}`) }

  if (!heldId) {
    // Could not hold it — then do not keep it lying around either.
    const legacyPath = storagePathFromPublicUrl(photoPath)
    if (legacyPath) await supabase.storage.from('submissions').remove([legacyPath]).then(() => {}, () => {})
    else await supabase.storage.from(PHOTO_BUCKET).remove([photoPath]).then(() => {}, () => {})
  }

  try {
    const canSee = heldId
      ? (language === 'en' ? ' I have kept it for a week in case you want to see it — just ask.'
                           : ' Bir hafta boyunca sakladım, görmek istersen söylemen yeterli.')
      : ''
    await sendNotification(child.parent_id, (language === 'en'
      ? `${child.name} tried to attach a photo to a home contribution that isn't appropriate for a kids' app. I did not forward the image.`
      : `${child.name} bir ev katkısına uygun olmayan bir görsel eklemeye çalıştı. Görseli paylaşmadım.`) + canSee)
  } catch (err) {
    console.error(`[CONTRIBUTIONS] inappropriate alert failed: ${err.message}`)
  }

  return language === 'en'
    ? "I couldn't send that photo. Want to take another one?"
    : 'Bu fotoğrafı gönderemedim. Başka bir tane çeker misin?'
}

app.post('/api/contributions', async (req, res) => {
  try {
    const { child_id, label, category, source, photo_url } = req.body

    if (!child_id) return res.status(400).json({ error: 'child_id required' })
    if (source !== 'card' && source !== 'free_text') return res.status(400).json({ error: 'invalid source' })

    const trimmedLabel = (label || '').trim()
    if (!trimmedLabel) return res.status(400).json({ error: 'label required' })
    if (trimmedLabel.length > 200) return res.status(400).json({ error: 'label too long' })

    let resolvedCategory = category
    if (source === 'free_text' && !resolvedCategory) resolvedCategory = 'outside'
    if (!CONTRIBUTION_CATEGORIES.includes(resolvedCategory)) return res.status(400).json({ error: 'invalid category' })

    const resolvedPhotoUrl = typeof photo_url === 'string' && photo_url ? photo_url : null

    // TODO: verify child belongs to authenticated parent's family
    const { data: child } = await supabase.from('children').select('id, name, age, parent_id').eq('id', child_id).maybeSingle()
    if (!child) return res.status(404).json({ error: 'child not found' })

    // A diary photo is forwarded straight to the parent's Telegram, so it goes
    // through the SAME image gate as homework photos. It used to skip
    // it entirely: the label was screened, the picture attached to it was not.
    if (resolvedPhotoUrl) {
      const blocked = await screenContributionPhoto(resolvedPhotoUrl, child)
      if (blocked) return res.status(400).json({ error: 'photo_rejected', message: blocked })
    }

    if (source === 'free_text') {
      let screening
      try {
        screening = await screenChildInput(trimmedLabel, child.age)
      } catch (err) {
        console.error(`[CONTRIBUTIONS] screening failed: ${err.message}`)
        return res.status(503).json({ error: 'Şu an kaydedemedik, tekrar dener misin?' })
      }

      // ── Inappropriate content: block ──────────────────────────────────────
      if (screening.appropriateness === 'inappropriate') {
        console.log(`[SCREEN] inappropriate block child=${child_id}`)
        return res.status(400).json({ error: 'inappropriate', reason: screening.reason })
      }

      // ── Concerning or serious: notify parent, skip contribution flow ───────
      if (screening.concern_level === 'concerning' || screening.concern_level === 'serious') {
        const isSerious = screening.concern_level === 'serious'
        console.log(`[SCREEN] concern_level=${screening.concern_level} child=${child_id}`)
        try {
          const parentMsg = isSerious
            ? `${child.name} şöyle bir şey paylaştı: "${trimmedLabel}". Onunla konuşmak iyi gelebilir.`
            : `${child.name} şöyle bir şey paylaştı: "${trimmedLabel}". Onunla konuşmak iyi gelebilir.`
          await sendNotification(child.parent_id, parentMsg)
        } catch (err) {
          console.error(`[SCREEN] concern notification failed: ${err.message}`)
        }

        const n = Number(child.age) || 7
        const childAck = n <= 8 ? 'Paylaştığın için teşekkürler. 💚' : 'Paylaştığın için teşekkürler.'
        return res.status(200).json({ concern: true, message: childAck })
      }

      // ── Mild: continue normal flow, log for pattern tracking ─────────────
      if (screening.concern_level === 'mild') {
        // TODO: aggregate mild entries for pattern detection (threshold not yet implemented)
        await supabase.from('contribution_mild_log').insert({
          child_id,
          label: trimmedLabel,
          reason: screening.reason,
        }).then(() => {}).catch(err => console.error(`[SCREEN] mild log failed: ${err.message}`))
      }
    }

    const { data: inserted, error } = await supabase
      .from('contribution_log')
      .insert({
        child_id,
        label: trimmedLabel,
        category: resolvedCategory,
        source,
        status: 'pending',
        approved_by: null,
        approved_at: null,
        period: DateTime.utc().toFormat('yyyy-MM'),
        photo_url: resolvedPhotoUrl,
      })
      .select('id, label, category, source, status, created_at, photo_url')
      .single()

    if (error) return res.status(500).json({ error: error.message })

    try {
      const message = `🌱 ${child.name} bir katkı ekledi:\n"${trimmedLabel}"\n\nOnaylamak için uygulamadaki panelden bakabilirsin.`
      if (resolvedPhotoUrl) {
        await sendNotificationWithPhoto(child.parent_id, message, resolvedPhotoUrl)
      } else {
        await sendNotification(child.parent_id, message)
      }
    } catch (err) {
      console.error(`[CONTRIBUTIONS] notification failed: ${err.message}`)
    }

    res.status(201).json(inserted)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Attach a photo to a contribution that was already logged. Card taps stay a
// single tap — the photo is offered AFTER the entry exists, so it stays truly
// optional. Same image gate as the create path; a rejected photo leaves the
// contribution itself untouched.
app.post('/api/contributions/:id/photo', async (req, res) => {
  try {
    const { photo_url } = req.body
    if (typeof photo_url !== 'string' || !photo_url) return res.status(400).json({ error: 'photo_url required' })

    const { data: contribution } = await supabase
      .from('contribution_log')
      .select('id, child_id, label, status, photo_url')
      .eq('id', req.params.id)
      .maybeSingle()
    if (!contribution) return res.status(404).json({ error: 'not found' })
    if (contribution.photo_url) return res.status(409).json({ error: 'already has a photo' })

    const { data: child } = await supabase
      .from('children').select('id, name, age, parent_id').eq('id', contribution.child_id).maybeSingle()
    if (!child) return res.status(404).json({ error: 'child not found' })

    const blocked = await screenContributionPhoto(photo_url, child)
    if (blocked) return res.status(400).json({ error: 'photo_rejected', message: blocked })

    const { data: updated, error } = await supabase
      .from('contribution_log')
      .update({ photo_url })
      .eq('id', contribution.id)
      .select('id, label, category, source, status, created_at, photo_url')
      .single()
    if (error) return res.status(500).json({ error: error.message })

    // The parent already got the "added a contribution" message when the entry
    // was created, so this is a follow-up rather than a repeat.
    try {
      await sendNotificationWithPhoto(
        child.parent_id,
        `📷 ${child.name} "${contribution.label}" katkısına bir fotoğraf ekledi.`,
        photo_url,
      )
    } catch (err) {
      console.error(`[CONTRIBUTIONS] photo notification failed: ${err.message}`)
    }

    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/contributions', async (req, res) => {
  try {
    const { child_id, period, scope } = req.query
    if (!child_id) return res.status(400).json({ error: 'child_id required' })

    const { data: child } = await supabase.from('children').select('id, parent_id').eq('id', child_id).maybeSingle()
    if (!child) return res.status(404).json({ error: 'child not found' })

    const effectiveScope = scope === 'today' ? 'today' : scope === 'pending' ? 'pending' : 'month'

    // Pending contributions never expire off the parent's queue just because
    // the month rolled over — `period` is fixed at insert time (UTC month),
    // so a month-scoped query silently drops last month's open pendings.
    // This scope ignores period entirely and returns every open pending.
    if (effectiveScope === 'pending') {
      const { data: parentRow } = await supabase
        .from('parents')
        .select('timezone')
        .eq('id', child.parent_id)
        .single()
      const tz = parentRow?.timezone || 'UTC'

      const { data, error } = await supabase
        .from('contribution_log')
        .select('id, label, category, source, status, created_at, photo_url')
        .eq('child_id', child_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      if (error) return res.status(500).json({ error: error.message })

      const contributions = (data || []).map(c => ({
        ...c,
        date: DateTime.fromISO(c.created_at, { zone: 'utc' }).setZone(tz).toFormat('yyyy-MM-dd'),
      }))
      return res.json({ contributions, todayDate: DateTime.now().setZone(tz).toFormat('yyyy-MM-dd') })
    }

    let query = supabase
      .from('contribution_log')
      .select('id, label, category, source, status, created_at, photo_url')
      .eq('child_id', child_id)
      .order('created_at', { ascending: false })

    if (effectiveScope === 'today') {
      const todayStart = DateTime.utc().startOf('day').toISO()
      const todayEnd = DateTime.utc().endOf('day').toISO()
      query = query.gte('created_at', todayStart).lte('created_at', todayEnd)
    } else {
      const effectivePeriod = period || DateTime.utc().toFormat('yyyy-MM')
      query = query.eq('period', effectivePeriod)
    }

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    res.json({ contributions: data || [] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Single deterministic approval path — no gem write here. Gems are computed
// separately in the end-of-month review, by pedagogical design.
app.post('/api/contributions/:id/approve', async (req, res) => {
  try {
    const { id } = req.params
    const { parent_id } = req.body

    const { data: existing } = await supabase.from('contribution_log').select('id').eq('id', id).maybeSingle()
    if (!existing) return res.status(404).json({ error: 'contribution not found' })

    const { data: updated, error } = await supabase
      .from('contribution_log')
      .update({
        status: 'approved',
        approved_at: DateTime.utc().toISO(),
        approved_by: parent_id || null,
      })
      .eq('id', id)
      .select('id, label, category, source, status, created_at')
      .single()

    if (error) return res.status(500).json({ error: error.message })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/contributions/:id/reject', async (req, res) => {
  try {
    const { id } = req.params

    const { data: existing } = await supabase.from('contribution_log').select('id').eq('id', id).maybeSingle()
    if (!existing) return res.status(404).json({ error: 'contribution not found' })

    const { data: updated, error } = await supabase
      .from('contribution_log')
      .update({ status: 'rejected' })
      .eq('id', id)
      .select('id, label, category, source, status, created_at')
      .single()

    if (error) return res.status(500).json({ error: error.message })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// A day's tree reaches full size at this many approved contributions.
// Mirrors DAY_FULL in src/screens/MyTree.jsx — keep the two in step.
const DAY_FULL = 4

// The single source of truth for "how is the tree doing". The child screen, the
// parent dashboard and the Telegram agent all read the tree through here, so a
// parent asking Tuto gets the same numbers the two screens draw.
async function getTreeState(childId, tz) {
  const now = DateTime.now().setZone(tz)
  const todayEnd   = now.endOf('day').toUTC().toISO()
  const monthStart = now.startOf('month').toUTC().toISO()

  const { data: monthLogs } = await supabase
    .from('contribution_log')
    .select('label, category, created_at')
    .eq('child_id', childId)
    .eq('status', 'approved')
    .gte('created_at', monthStart)
    .lte('created_at', todayEnd)
    .order('created_at', { ascending: false })

  const localDay = ts => DateTime.fromISO(ts, { zone: 'utc' }).setZone(tz).toFormat('yyyy-MM-dd')
  const countByDate = {}
  for (const entry of (monthLogs || [])) {
    const d = localDay(entry.created_at)
    countByDate[d] = (countByDate[d] || 0) + 1
  }

  const todayLocalStr = now.toFormat('yyyy-MM-dd')
  const monthForest = []
  let cursor = now.startOf('month')
  const todayDay = now.startOf('day')
  while (cursor <= todayDay) {
    const dateStr = cursor.toFormat('yyyy-MM-dd')
    monthForest.push({ date: dateStr, count: countByDate[dateStr] || 0 })
    cursor = cursor.plus({ days: 1 })
  }

  const today = countByDate[todayLocalStr] || 0
  return {
    today,
    dayFull: DAY_FULL,
    todayComplete: today >= DAY_FULL,
    monthForest,
    monthTreeCount: monthForest.filter(d => d.count > 0).length,
    monthDaysElapsed: monthForest.length,
    monthLeafCount: (monthLogs || []).length,
    monthName: now.toFormat('LLLL yyyy'),
    todayDate: todayLocalStr,
    // What the leaves actually WERE — without this the agent can only report
    // numbers, and a parent asking about the tree wants the deeds.
    recentLeaves: (monthLogs || []).slice(0, 8).map(e => ({
      label: e.label, category: e.category, date: localDay(e.created_at),
    })),
    countByDate,
  }
}

async function tzForChild(childId) {
  const { data: child } = await supabase
    .from('children').select('parent_id').eq('id', childId).single()
  const { data: parentRow } = await supabase
    .from('parents').select('timezone').eq('id', child?.parent_id).single()
  return parentRow?.timezone || 'UTC'
}

app.get('/api/tree', async (req, res) => {
  try {
    const { child_id } = req.query
    if (!child_id) return res.json({ today: 0, listItems: [], monthForest: [], monthTreeCount: 0, todayDate: null })

    const tz = await tzForChild(child_id)
    const now = DateTime.now().setZone(tz)
    const todayStart = now.startOf('day').toUTC().toISO()
    const todayEnd   = now.endOf('day').toUTC().toISO()

    // Tree growth (approved, month-wide) comes from the shared helper; the
    // diary list is this endpoint's own concern:
    // - ALL pending, any date → stays in the list until approved/rejected
    // - today's approved → the "Bugün" part of the list
    const [tree, { data: pendingLogs }, { data: todayApprovedLogs }] = await Promise.all([
      getTreeState(child_id, tz),
      supabase
        .from('contribution_log')
        .select('id, label, category, status, created_at, photo_url')
        .eq('child_id', child_id)
        .eq('status', 'pending'),
      supabase
        .from('contribution_log')
        .select('id, label, category, status, created_at, photo_url')
        .eq('child_id', child_id)
        .eq('status', 'approved')
        .gte('created_at', todayStart)
        .lte('created_at', todayEnd),
    ])

    // Each item is tagged with its own local day so an old pending never
    // masquerades as "today".
    const listItems = [...(pendingLogs || []), ...(todayApprovedLogs || [])]
      .map(e => ({
        id: e.id,
        label: e.label,
        category: e.category,
        status: e.status,
        photo_url: e.photo_url ?? null,
        created_at: e.created_at,
        date: DateTime.fromISO(e.created_at, { zone: 'utc' }).setZone(tz).toFormat('yyyy-MM-dd'),
      }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))

    res.json({
      today: tree.today,
      listItems,
      monthForest: tree.monthForest,
      monthTreeCount: tree.monthTreeCount,
      todayDate: tree.todayDate,
      dayFull: tree.dayFull,
      monthLeafCount: tree.monthLeafCount,
    })
  } catch {
    res.json({ today: 0, listItems: [], monthForest: [], monthTreeCount: 0, todayDate: null })
  }
})

app.get('/api/tree/archive', async (req, res) => {
  try {
    const { child_id } = req.query
    if (!child_id) return res.json({ allTimeTrees: 0, months: [], years: [] })

    const { data: child } = await supabase
      .from('children').select('parent_id').eq('id', child_id).single()

    const { data: parentRow } = await supabase
      .from('parents').select('timezone').eq('id', child?.parent_id).single()

    const tz = parentRow?.timezone || 'UTC'
    const now = DateTime.now().setZone(tz)
    const currentYearMonth = `${now.year}-${String(now.month).padStart(2, '0')}`

    const { data: logs } = await supabase
      .from('contribution_log')
      .select('created_at')
      .eq('child_id', child_id)
      .eq('status', 'approved')

    // Group into local (year, month, day) keys using parent timezone
    const daySet = new Set()    // 'YYYY-MM-DD' — for allTimeTrees distinct-day count
    const monthMap = {}         // 'YYYY-MM' → { days: Set<string>, contributions: int }
    const yearMap = {}          // 'YYYY'    → Set<'YYYY-MM-DD'>

    for (const row of (logs || [])) {
      const local = DateTime.fromISO(row.created_at, { zone: 'utc' }).setZone(tz)
      const dayKey   = local.toFormat('yyyy-MM-dd')
      const monthKey = local.toFormat('yyyy-MM')
      const yearKey  = String(local.year)

      daySet.add(dayKey)

      if (!monthMap[monthKey]) monthMap[monthKey] = { days: new Set(), contributions: 0 }
      monthMap[monthKey].days.add(dayKey)
      monthMap[monthKey].contributions++

      if (!yearMap[yearKey]) yearMap[yearKey] = new Set()
      yearMap[yearKey].add(dayKey)
    }

    const allTimeTrees = daySet.size

    // months: past months only (exclude current), non-empty, newest first
    const months = Object.entries(monthMap)
      .filter(([key]) => key < currentYearMonth)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, { days, contributions }]) => {
        const [year, month] = key.split('-').map(Number)
        return { year, month, trees: days.size, contributions }
      })

    // years: newest first
    const years = Object.entries(yearMap)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([yearStr, daySetYear]) => ({ year: Number(yearStr), trees: daySetYear.size }))

    res.json({ allTimeTrees, months, years })
  } catch {
    res.json({ allTimeTrees: 0, months: [], years: [] })
  }
})

app.get('/api/submissions/:id', async (req, res) => {
  const { id } = req.params
  const { data, error } = await supabase
    .from('submissions')
    .select('id, status, gems_earned, parent_note, suggested_gems')
    .eq('id', id)
    .single()
  if (error || !data) return res.status(404).json({ error: 'Not found' })
  res.json(data)
})

// Signed, expiring URLs for a submission's photos. The bucket is private, so
// this is the only way the dashboard can render them — and it verifies the
// caller's Supabase JWT and that the submission belongs to THEIR child, so a
// submission id alone is not enough to see a child's photos.
app.get('/api/submissions/:id/photos', async (req, res) => {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
    if (!token) return res.status(401).json({ error: 'unauthorized' })

    const { data: userData, error: authErr } = await supabase.auth.getUser(token)
    const userId = userData?.user?.id
    if (authErr || !userId) return res.status(401).json({ error: 'unauthorized' })

    const { data: sub } = await supabase
      .from('submissions').select('id, child_id, photo_urls, media_url').eq('id', req.params.id).maybeSingle()
    if (!sub) return res.status(404).json({ error: 'not found' })

    const { data: child } = await supabase
      .from('children').select('parent_id').eq('id', sub.child_id).maybeSingle()
    // parents.id IS the auth user id (see ParentSignup), so this is the check.
    if (!child || child.parent_id !== userId) return res.status(403).json({ error: 'forbidden' })

    const stored = sub.photo_urls?.length ? sub.photo_urls : (sub.media_url ? [sub.media_url] : [])
    res.json({ photos: await signedUrlsFor(stored, 3600) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Signed URL for a contribution's photo. Same private bucket and same
// ownership check as the submission photos — the parent approves contributions
// in the dashboard, so they need to see the photo there, not only on Telegram.
app.get('/api/contributions/:id/photo', async (req, res) => {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
    if (!token) return res.status(401).json({ error: 'unauthorized' })

    const { data: userData, error: authErr } = await supabase.auth.getUser(token)
    const userId = userData?.user?.id
    if (authErr || !userId) return res.status(401).json({ error: 'unauthorized' })

    const { data: contribution } = await supabase
      .from('contribution_log').select('id, child_id, photo_url').eq('id', req.params.id).maybeSingle()
    if (!contribution) return res.status(404).json({ error: 'not found' })
    if (!contribution.photo_url) return res.json({ photo: null })

    const { data: child } = await supabase
      .from('children').select('parent_id').eq('id', contribution.child_id).maybeSingle()
    // parents.id IS the auth user id, so this is the check.
    if (!child || child.parent_id !== userId) return res.status(403).json({ error: 'forbidden' })

    res.json({ photo: await signedUrlFor(contribution.photo_url, 3600) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/children/:childId/stories/cover', async (req, res) => {
  const { childId } = req.params
  const { imageBase64, mimeType } = req.body
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' })
  try {
    const buffer = Buffer.from(imageBase64, 'base64')
    const ext = (mimeType || '').includes('png') ? 'png' : 'jpg'
    const path = `${childId}/covers/${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('submissions')
      .upload(path, buffer, { contentType: mimeType || 'image/jpeg', upsert: false })
    if (error) return res.status(500).json({ error: error.message })
    const cover_url = supabase.storage.from('submissions').getPublicUrl(path).data.publicUrl
    res.json({ cover_url })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Homework module ───────────────────────────────────────────────────────────
// Child photographs finished homework (up to 15 pages). EVERYTHING AI/gem
// related is server-side: EXIF, storage upload, Gemini observation, safety
// screen, submission write (pending, NO gems), parent notification. The client
// only uploads images and shows "it arrived" — gems_earned is never client-set.
const HOMEWORK_MAX_PHOTOS = 15

// Homework submissions whose parent notification is held pending a child's
// "did you do this today?" answer (only when the photo has no readable date).
// submissionId → { deliver(doneToday), timer }. In-memory is fine: the backend
// is a single long-running process (same pattern as the WhatsApp/TG maps).
const pendingHomeworkNotify = new Map()

app.post('/api/children/:childId/homework', async (req, res) => {
  const { childId } = req.params
  const { paths } = req.body
  // Client uploads the images straight to Storage and sends only
  // the paths — so the request body stays tiny no matter how many pages, and
  // the ORIGINAL bytes (with EXIF) live on the server side to read.
  if (!Array.isArray(paths) || paths.length === 0) return res.status(400).json({ error: 'paths required' })
  if (paths.length > HOMEWORK_MAX_PHOTOS) return res.status(400).json({ error: `en fazla ${HOMEWORK_MAX_PHOTOS} fotoğraf gönderilebilir` })
  // Constrain to this child's own homework folder — a client can't point the
  // submission at some other object in the bucket.
  const prefix = `${childId}/homework/`
  if (!paths.every(p => typeof p === 'string' && p.startsWith(prefix))) {
    return res.status(400).json({ error: 'invalid path' })
  }

  try {
    const { data: child } = await supabase
      .from('children').select('id, name, age, parent_id, task_settings').eq('id', childId).maybeSingle()
    if (!child) return res.status(404).json({ error: 'child not found' })

    const { data: parentRow } = await supabase
      .from('parents').select('prefs, timezone').eq('id', child.parent_id).maybeSingle()
    const prefs = parentRow?.prefs || {}
    const language = prefs.language === 'en' ? 'en' : 'tr'
    const tone = typeof prefs.tone === 'string' && prefs.tone ? prefs.tone : null
    const tz = parentRow?.timezone || 'UTC'

    // 1. Download the ORIGINAL bytes from Storage (service role). Read EXIF
    //    DateTimeOriginal from the FIRST photo — the client never resized, so
    //    EXIF is intact. Screenshots carry no EXIF; null is expected and fine.
    //    CODE (not Gemini, not the client) decides photo_taken_at.
    const decoded = []
    for (const path of paths) {
      // Prefer the private bucket; fall back to the legacy public one so a
      // still-cached older client (uploading to 'submissions') keeps working
      // through the transition.
      let { data: blob, error: dlErr } = await supabase.storage.from(PHOTO_BUCKET).download(path)
      if (dlErr || !blob) {
        ({ data: blob, error: dlErr } = await supabase.storage.from('submissions').download(path))
      }
      if (dlErr || !blob) return res.status(400).json({ error: `could not read ${path}` })
      const buffer = Buffer.from(await blob.arrayBuffer())
      if (buffer.length === 0) return res.status(400).json({ error: 'empty image' })
      const mimeType = blob.type && blob.type.startsWith('image/') ? blob.type : (path.endsWith('.png') ? 'image/png' : 'image/jpeg')
      decoded.push({ buffer, mimeType })
    }

    let photoTakenAt = null
    try {
      const exif = await exifr.parse(decoded[0].buffer, ['DateTimeOriginal'])
      if (exif?.DateTimeOriginal instanceof Date && !Number.isNaN(exif.DateTimeOriginal.getTime())) {
        photoTakenAt = exif.DateTimeOriginal.toISOString()
      }
    } catch { /* no EXIF (e.g. screenshot) — leave null */ }

    // 2. Store the storage PATHS, not public URLs — the bucket is private, so
    //    readers get a short-lived signed URL instead (signedUrlFor).
    const photoUrls = paths

    // Any rejection below must not leave the uploaded bytes sitting in Storage.
    const discardUploads = () => supabase.storage.from(PHOTO_BUCKET).remove(paths).then(() => {}, () => {})

    // 2.5 Duplicate guard — the same image must not be submitted (and rewarded)
    //     twice. Byte-exact sha256 per page catches a re-sent file.
    const hashes = decoded.map(d => crypto.createHash('sha256').update(d.buffer).digest('hex'))
    const { data: priorSubs, error: priorErr } = await supabase
      .from('submissions')
      .select('photo_hashes')
      .eq('child_id', childId)
      .eq('task_type', 'homework')
    if (priorErr) console.error(`[HOMEWORK] duplicate lookup failed: ${priorErr.message}`)
    const seenHashes = new Set((priorSubs || []).flatMap(s => s.photo_hashes || []))
    if (hashes.some(h => seenHashes.has(h))) {
      console.log(`[HOMEWORK] duplicate photo child=${childId} — rejected`)
      await discardUploads()
      return res.status(409).json({ error: 'You already sent this one 🌱 Try a photo of your new homework!' })
    }

    // 2.6 Image safety gate — looks at the PICTURE. The text screener further
    //     down only ever sees Gemini's written description, which is empty for a
    //     non-homework image, so an inappropriate photo used to reach the parent
    //     untouched. Fails CLOSED: any error, refusal or uncertainty blocks it.
    const safety = await screenImageSafety({ images: decoded, kind: 'homework', language })

    if (!safety.appropriate) {
      console.log(`[HOMEWORK] withheld image child=${childId} (reason: ${safety.reason})`)
      // KEEP the image and record it as 'blocked' — out of the approval queue,
      // but retrievable. The classifier can be wrong (a kid's ghost story got
      // flagged for "blood"), and telling a parent "something was inappropriate"
      // with no way to look leaves them helpless. They can ask to see it.
      const heldRow = {
        child_id: childId,
        task_type: 'homework',
        status: 'blocked',
        photo_urls: photoUrls,
        photo_hashes: hashes,
        media_url: photoUrls[0],
        task_description: 'İncelenmeyi bekleyen görsel',
        gems_earned: null,
      }
      let { error: heldErr } = await supabase.from('submissions').insert(heldRow)
      if (heldErr && /photo_hashes/i.test(heldErr.message || '')) {
        const { photo_hashes, ...withoutHashes } = heldRow
        ;({ error: heldErr } = await supabase.from('submissions').insert(withoutHashes))
      }
      if (heldErr) console.error(`[HOMEWORK] held-row insert failed: ${heldErr.message}`)

      try {
        await sendNotification(child.parent_id, language === 'en'
          ? `${child.name} sent something as homework that I hesitated to forward automatically — I may well be wrong. I've kept it: just say "show me" and I'll send it here so you can decide for yourself.`
          : `${child.name} ödev olarak bir görsel gönderdi ama otomatik iletmekte tereddüt ettim — yanılıyor da olabilirim. Görseli sakladım: "göster" dersen buraya yollarım, kararı sen verirsin.`)
      } catch (err) {
        console.error(`[HOMEWORK] withheld alert failed: ${err.message}`)
      }
      return res.status(400).json({ error: "I couldn't send this one. Can you take a photo of your homework page?" })
    }

    // 3. Gemini observation — server-side only. gemini-3.5-flash intermittently
    //    emits invalid JSON even with response_mime_type set (typically an
    //    unescaped double-quote inside a text field), so a bad parse gets ONE
    //    fresh regeneration before we give up — a re-roll almost always yields
    //    valid JSON. On total failure we still record the submission and notify
    //    the parent (observation stays null). callGeminiWithRetry covers the
    //    HTTP-transient axis; this loop covers the parse-validity axis.
    let observation = null
    try {
      const parts = [
        { text: homeworkObservationPrompt(language) },
        ...decoded.map(d => ({ inline_data: { mime_type: d.mimeType, data: d.buffer.toString('base64') } })),
      ]
      for (let attempt = 0; attempt < 2 && !observation; attempt++) {
        const data = await callGeminiWithRetry(() => fetchGeminiOnce({
          contents: [{ parts }],
          generationConfig: { response_mime_type: 'application/json' },
        }))
        try {
          observation = parseObservation(textFromParts(data.candidates?.[0]?.content?.parts) || '{}')
        } catch (parseErr) {
          console.warn(`[HOMEWORK] observation parse attempt ${attempt + 1} failed: ${parseErr.message}`)
        }
      }
    } catch (err) {
      console.error(`[HOMEWORK] observation failed: ${err.message}`)
    }

    // 3.5 Not homework at all — the safety pass and the observation both say so.
    //     Don't file it or bother the parent; ask the child to retake. Requiring
    //     BOTH to agree keeps a misread page from blocking real homework.
    if (!safety.matchesTask && !observation?.looks_like_homework) {
      console.log(`[HOMEWORK] not homework child=${childId} — rejected`)
      await discardUploads()
      return res.status(400).json({ error: "This doesn't look like homework. Try a photo of your homework page!" })
    }

    // 4. Safety screen over what Gemini read on the page. Inappropriate → do NOT
    //    store the submission, alert the parent separately. Screen failure →
    //    proceed (homework is low-risk; don't lose it over a screening hiccup).
    if (observation?.looks_like_homework) {
      const screenText = [observation.subject_guess, observation.blanks_noted, ...(observation.observations || [])]
        .filter(Boolean).join('. ')
      if (screenText) {
        let screening
        try { screening = await screenChildInput(screenText, child.age ?? 7) } catch { /* proceed */ }
        if (screening?.appropriateness === 'inappropriate') {
          console.log(`[HOMEWORK] inappropriate content child=${childId} — submission skipped`)
          try {
            await sendNotification(child.parent_id,
              `${child.name} bir ödev fotoğrafı gönderdi ama içeriğine bir göz atmanda fayda olabilir.`)
          } catch { /* best-effort */ }
          return res.json({ ok: true })
        }
        if (screening?.concern_level === 'concerning' || screening?.concern_level === 'serious') {
          try {
            await sendNotification(child.parent_id,
              `${child.name} bir ödev gönderdi. Sayfada dikkat çekebilecek bir şey olabilir, bir göz atmanda fayda var.`)
          } catch { /* best-effort */ }
        }
      }
    }

    // 5. Store submission — pending, NO gems. suggested_gems is the SERVER-read
    //    configured reward (task_settings.homework.gems, default 25) so the
    //    dashboard/approval path has a number to work with.
    const hwGems = child.task_settings?.homework?.gems ?? HOMEWORK_DEFAULT_GEMS
    const submissionRow = {
      child_id: childId,
      task_type: 'homework',
      status: 'pending',
      photo_urls: photoUrls,
      photo_hashes: hashes,
      media_url: photoUrls[0],
      task_description: observation?.subject_guess || 'Ödev',
      suggested_gems: hwGems,
      gems_earned: null,
      photo_taken_at: photoTakenAt,
    }
    let { data: submission, error: subErr } = await supabase
      .from('submissions').insert(submissionRow).select('id').single()

    // If the dedup column hasn't been migrated yet, don't take homework down
    // over it — store without hashes and shout in the logs. Dedup starts
    // working the moment the column exists.
    if (subErr && /photo_hashes/i.test(subErr.message || '')) {
      console.warn('[HOMEWORK] photo_hashes column missing — RUN THE MIGRATION; storing without dedup for now')
      const { photo_hashes, ...withoutHashes } = submissionRow
      ;({ data: submission, error: subErr } = await supabase
        .from('submissions').insert(withoutHashes).select('id').single())
    }
    if (subErr) {
      console.error(`[HOMEWORK] submission insert failed: ${subErr.message}`)
      return res.status(500).json({ error: subErr.message })
    }

    // Can we vouch for the photo being from today? EXIF present + today =
    // confident (no question). EXIF present + other day = we already know it's
    // stale (note below). EXIF absent (screenshot / downloaded image) = we
    // genuinely can't tell, so we ask the CHILD before notifying the parent.
    const takenLocal = photoTakenAt ? DateTime.fromISO(photoTakenAt, { zone: 'utc' }).setZone(tz).toFormat('yyyy-MM-dd') : null
    const todayLocal = DateTime.now().setZone(tz).toFormat('yyyy-MM-dd')
    const needsDateConfirm = photoTakenAt == null

    // 6. Parent notification. Gemini writes the caption honoring tone+language;
    //    CODE filters low-confidence errors out and supplies the date sentence.
    //    Runs immediately when the date is known, or after the child answers
    //    when it isn't. Notification must never be lost → every branch falls back.
    async function deliverHomeworkNotification(doneToday) {
      let dateNote = ''
      if (photoTakenAt && takenLocal !== todayLocal) {
        dateNote = language === 'en'
          ? "This photo doesn't look like it was taken today."
          : 'Bu fotoğraf bugün çekilmiş görünmüyor.'
      } else if (!photoTakenAt) {
        // Couldn't read the date — relay the child's own answer, hedged. Name as
        // subject (no case suffix) so it reads right for any Turkish name.
        if (doneToday === true) dateNote = language === 'en'
          ? `I couldn't confirm the photo's date, but ${child.name} said they did this homework today — I could be wrong.`
          : `Fotoğrafın tarihini kesinleştiremedim; ${child.name} bu ödevi bugün yaptığını söyledi. Yine de yanılıyor olabilirim.`
        else if (doneToday === false) dateNote = language === 'en'
          ? `I couldn't confirm the photo's date; ${child.name} said they did not do this homework today.`
          : `Fotoğrafın tarihini kesinleştiremedim; ${child.name} bu ödevi bugün yapmadığını söyledi.`
        // doneToday undefined (child never answered) → no date sentence
      }

      let caption
      try {
        const filtered = observation?.looks_like_homework ? filterForParent(observation) : null
        if (!filtered) {
          caption = fallbackCaption({ childName: child.name, language, staleNote: dateNote })
        } else {
          const capData = await callGeminiWithRetry(() => fetchGeminiOnce({
            contents: [{ parts: [{ text: homeworkCaptionPrompt({
              filteredObservation: filtered, childName: child.name, tone, language,
              photoCount: photoUrls.length, staleNote: dateNote, gems: hwGems,
            }) }] }],
          }))
          caption = textFromParts(capData.candidates?.[0]?.content?.parts)
          if (!caption) caption = fallbackCaption({ childName: child.name, language, staleNote: dateNote })
        }
      } catch (err) {
        console.error(`[HOMEWORK] caption failed: ${err.message}`)
        caption = fallbackCaption({ childName: child.name, language, staleNote: dateNote })
      }
      if (caption.length > 1024) caption = caption.slice(0, 1021) + '…'

      try {
        await sendNotificationWithPhotos(child.parent_id, caption, photoUrls)
      } catch (err) {
        console.error(`[HOMEWORK] notification failed: ${err.message}`)
      }
    }

    // Child stops waiting the moment the homework is safely recorded.
    res.json({ ok: true, submissionId: submission.id, needsDateConfirm })

    if (needsDateConfirm) {
      // Hold the notification until the child answers "did you do this today?".
      // Safety net: if they never answer (closed the app), send anyway after a
      // grace period so the parent is never left without a notification.
      const timer = setTimeout(() => {
        if (pendingHomeworkNotify.has(submission.id)) {
          pendingHomeworkNotify.delete(submission.id)
          deliverHomeworkNotification(undefined).catch(err => console.error(`[HOMEWORK] deferred notify error: ${err.message}`))
        }
      }, 90_000)
      pendingHomeworkNotify.set(submission.id, { deliver: deliverHomeworkNotification, timer })
    } else {
      deliverHomeworkNotification(undefined).catch(err => console.error(`[HOMEWORK] background notify error: ${err.message}`))
    }
  } catch (err) {
    console.error(`[HOMEWORK] error: ${err.message}`)
    if (!res.headersSent) res.status(500).json({ error: err.message })
  }
})

// Child's answer to "did you do this homework today?" — asked only when the
// photo carried no readable date. Releases the held parent notification with
// the child's confirmation woven in. Idempotent: if the safety-net timer
// already fired (or it's an unknown id), this is a no-op.
app.post('/api/homework/:submissionId/confirm-date', async (req, res) => {
  const { submissionId } = req.params
  const { doneToday } = req.body
  const entry = pendingHomeworkNotify.get(submissionId)
  if (entry) {
    clearTimeout(entry.timer)
    pendingHomeworkNotify.delete(submissionId)
    entry.deliver(typeof doneToday === 'boolean' ? doneToday : undefined)
      .catch(err => console.error(`[HOMEWORK] confirm-date notify error: ${err.message}`))
  }
  res.json({ ok: true })
})

// Child-side homework history (last 7 days), newest first. Powers the "This
// week" list on the upload screen. 'checking' is a client-only optimistic
// state; persisted rows are pending/approved/rejected.
app.get('/api/children/:childId/homework', async (req, res) => {
  const { childId } = req.params
  try {
    const since = DateTime.utc().minus({ days: 7 }).toISO()
    const { data, error } = await supabase
      .from('submissions')
      .select('id, status, photo_urls, media_url, created_at')
      .eq('child_id', childId)
      .eq('task_type', 'homework')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })
    const submissions = (data || []).map(s => ({
      id: s.id,
      date: s.created_at,
      pages: Array.isArray(s.photo_urls) && s.photo_urls.length ? s.photo_urls.length : (s.media_url ? 1 : 0),
      status: s.status,
    }))
    res.json({ submissions })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── My Drawings ─────────────────────────────────────────────────────────────
// Guided-step drawing: the child follows sketch panels, photographs the result
// and is rewarded IMMEDIATELY (no parent approval, unlike homework).
//
// Because there is no approval step, the server is the only thing standing
// between a child and unlimited gems — so the reward amount is decided HERE and
// the client's opinion of it is never read. A free-draw upload is a photo of
// anything at all, so the same daily cap covers it.

const DRAWING_DEFAULTS = { gems: 20, dailyCap: 2 }

// Parent-tunable per child via children.task_settings.drawing.
function drawingSettings(taskSettings) {
  const s = taskSettings?.drawing || {}
  const gems = Number.isFinite(s.gems) ? Math.max(0, Math.min(200, Math.trunc(s.gems))) : DRAWING_DEFAULTS.gems
  const cap = Number.isFinite(s.daily_cap) ? Math.max(0, Math.min(50, Math.trunc(s.daily_cap))) : DRAWING_DEFAULTS.dailyCap
  return { gems, dailyCap: cap, active: s.active !== false }
}

// How many rewarded drawings this child already has today, in THEIR timezone.
// Counted by approved_at, not created_at: gems move at approval, so a drawing
// made yesterday and approved today spends today's allowance.
async function rewardedDrawingsToday(childId, tz) {
  const now = DateTime.now().setZone(tz)
  const { data, error } = await supabase
    .from('paintings')
    .select('id')
    .eq('child_id', childId)
    .gt('reward_amount', 0)
    .gte('approved_at', now.startOf('day').toUTC().toISO())
    .lte('approved_at', now.endOf('day').toUTC().toISO())
  // Fail CLOSED: if we can't count, don't hand out gems.
  if (error) { console.error(`[DRAWING] cap check failed: ${error.message}`); return null }
  return (data || []).length
}

// The catalogue. Panel URLs are derived from the path, never stored.
app.get('/api/drawings', async (req, res) => {
  try {
    const ageGroup = typeof req.query.age_group === 'string' ? req.query.age_group : '6-8'
    const { data, error } = await supabase
      .from('drawings')
      .select('id, age_group, name_tr, name_en, category, step_count, difficulty')
      .eq('age_group', ageGroup)
      .eq('active', true)
      .order('sort_order', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })
    res.json({ drawings: data || [], ageGroup })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// The child finished a drawing. The IMAGE BYTES come through here — not
// straight to Storage from the browser.
//
// The first cut had the client upload to the bucket itself, which needed an
// anon INSERT policy on storage.objects. That policy was the hole: child ids
// are discoverable (GET /api/family/:code/children), so anyone with a family
// code could write arbitrary files into a child's folder and then have them
// forwarded to the parent. Here the service role is the only writer, and
// nothing is stored until it has passed the shared image gate.
// ── Maths sessions ───────────────────────────────────────────────────────────
// Maths used to be written straight to the database by the browser: the client picked the
// gem amount, wrote bt_ledger itself with the anon key, and the server never learned a
// session had happened. That had four consequences at once — the parent's configured gem
// value was ignored (the child's stored session carries only id/name/age, so the lookup
// for it was always undefined and it silently fell back to a hardcoded 20), there was no
// daily cap so sessions could be repeated for gems indefinitely, no notification was
// possible, and the amount was whatever the client said.
//
// This does not make the *score* trustworthy — the questions are still generated and
// marked in the browser, so a forged 100% would still be believed. Verifying that needs
// the server to generate the questions and hold the answers, which is a larger change.
// What it does fix is everything that follows from the score: the amount, the cap, the
// settings and the write are all decided here now.
const MATH_DEFAULTS = { gems: 30, dailyCap: 3 }

// What a rung practised, back when a rung practised one thing. Kept only so sessions posted
// by a client that has not reloaded yet still record something sensible; the level no longer
// chooses the subject, the child's school year does.
const TOPIC_FOR_LEVEL = {
  1: 'counting',      2: 'addition',       3: 'subtraction',
  4: 'geometry',      5: 'addition',       6: 'subtraction',
  7: 'word-problems', 8: 'addition-subtraction-100', 9: 'multiplication',
  10: 'fractions',    11: 'division',      12: 'measurement',
  13: 'multiplication', 14: 'multi-step',  15: 'fractions',
}

// Reading had every one of maths' faults and one more: it paid a flat client-side amount
// that ignored what the parent had configured, had no daily limit, told the parent nothing,
// and wrote the ledger from the browser. It earns the same treatment, so the pieces below
// are shared rather than copied — one settings reader and one cap counter for both.
const READING_DEFAULTS = { gems: 30, dailyCap: 3 }

// What this session was about, for the column the parent's chat agent reads. A session now
// spans several curriculum topics instead of drilling one, so it lists them — "Year 5:
// Multiplication, Fractions, Statistics" answers "what has she been working on" in a way
// that "subtraction" never could.
function topicLabel(topics, schoolYear, level) {
  const names = Array.isArray(topics) ? topics.filter(t => typeof t === 'string' && t.trim()).slice(0, 8) : []
  if (!names.length) return TOPIC_FOR_LEVEL[level] || 'math'
  const list = names.join(', ')
  const prefix = typeof schoolYear === 'string' && schoolYear.trim() ? `${schoolYear.trim()}: ` : ''
  return `${prefix}${list}`.slice(0, 300)
}

function taskSettingsFor(taskSettings, key, defaults) {
  const s = taskSettings?.[key] || {}
  const gems = Number.isFinite(s.gems) ? Math.max(0, Math.min(200, Math.trunc(s.gems))) : defaults.gems
  const cap = Number.isFinite(s.daily_cap) ? Math.max(0, Math.min(50, Math.trunc(s.daily_cap))) : defaults.dailyCap
  return { gems, dailyCap: cap, active: s.active !== false }
}

async function rewardedToday(childId, tz, reason) {
  const now = DateTime.now().setZone(tz)
  const { data, error } = await supabase
    .from('bt_ledger')
    .select('id')
    .eq('child_id', childId)
    .eq('reason', reason)
    .gt('amount', 0)
    .gte('created_at', now.startOf('day').toUTC().toISO())
    .lte('created_at', now.endOf('day').toUTC().toISO())
  // Fail CLOSED, as the drawing cap does: if the count can't be read, pay nothing.
  if (error) { console.error(`[CAP] ${reason} check failed: ${error.message}`); return null }
  return (data || []).length
}

// The two ends the maths bands used to have — a third of the reward for getting none of it
// right, all of it for getting all — slid into a straight line so every question counts.
function rewardScale(accuracy) {
  const acc = Math.max(0, Math.min(100, Number(accuracy) || 0))
  return 0.33 + 0.67 * (acc / 100)
}

// How many of a topic's most recent attempts count, and how few are too few to speak.
//
// A window of attempts rather than a window of days: a topic practised often refreshes quickly,
// a topic that comes up rarely keeps a longer memory, and neither needs a calendar rule. Topic
// ids are year-scoped, so moving up a school year retires last year's record by itself.
//
// The floor matters more than the window. Year 5 has eight topics and a session has ten
// questions, so a topic gets about one question a session — measured, five attempts takes four
// or five sessions. Calling a child weak at multiplication off two questions is the same
// mistake as every other one this week: saying something we do not know.
const MASTERY_WINDOW = 12
const MASTERY_MIN_ATTEMPTS = 5
const MASTERY_WEAK_BELOW = 60
const MASTERY_CLEARS_AT = 80

// Per-topic standing for one child, computed from the raw attempts every time it is asked for.
// There is deliberately no stored mastery table: a second copy of a fact drifts from the first,
// which is how prefs.gem_values came to say 20 while task_settings said 30.
async function topicStanding(childId) {
  const { data, error } = await supabase
    .from('math_attempts')
    .select('topic_id, topic_name, correct, created_at')
    .eq('child_id', childId)
    .order('created_at', { ascending: false })
    .limit(400)
  if (error) { console.error(`[MASTERY] read failed for ${childId}: ${error.message}`); return null }

  const byTopic = new Map()
  for (const row of data || []) {
    const bucket = byTopic.get(row.topic_id) || { topic_id: row.topic_id, topic_name: row.topic_name, rows: [] }
    // Newest first from the query, so the first MASTERY_WINDOW seen are the most recent.
    if (bucket.rows.length < MASTERY_WINDOW) bucket.rows.push(row)
    byTopic.set(row.topic_id, bucket)
  }

  return [...byTopic.values()].map(b => {
    const attempts = b.rows.length
    const correct = b.rows.filter(r => r.correct).length
    const accuracy = Math.round((correct / attempts) * 100)
    return {
      topic_id: b.topic_id,
      topic_name: b.topic_name,
      attempts,
      correct,
      accuracy,
      // The verdict is decided here, never by the model reading the numbers. Given raw rows it
      // will call a child weak off three questions, which is exactly what the floor exists to
      // prevent.
      standing: attempts < MASTERY_MIN_ATTEMPTS ? 'not enough yet'
        : accuracy < MASTERY_WEAK_BELOW ? 'weak'
        : accuracy >= MASTERY_CLEARS_AT ? 'strong'
        : 'getting there',
    }
  }).sort((a, b) => a.accuracy - b.accuracy)
}

// What the maths screen needs before it can build a session: where the child stands on the
// dial, how each topic is going, and whether a parent has asked for something to be weighted.
// The screen used to read math_progress straight from the browser for the level alone; the
// other two have no client-side source at all, and putting the standing behind the same call
// keeps the figure the parent is told and the figure the generator uses identical by
// construction.
app.get('/api/children/:childId/math-plan', async (req, res) => {
  const { childId } = req.params
  try {
    const [{ data: child }, { data: prevRows }] = await Promise.all([
      supabase.from('children').select('id, age, math_focus').eq('id', childId).maybeSingle(),
      supabase.from('math_progress').select('level').eq('child_id', childId)
        .order('created_at', { ascending: false }).limit(1),
    ])
    if (!child) return res.status(404).json({ error: 'child not found' })

    const standing = await topicStanding(childId)
    res.json({
      level: prevRows?.[0]?.level ?? null,   // null = the client falls back to the age footing
      focus: child.math_focus ?? null,
      standing: standing ?? [],
      // Named so the client never has to know the thresholds, and so there is one place to
      // change what "weak" means.
      weak_topic_ids: (standing ?? []).filter(t => t.standing === 'weak').map(t => t.topic_id),
    })
  } catch (err) {
    console.error('[MATH-PLAN]', err.message)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/children/:childId/math-session', async (req, res) => {
  const { childId } = req.params
  const { level, topics, school_year, attempts, questions_total, questions_correct, accuracy, help_used, gemini_notes, next_session } = req.body
  try {
    const { data: child } = await supabase
      .from('children').select('id, name, parent_id, task_settings').eq('id', childId).maybeSingle()
    if (!child) return res.status(404).json({ error: 'child not found' })

    const settings = taskSettingsFor(child.task_settings, 'math', MATH_DEFAULTS)
    const tz = await tzForChild(childId)
    const doneToday = await rewardedToday(childId, tz, 'math')

    // Maths is declared `variable` in taskDefaults, and the parent is shown "up to N" —
    // but only paper mode ever scaled, via whatever figure the model returned, while
    // screen mode paid the same flat amount whether the child scored 20% or 100%. One
    // scale for both, applied here, using the bands the model had been asked for.
    // Help on top of that costs a third: it is the child's own admission that they needed
    // a step shown, the same ratio the client used to apply.
    // Banded scoring came from the prompt the model used to be given, and it was too coarse
    // for a five-question session: the top band opened at 80%, which IS four out of five, so
    // a perfect round paid exactly the same as one with a mistake in it.
    const acc = Math.max(0, Math.min(100, Number(accuracy) || 0))
    const scale = rewardScale(acc)
    let gems = 0
    let capped = false
    if (!settings.active || doneToday === null || doneToday >= settings.dailyCap) {
      capped = true
    } else {
      gems = Math.round(settings.gems * scale * (Number(help_used) > 0 ? 0.67 : 1))
    }

    // Advancing used to take a single good session, so a child who breezed through five
    // easy questions moved up permanently — in testing a seven-year-old crossed four rungs
    // in thirty-five minutes and reached the top of the ladder on work well below her. It
    // takes two in a row at the same rung now. Dropping still takes one: being out of your
    // depth is the case where moving quickly helps, so the rule is deliberately asymmetric.
    //
    // A stored row records the level the child ENDED on but the accuracy they earned at the
    // one before it, so a row that advanced cannot also count as the first of the next
    // pair — otherwise "twice in a row" would collapse back into "every session".
    const { data: prevRows } = await supabase
      .from('math_progress')
      .select('level, accuracy, level_change')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(1)
    const last = prevRows?.[0]
    const earnedHereBefore = !!last && last.level === level && last.accuracy >= 80 && last.level_change !== 'up'

    let newLevel = level
    let levelChange = 'same'
    if (acc >= 80 && earnedHereBefore && level < 15) { newLevel = level + 1; levelChange = 'up' }
    else if (acc < 40 && level > 1) { newLevel = level - 1; levelChange = 'down' }

    const { error: progErr } = await supabase.from('math_progress').insert({
      child_id: childId,
      session_date: DateTime.now().setZone(tz).toISODate(),
      level: newLevel,
      topic: topicLabel(topics, school_year, level),
      questions_total, questions_correct,
      accuracy: acc,
      level_change: levelChange,
      help_used: Number(help_used) || 0,
      gemini_notes: typeof gemini_notes === 'string' ? gemini_notes.slice(0, 500) : null,
      next_session: typeof next_session === 'string' ? next_session.slice(0, 500) : null,
    })
    if (progErr) return res.status(500).json({ error: progErr.message })

    // The raw per-question record. Written after the session row so a failure here costs the
    // history but never the child's gems — the reward is not worth losing to a bookkeeping
    // write, and the session row is what the reward is based on.
    const sessionId = randomUUID()
    const rows = (Array.isArray(attempts) ? attempts : []).slice(0, 40)
      .filter(a => a && typeof a.topic_id === 'string' && a.topic_id)
      .map(a => ({
        child_id: childId,
        session_id: sessionId,
        topic_id: a.topic_id.slice(0, 60),
        topic_name: typeof a.topic_name === 'string' ? a.topic_name.slice(0, 120) : null,
        source: a.source === 'llm' ? 'llm' : 'template',
        level,
        question: typeof a.question === 'string' ? a.question.slice(0, 500) : null,
        child_answer: a.child_answer == null ? null : String(a.child_answer).slice(0, 120),
        correct: !!a.correct,
        help_used: !!a.help_used,
      }))
    if (rows.length) {
      const { error: attErr } = await supabase.from('math_attempts').insert(rows)
      if (attErr) console.error(`[MATH] attempts insert failed for ${childId}: ${attErr.message}`)
    }

    // A focus the parent asked for lasts until the child masters it, not for a fixed run of
    // sessions — so the parent hears the outcome of what they asked for, which is the whole
    // point of their having asked.
    let focusCleared = null
    if (rows.length) {
      const { data: focusRow } = await supabase
        .from('children').select('math_focus').eq('id', childId).maybeSingle()
      const focus = focusRow?.math_focus
      if (focus?.topic_id) {
        const standing = await topicStanding(childId)
        const t = standing?.find(x => x.topic_id === focus.topic_id)
        if (t && t.attempts >= MASTERY_MIN_ATTEMPTS && t.accuracy >= MASTERY_CLEARS_AT) {
          await supabase.from('children').update({ math_focus: null }).eq('id', childId)
          focusCleared = { topic_name: t.topic_name || focus.topic_name, accuracy: t.accuracy, attempts: t.attempts }
        }
      }
    }

    if (gems > 0) {
      const { error: ledErr } = await supabase
        .from('bt_ledger').insert({ child_id: childId, amount: gems, reason: 'math' })
      if (ledErr) {
        console.error(`[MATH] ledger insert failed for ${childId}: ${ledErr.message}`)
        gems = 0
      }
    }

    // Whether every rewarded session is announced or only the day's first. This was hardcoded
    // to the first — three in an afternoon says no more than one does — but a parent who did a
    // second session and heard nothing experiences that as the notification being broken, and
    // prefs.notify_per_task has existed all along for exactly this decision with nothing
    // reading it. Default true: a parent who has never chosen hears about each session, which
    // is the behaviour they expect before they know there is a choice.
    const { data: prefsRow } = await supabase
      .from('parents').select('prefs').eq('id', child.parent_id).maybeSingle()
    const perTask = prefsRow?.prefs?.notify_per_task !== false
    if (gems > 0 && (perTask || doneToday === 0)) {
      const parentRow = prefsRow
      const language = parentRow?.prefs?.language === 'en' ? 'en' : 'tr'
      // Paper mode asks the model how the work actually went, and that read used to be
      // written to a column nothing has ever selected. "Strong at addition, word problems
      // need practice" is the sort of thing this product exists to tell a parent, so when
      // there is one it goes in the message rather than sitting in the table unread.
      const note = typeof gemini_notes === 'string' ? gemini_notes.trim().slice(0, 220) : ''
      const head = language === 'en'
        ? `${child.name} did their maths — ${questions_correct}/${questions_total} correct. +${gems} gems 💎`
        : `${child.name} matematiğini yaptı — ${questions_correct}/${questions_total} doğru. +${gems} gem 💎`
      sendNotification(child.parent_id, note ? `${head}\n\n${note}` : head).catch(() => {})
    }

    // A cleared focus is announced whatever else happened today. It is not routine progress —
    // it is the answer to something the parent asked for, and the once-a-day rule exists to
    // stop routine progress becoming noise, not to swallow this.
    if (focusCleared) {
      const { data: parentRow } = await supabase
        .from('parents').select('prefs').eq('id', child.parent_id).maybeSingle()
      const language = parentRow?.prefs?.language === 'en' ? 'en' : 'tr'
      const msg = language === 'en'
        ? `${child.name} has got on top of ${focusCleared.topic_name} — ${focusCleared.accuracy}% over the last ${focusCleared.attempts}. I've stopped weighting it. 🎉`
        : `${child.name} ${focusCleared.topic_name} konusunu toparladı — son ${focusCleared.attempts} soruda %${focusCleared.accuracy}. Ağırlığı kaldırdım. 🎉`
      sendNotification(child.parent_id, msg).catch(() => {})
    }

    res.json({ gems_earned: gems, capped, daily_cap: settings.dailyCap, level: newLevel, level_change: levelChange, focus_cleared: focusCleared })
  } catch (err) {
    console.error('[MATH]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Reading used to end in the browser: it worked out its own gems from a three-step ladder
// (30 / 15 / 5, ignoring whatever the parent had set), wrote the ledger itself, had no daily
// limit, and told the parent nothing. It also wrote the BOOK TITLE into the ledger's reason
// column, so a reading reward was indistinguishable from a spend named after a toy and never
// matched anything downstream that looked for a task. All of that is decided here now.
app.post('/api/children/:childId/reading-session', async (req, res) => {
  const { childId } = req.params
  const { book_id, book_title, questions_total, questions_correct, answers, page_photo_urls } = req.body
  try {
    const { data: child } = await supabase
      .from('children').select('id, name, parent_id, task_settings').eq('id', childId).maybeSingle()
    if (!child) return res.status(404).json({ error: 'child not found' })

    const settings = taskSettingsFor(child.task_settings, 'reading', READING_DEFAULTS)
    const tz = await tzForChild(childId)
    const doneToday = await rewardedToday(childId, tz, 'reading')

    const total = Math.max(0, Number(questions_total) || 0)
    const correct = Math.max(0, Math.min(total, Number(questions_correct) || 0))
    const acc = total > 0 ? Math.round((correct / total) * 100) : 0

    let gems = 0
    let capped = false
    if (!settings.active || doneToday === null || doneToday >= settings.dailyCap) {
      capped = true
    } else {
      gems = Math.round(settings.gems * rewardScale(acc))
    }

    // The questions were already being stored and the child's answers were not, which made
    // the stored half useless: a list of questions with no way to know how they went. They
    // go in together, in the jsonb column that was already there.
    const qa = Array.isArray(answers) ? answers.slice(0, 20).map(a => ({
      question: String(a?.question ?? '').slice(0, 400),
      type: a?.type === 'oe' ? 'oe' : 'mc',
      options: Array.isArray(a?.options) ? a.options.slice(0, 6).map(o => String(o).slice(0, 200)) : null,
      correct_answer: a?.correct_answer == null ? null : String(a.correct_answer).slice(0, 200),
      child_answer: a?.child_answer == null ? null : String(a.child_answer).slice(0, 400),
      was_correct: !!a?.was_correct,
    })) : []

    const { data: sub, error: subErr } = await supabase.from('submissions').insert({
      child_id: childId,
      task_type: 'reading',
      status: 'approved',       // nothing here needs the parent to decide anything
      score: acc,
      gems_earned: gems,
      feedback: book_title ? `Read "${String(book_title).slice(0, 120)}"` : 'Reading',
      generated_questions: qa,
      photo_urls: Array.isArray(page_photo_urls) ? page_photo_urls.slice(0, 12) : [],
    }).select('id').maybeSingle()
    if (subErr) return res.status(500).json({ error: subErr.message })

    if (gems > 0) {
      const { error: ledErr } = await supabase
        .from('bt_ledger').insert({ child_id: childId, amount: gems, reason: 'reading' })
      if (ledErr) {
        console.error(`[READING] ledger insert failed for ${childId}: ${ledErr.message}`)
        gems = 0
      }
    }

    if (book_id) {
      const { data: bookRow } = await supabase
        .from('books').select('current_page').eq('id', book_id).maybeSingle()
      if (bookRow) {
        await supabase.from('books')
          .update({ current_page: (bookRow.current_page ?? 0) + 1 }).eq('id', book_id)
      }
    }

    // Same rule as maths, including the preference: every rewarded session or only the day's
    // first. Which book it was is the part a parent actually wants — it is the one thing here
    // they could not have guessed.
    const { data: parentRow } = await supabase
      .from('parents').select('prefs').eq('id', child.parent_id).maybeSingle()
    if (gems > 0 && (parentRow?.prefs?.notify_per_task !== false || doneToday === 0)) {
      const language = parentRow?.prefs?.language === 'en' ? 'en' : 'tr'
      const title = book_title ? String(book_title).slice(0, 120) : null
      const msg = language === 'en'
        ? `${child.name} read${title ? ` "${title}"` : ''} — ${correct}/${total} on the questions. +${gems} gems 💎`
        : `${child.name} kitap okudu${title ? ` — "${title}"` : ''} — sorularda ${correct}/${total}. +${gems} gem 💎`
      sendNotification(child.parent_id, msg).catch(() => {})
    }

    res.json({ gems_earned: gems, capped, daily_cap: settings.dailyCap, accuracy: acc, submission_id: sub?.id ?? null })
  } catch (err) {
    console.error('[READING]', err.message)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/children/:childId/paintings', async (req, res) => {
  const { childId } = req.params
  try {
    const { photo_base64, mime_type, drawing_id, age_group } = req.body

    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!UUID.test(childId)) return res.status(400).json({ error: 'invalid child id' })

    if (typeof photo_base64 !== 'string' || !photo_base64) {
      return res.status(400).json({ error: 'photo required' })
    }

    // Uploading is expensive (safety screen + storage), so it gets the same
    // kind of budget as the Gemini proxy.
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip
    if (overLimit(`paint-ip:${ip}`, 40) || overLimit(`paint-child:${childId}`, 20)) {
      return res.status(429).json({ error: 'rate limited' })
    }

    const { data: child } = await supabase
      .from('children')
      .select('id, name, age, parent_id, task_settings')
      .eq('id', childId)
      .maybeSingle()
    if (!child) return res.status(404).json({ error: 'child not found' })

    let buffer
    try {
      buffer = Buffer.from(photo_base64, 'base64')
    } catch {
      return res.status(400).json({ error: 'invalid photo' })
    }
    if (!buffer?.length || buffer.length > 8 * 1024 * 1024) {
      return res.status(400).json({ error: 'invalid photo' })
    }

    const contentType = mime_type === 'image/png' ? 'image/png'
      : mime_type === 'image/webp' ? 'image/webp'
      : 'image/jpeg'

    // Screen BEFORE storing — a rejected image never reaches the bucket, so
    // there is nothing to clean up and nothing to leak.
    const { data: parentRow } = await supabase
      .from('parents').select('prefs').eq('id', child.parent_id).maybeSingle()
    const language = parentRow?.prefs?.language === 'en' ? 'en' : 'tr'
    const safety = await screenImageSafety({
      images: [{ buffer, mimeType: contentType }], kind: 'drawing', language,
    })
    if (!safety.appropriate) {
      console.log(`[DRAWING] inappropriate image child=${childId} — blocked (${safety.reason})`)
      // Held, not destroyed. Telling a parent their child uploaded something unsuitable and
      // then that it cannot be shown is the worst of both: they are alarmed and have no way to
      // judge it for themselves — and "unsuitable" is usually a screenshot or a photo of the
      // room, not something a parent needs protecting from. It goes to the same private bucket
      // as everything else, marked blocked so nothing treats it as a drawing, and is deleted
      // after a week whether they look or not.
      let heldPath = null
      try {
        const ext0 = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'
        heldPath = `${childId}/blocked/${randomUUID()}.${ext0}`
        const { error: hErr } = await supabase.storage
          .from(PAINTING_BUCKET).upload(heldPath, buffer, { contentType, upsert: false })
        if (hErr) { console.error(`[DRAWING] hold failed: ${hErr.message}`); heldPath = null }
        else {
          const { error: rErr } = await supabase.from('paintings').insert({
            child_id: childId, drawing_id: drawing_id ?? null, photo_path: heldPath, status: 'blocked',
          })
          if (rErr) { console.error(`[DRAWING] hold row failed: ${rErr.message}`); heldPath = null }
        }
      } catch (err) { console.error(`[DRAWING] hold error: ${err.message}`); heldPath = null }

      try {
        const canSee = heldPath
          ? (language === 'en'
              ? ' I have kept it for a week in case you want to see it — just ask.'
              : ' Bir hafta boyunca sakladım, görmek istersen söylemen yeterli.')
          : ''
        await sendNotification(child.parent_id, (language === 'en'
          ? `${child.name} tried to upload a drawing photo that isn't appropriate for a kids' app. I did not save it as a drawing or show it to anyone.`
          : `${child.name} çizim olarak uygun olmayan bir görsel yüklemeye çalıştı. Çizim olarak kaydetmedim ve kimseyle paylaşmadım.`) + canSee)
      } catch (err) {
        console.error(`[DRAWING] inappropriate alert failed: ${err.message}`)
      }
      return res.status(400).json({
        error: 'photo_rejected',
        message: language === 'en'
          ? "I couldn't save that photo. Want to take another one?"
          : 'Bu fotoğrafı kaydedemedim. Başka bir tane çeker misin?',
      })
    }

    // Service-role write into the private bucket. The path is built here, so it
    // cannot point at another child's folder.
    const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'
    const photo_path = `${childId}/${randomUUID()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from(PAINTING_BUCKET)
      .upload(photo_path, buffer, { contentType, upsert: false })
    if (upErr) {
      console.error(`[DRAWING] upload failed for child=${childId}: ${upErr.message}`)
      return res.status(500).json({ error: 'could not save the photo' })
    }

    // A drawing_id must exist in the catalogue; anything else is free-draw.
    let resolvedDrawing = null
    if (drawing_id) {
      const { data: d } = await supabase
        .from('drawings')
        .select('id, age_group, name_tr, name_en, step_count')
        .eq('id', drawing_id)
        .eq('age_group', age_group || '6-8')
        .maybeSingle()
      resolvedDrawing = d || null
    }

    // The drawing lands PENDING. No gems here — not even a provisional entry:
    // the amount is decided when the parent approves, so there is nothing for a
    // client to influence at upload time.
    const { data: painting, error: insErr } = await supabase
      .from('paintings')
      .insert({
        child_id: childId,
        drawing_id: resolvedDrawing?.id ?? null,
        age_group: resolvedDrawing?.age_group ?? (age_group || null),
        photo_path,
        status: 'pending',
        reward_amount: 0,
      })
      .select('id, drawing_id, age_group, photo_path, status, reward_amount, created_at')
      .single()
    if (insErr) return res.status(500).json({ error: insErr.message })

    // Passive transparency plus the ask: the parent sees the photo AND is told
    // it is waiting on them. Same boundary-signing as homework — the URL is
    // short-lived and Telegram re-hosts the image immediately.
    try {
      const what = resolvedDrawing ? `"${resolvedDrawing.name_tr}" çizimini` : 'kendi çizimini'
      await sendNotificationWithPhoto(
        child.parent_id,
        `🎨 ${child.name} ${what} bitirdi ve fotoğrafını ekledi.\n\n` +
        `Onaylarsan ödülü ekleyeyim — "onayla" diyebilir ya da panelden bakabilirsin.`,
        photo_path,
        PAINTING_BUCKET,
      )
    } catch (err) {
      console.error(`[DRAWING] parent notification failed: ${err.message}`)
    }

    res.status(201).json({
      painting: { ...painting, photo: await signedUrlFor(photo_path, 3600, PAINTING_BUCKET) },
      status: 'pending',
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Decides and pays out a drawing's reward. This is the ONLY place a drawing
// writes to bt_ledger, and it runs only after the caller is proven to be the
// child's parent. The amount comes from settings, never from the request.
async function approvePaintingById(paintingId, parentId) {
  const { data: painting } = await supabase
    .from('paintings')
    .select('id, child_id, drawing_id, status, photo_path')
    .eq('id', paintingId)
    .maybeSingle()
  if (!painting) return { success: false, error: 'not found' }
  if (painting.status !== 'pending') return { success: false, error: `already ${painting.status}` }

  const { data: child } = await supabase
    .from('children')
    .select('id, name, parent_id, task_settings')
    .eq('id', painting.child_id)
    .maybeSingle()
  if (!child || child.parent_id !== parentId) return { success: false, error: 'forbidden' }

  const settings = drawingSettings(child.task_settings)
  const tz = await tzForChild(child.id)
  const rewardedToday = await rewardedDrawingsToday(child.id, tz)

  // The cap is applied at APPROVAL time, because that is when gems move. Fails
  // closed: if the count can't be read, approve the drawing but pay nothing.
  let awarded = 0
  let capped = false
  if (!settings.active || rewardedToday === null || rewardedToday >= settings.dailyCap) {
    capped = true
  } else {
    awarded = settings.gems
  }

  const { error: updErr } = await supabase
    .from('paintings')
    .update({ status: 'approved', reward_amount: awarded, approved_at: new Date().toISOString() })
    .eq('id', painting.id)
    .eq('status', 'pending')  // guard against a concurrent approval racing us
  if (updErr) return { success: false, error: updErr.message }

  if (awarded > 0) {
    const { error: ledErr } = await supabase
      .from('bt_ledger')
      .insert({ child_id: child.id, amount: awarded, reason: 'drawing' })
    if (ledErr) {
      console.error(`[DRAWING] ledger insert failed for ${painting.id}: ${ledErr.message}`)
      await supabase.from('paintings').update({ reward_amount: 0 }).eq('id', painting.id)
      return { success: false, error: 'reward could not be recorded' }
    }
  }

  return { success: true, id: painting.id, childName: child.name, gems: awarded, capped }
}

async function rejectPaintingById(paintingId, parentId) {
  const { data: painting } = await supabase
    .from('paintings')
    .select('id, child_id, status')
    .eq('id', paintingId)
    .maybeSingle()
  if (!painting) return { success: false, error: 'not found' }
  if (painting.status !== 'pending') return { success: false, error: `already ${painting.status}` }

  const { data: child } = await supabase
    .from('children').select('id, name, parent_id').eq('id', painting.child_id).maybeSingle()
  if (!child || child.parent_id !== parentId) return { success: false, error: 'forbidden' }

  // Rejected drawings stay in the library — the child keeps the picture, it
  // just doesn't earn. Nothing is deleted.
  const { error } = await supabase
    .from('paintings')
    .update({ status: 'rejected', reward_amount: 0 })
    .eq('id', painting.id)
    .eq('status', 'pending')
  if (error) return { success: false, error: error.message }
  return { success: true, id: painting.id, childName: child.name }
}

// Dashboard approve/reject. Parent JWT + ownership, both checked inside.
async function paintingActionRoute(req, res, action) {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
    if (!token) return res.status(401).json({ error: 'unauthorized' })
    const { data: userData, error: authErr } = await supabase.auth.getUser(token)
    const userId = userData?.user?.id
    if (authErr || !userId) return res.status(401).json({ error: 'unauthorized' })

    const result = await action(req.params.id, userId)
    if (!result.success) {
      const code = result.error === 'forbidden' ? 403 : result.error === 'not found' ? 404 : 400
      return res.status(code).json({ error: result.error })
    }
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

app.post('/api/paintings/:id/approve', (req, res) => paintingActionRoute(req, res, approvePaintingById))
app.post('/api/paintings/:id/reject', (req, res) => paintingActionRoute(req, res, rejectPaintingById))

// Dashboard's "gift gems" button — same tool the Telegram agent calls, same
// ownership check, just reached with a parent JWT instead of a chat-scoped id.
app.post('/api/children/:childId/gift-gems', async (req, res) => {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
    if (!token) return res.status(401).json({ error: 'unauthorized' })
    const { data: userData, error: authErr } = await supabase.auth.getUser(token)
    const userId = userData?.user?.id
    if (authErr || !userId) return res.status(401).json({ error: 'unauthorized' })

    const result = await giftGemsTool(req.params.childId, req.body.amount, userId, req.body.note)
    if (!result.success) {
      const code = result.error === 'forbidden' ? 403 : result.error === 'child not found' ? 404 : 400
      return res.status(code).json({ error: result.error })
    }
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Dashboard counterpart to the deduct_gems Telegram tool — same use case as
// gift-gems but the other direction (e.g. a parent already bought the toy
// outside the app and wants the balance to reflect it without the child
// ever tapping Claim).
app.post('/api/children/:childId/deduct-gems', async (req, res) => {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
    if (!token) return res.status(401).json({ error: 'unauthorized' })
    const { data: userData, error: authErr } = await supabase.auth.getUser(token)
    const userId = userData?.user?.id
    if (authErr || !userId) return res.status(401).json({ error: 'unauthorized' })

    const result = await deductGemsTool(req.params.childId, req.body.amount, userId, req.body.note)
    if (!result.success) {
      const code = result.error === 'forbidden' ? 403 : result.error === 'child not found' ? 404 : 400
      return res.status(code).json({ error: result.error })
    }
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// The child's own library. The photos are in a private bucket with no client
// read policy, so the server signs each one; the child app has no session and
// could not read them any other way.
app.get('/api/children/:childId/paintings', async (req, res) => {
  const { childId } = req.params
  try {
    const { data, error } = await supabase
      .from('paintings')
      .select('id, drawing_id, age_group, photo_path, status, reward_amount, created_at')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(60)
    if (error) return res.status(500).json({ error: error.message })

    const paintings = await Promise.all((data || []).map(async p => ({
      id: p.id,
      drawing_id: p.drawing_id,
      age_group: p.age_group,
      status: p.status,
      reward_amount: p.reward_amount,
      created_at: p.created_at,
      photo: await signedUrlFor(p.photo_path, 3600, PAINTING_BUCKET),
    })))
    res.json({ paintings })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Parent-side view of a child's paintings. Unlike the child route this proves
// WHO is asking — parent JWT plus ownership of that child.
app.get('/api/parent/children/:childId/paintings', async (req, res) => {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
    if (!token) return res.status(401).json({ error: 'unauthorized' })

    const { data: userData, error: authErr } = await supabase.auth.getUser(token)
    const userId = userData?.user?.id
    if (authErr || !userId) return res.status(401).json({ error: 'unauthorized' })

    const { data: child } = await supabase
      .from('children').select('id, parent_id').eq('id', req.params.childId).maybeSingle()
    // parents.id IS the auth user id, so this is the check.
    if (!child || child.parent_id !== userId) return res.status(403).json({ error: 'forbidden' })

    const { data } = await supabase
      .from('paintings')
      .select('id, drawing_id, photo_path, status, reward_amount, created_at')
      .eq('child_id', child.id)
      .order('created_at', { ascending: false })
      .limit(60)

    const paintings = await Promise.all((data || []).map(async p => ({
      id: p.id,
      drawing_id: p.drawing_id,
      status: p.status,
      reward_amount: p.reward_amount,
      created_at: p.created_at,
      photo: await signedUrlFor(p.photo_path, 3600, PAINTING_BUCKET),
    })))
    res.json({ paintings })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/children/:childId/spelling-errors', async (req, res) => {
  const { childId } = req.params
  const { errors } = req.body
  if (errors?.length) {
    await supabase.from('spelling_errors').insert(errors.map(e => ({ child_id: childId, ...e })))
  }
  res.json({ ok: true })
})

app.post('/api/send-welcome', async (req, res) => {
  const { parentId } = req.body
  if (!parentId) return res.status(400).json({ error: 'parentId required' })

  try {
    const [{ data: parent }, { data: children }] = await Promise.all([
      supabase.from('parents').select('notification_channel, telegram_chat_id, prefs').eq('id', parentId).single(),
      supabase.from('children').select('name').eq('parent_id', parentId).order('created_at').limit(1),
    ])

    const childName = children?.[0]?.name || 'your child'
    const language = parent?.prefs?.language === 'en' ? 'en' : 'tr'

    const message = language === 'en'
      ? `👋 Hi! I'm Tuto, ${childName}'s learning companion!\n\nI'll keep you updated here as ${childName} completes tasks. 🎉\n\nFeel free to message me anytime — you can ask about ${childName}'s progress, earned Gems, and more! 💎`
      : `👋 Merhaba! Ben Tuto, ${childName}'in öğrenme arkadaşı!\n\n${childName} görevlerini tamamladıkça sizi buradan haberdar edeceğim. 🎉\n\nBana istediğiniz zaman yazabilirsiniz — ${childName}'in gelişimini, kazandığı Gems'leri ve daha fazlasını sorabilirsiniz! 💎`

    const channel = parent?.notification_channel
    if (channel === 'telegram' && parent?.telegram_chat_id) {
      await sendTelegramMessage(parent.telegram_chat_id, message)
      console.log(`[WELCOME] Sent via Telegram to parent ${parentId}`)
    } else if (channel === 'whatsapp' && parent?.whatsapp_phone) {
      await sendWhatsAppBusinessMessage(parent.whatsapp_phone, message)
      console.log(`[WELCOME] Sent via WhatsApp to parent ${parentId}`)
    } else {
      console.log(`[WELCOME] No channel configured for parent ${parentId} — skipped`)
    }

    res.json({ success: true })
  } catch (err) {
    console.error('[send-welcome]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── WhatsApp connect flow ───────────────────────────────────────────────────
// Parent taps "Connect WhatsApp" → we mint a short code and a wa.me deep link
// → they send it from their own phone (same-device, no QR) → our webhook
// reads the code out of their first message and links whatsapp_phone to this
// parent. The code is the only proof of ownership; nothing is ever written
// from a client-submitted phone number the way the old, abandoned flow did.
function generateConnectCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O or 1/I — easy to misread when copied off a screen
  let code = ''
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

app.post('/api/whatsapp/connect-code', async (req, res) => {
  const { parentId } = req.body
  if (!parentId) return res.status(400).json({ error: 'parentId required' })
  if (!TWILIO_WHATSAPP_NUMBER) return res.status(500).json({ error: 'WhatsApp sender not configured' })

  try {
    const code = generateConnectCode()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    const { error } = await supabase
      .from('parents')
      .update({ whatsapp_connect_code: code, whatsapp_connect_code_expires_at: expiresAt })
      .eq('id', parentId)
    if (error) throw error

    const text = encodeURIComponent(`Merhaba Tuto, kodum: ${code}`)
    const waLink = `https://wa.me/${TWILIO_WHATSAPP_NUMBER.replace('+', '')}?text=${text}`
    res.json({ code, waLink })
  } catch (err) {
    console.error('[whatsapp-connect-code]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Polled by the onboarding/dashboard UI after the parent taps the wa.me link.
// "Connected" means the webhook below actually matched and cleared THIS
// code — not just "whatsapp_phone is non-null", since a stale unverified
// value can already be sitting there from the old abandoned flow.
app.get('/api/whatsapp/connect-status', async (req, res) => {
  const { parentId, code } = req.query
  if (!parentId || !code) return res.status(400).json({ error: 'parentId and code required' })

  const { data } = await supabase
    .from('parents')
    .select('whatsapp_connect_code, whatsapp_phone')
    .eq('id', parentId)
    .maybeSingle()

  const connected = data?.whatsapp_connect_code !== code
  res.json({ connected, whatsappPhone: connected ? data?.whatsapp_phone : null })
})

// Incoming WhatsApp messages, via Twilio.
app.post('/webhook/whatsapp', async (req, res) => {
  res.type('text/xml').send('<Response></Response>') // acknowledge immediately, no auto-reply

  try {
    const signature = req.headers['x-twilio-signature']
    const url = `https://${req.get('host')}${req.originalUrl}`
    if (!process.env.TWILIO_AUTH_TOKEN || !twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN, signature, url, req.body)) {
      console.log('[WA] Webhook signature invalid — dropping')
      return
    }

    const from = (req.body.From || '').replace('whatsapp:', '') // E.164, e.g. "+905XXXXXXXXX"
    const text = (req.body.Body || '').trim()
    if (!from || !text) return

    console.log(`[WA] Incoming from ${from}: "${text}"`)

    // Already-connected parent writing back in — route through the normal brain.
    // Gated on whatsapp_verified_at specifically (not just whatsapp_phone being
    // set), so a stale, never-actually-verified number from the old abandoned
    // flow can't be treated as a live connection.
    const { data: existing } = await supabase
      .from('parents')
      .select('id')
      .eq('whatsapp_phone', from)
      .not('whatsapp_verified_at', 'is', null)
      .limit(1)
    if (existing?.[0]?.id) {
      // Same shape as Telegram: a person reads before they start typing, so the bubble is
      // delayed about a second — and it must not hold up Gemini, so it runs alongside rather
      // than before.
      // Twilio's WhatsApp webhook sends SmsMessageSid and SmsSid, never MessageSid — worth
      // saying, because the obvious guess is wrong and the fallback is what saved it.
      const inboundSid = req.body.MessageSid || req.body.SmsMessageSid || req.body.SmsSid
      setTimeout(() => sendWhatsAppTyping(inboundSid).catch(() => {}), 800 + Math.random() * 700)
      await handleMessage(existing[0].id, reply => sendWhatsAppBusinessMessage(from, reply), text)
      return
    }

    // Otherwise this is (hopefully) a first-contact message carrying a connect
    // code. A plain "first 5-char alnum run in the message" regex is a trap —
    // it happily matches "MERHA" out of "Merhaba" before ever reaching the
    // real code. Pull out every whole-word 5-char candidate instead and let
    // the DB decide which one (if any) is a real pending code.
    const candidates = [...new Set(text.toUpperCase().match(/\b[A-Z0-9]{5}\b/g) || [])]
    if (!candidates.length) {
      await sendWhatsAppBusinessMessage(from, 'Merhaba! Bağlanmak için Tuto uygulamasındaki "WhatsApp\'tan Bağlan" adımından gelen kodu göndermen gerekiyor. / Hi! To connect, please send the code from the "Connect WhatsApp" step in the Tuto app.')
      return
    }

    // `name` is not a column on parents — selecting it returned a 400, which arrives here as
    // a null row and is indistinguishable from "no such code". Every valid code was answered
    // "invalid or expired". It was never read either; the greeting uses the child's name.
    const { data: parent, error: lookupErr } = await supabase
      .from('parents')
      .select('id, prefs, notification_channel')
      .in('whatsapp_connect_code', candidates)
      .gt('whatsapp_connect_code_expires_at', new Date().toISOString())
      .maybeSingle()

    // A failed READ is not a wrong code, and telling a parent their code is invalid when the
    // database would not answer is how this went unnoticed. They are answered differently.
    if (lookupErr) {
      console.error(`[WA] connect lookup failed: ${lookupErr.message}`)
      await sendWhatsAppBusinessMessage(from, 'Şu an bağlanamadım, birazdan tekrar dener misin? / I could not connect just now — please try again shortly.')
      return
    }
    if (!parent) {
      await sendWhatsAppBusinessMessage(from, 'Bu kod geçersiz ya da süresi dolmuş. Uygulamadan tekrar dener misin? / This code is invalid or expired — please try again from the app.')
      return
    }

    const { data: children } = await supabase.from('children').select('name').eq('parent_id', parent.id).order('created_at').limit(1)
    const childName = children?.[0]?.name || 'çocuğunuzun'
    const language = parent?.prefs?.language === 'en' ? 'en' : 'tr'

    await supabase
      .from('parents')
      .update({
        whatsapp_phone: from,
        whatsapp_verified_at: new Date().toISOString(),
        whatsapp_connect_code: null,
        whatsapp_connect_code_expires_at: null,
        // Connecting WhatsApp means messages come to WhatsApp. This used to set the channel
        // only when there was not one already — and the column defaults to 'telegram', so
        // there always was: every parent who connected WhatsApp stayed on Telegram, including
        // one who had both connected and never saw a WhatsApp message. Sending a code to this
        // number is an explicit act; it decides the channel.
        notification_channel: 'whatsapp',
      })
      .eq('id', parent.id)

    // Says plainly that this moves the messages, since a parent who also had Telegram will
    // otherwise wonder why it went quiet.
    const confirmMsg = language === 'en'
      ? `Hi! You're now connected to ${childName}'s Tuto account 🎉 I'll message you here from now on — not on Telegram.`
      : `Merhaba! ${childName} hesabına bağlandın 🎉 Bundan sonra Telegram yerine buradan haber vereceğim.`
    await sendWhatsAppBusinessMessage(from, confirmMsg)
    console.log(`[WA] Connected parent ${parent.id} → ${from}`)
  } catch (err) {
    console.error('[WA] Webhook error:', err.message)
  }
})

app.listen(3000, async () => {
  console.log('Tuto sunucusu port 3000\'de çalışıyor.')
  // Photo retention — homework/chore images are deleted once past the window
  // (PHOTO_RETENTION_DAYS, default 60). Runs at boot and daily thereafter.
  const purgeAll = async () => {
    await purgeOldPhotos().catch(err => console.error(`[PURGE] ${err.message}`))
    await purgeHeldImages().catch(err => console.error(`[PURGE] held: ${err.message}`))
  }
  purgeAll()
  setInterval(purgeAll, 24 * 60 * 60 * 1000)
  startTelegramBot()
  setupMessageListener()
})
