// Run from server/ directory:
//   node jobs/generateStoryIdeas.js
//
// Railway cron: Settings → Cron Jobs → command: node jobs/generateStoryIdeas.js
// Recommended schedule: "0 3 * * *" (daily at 03:00 UTC, off-peak).
// No in-process scheduler — this script exits when done.

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

// ── Config ────────────────────────────────────────────────────────────────────
const BANDS    = ['5-7', '8-10', '11+']
const PER_RUN  = 8   // candidates to generate per band
const CAP      = 200 // max active global ideas per band

const BANNED = [
  'kill', 'murder', 'blood', 'gore', 'stab', 'shooting', 'gunshot', 'gun', 'weapon', 'dead body',
  'suicide', 'self-harm', 'overdose',
  'sex', 'sexual', 'naked', 'nude', 'porn', 'rape', 'molest',
  'drug', 'cocaine', 'heroin', 'meth', 'alcohol', 'drunk', 'weed', 'marijuana',
  'abuse', 'torture', 'trafficking', 'prostitut',
]

function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

// Each term tested as \b<word>s?\b — whole-word + optional plural.
// \b prevents "gun" matching "begun", "sex" matching "sextant", etc.
const BANNED_PATTERNS = BANNED.map(w => ({
  word: w,
  re: new RegExp(`\\b${escapeRegExp(w)}s?\\b`, 'i'),
}))

// ── Clients ───────────────────────────────────────────────────────────────────
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY } = process.env

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!GEMINI_API_KEY) {
  console.error('Missing GEMINI_API_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
const SAFETY = [
  { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
]

async function geminiJSON(prompt) {
  const res = await fetch(`${GEMINI_BASE}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { response_mime_type: 'application/json' },
      safetySettings: SAFETY,
    }),
  })
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`)
  const data = await res.json()
  // Blocked by safety filters → no candidates
  if (!data.candidates?.length) throw new Error('Gemini response blocked or empty')
  let raw = data.candidates[0].content.parts[0].text.trim()
  // Strip optional ```json ... ``` fences the model sometimes adds
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  // Extract outermost JSON value ({...} or [...]) in case of trailing prose
  const objMatch = raw.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
  if (objMatch) raw = objMatch[1]
  return JSON.parse(raw)
}

// ── Band metadata ─────────────────────────────────────────────────────────────
const BAND_META = {
  '5-7': {
    label: 'ages 5–7 (early readers)',
    tone: 'whimsical, warm, simple language, happy endings',
    themes: 'animals with feelings, magic objects, friendship, gentle adventure, food worlds, small heroes',
  },
  '8-10': {
    label: 'ages 8–10 (confident readers)',
    tone: 'exciting, curious, age-appropriate mystery and suspense',
    themes: 'mystery, kid detectives, time travel, supernatural powers, friendship challenges, animal stories',
  },
  '11+': {
    label: 'ages 11 and up (young adult edge)',
    tone: 'thoughtful, layered, emotionally resonant, can explore moral complexity',
    themes: 'dystopia, sci-fi, identity, family secrets, nature-vs-human, technology ethics',
  },
}

const PROHIBITED = `
STRICTLY PROHIBITED (automatic rejection):
- Violence, gore, graphic harm, weapons used on people
- Sexual or romantic content of any kind
- Self-harm, suicide, eating disorders
- Drugs, alcohol, substance abuse
- Age-inappropriate horror or trauma (e.g. child abuse, trafficking)
- Adult or explicitly dark themes
`.trim()

// ── Step 1: fetch existing titles for diversity hint ─────────────────────────
async function fetchExistingTitles(band) {
  const { data } = await supabase
    .from('story_ideas')
    .select('title')
    .eq('age_band', band)
    .eq('status', 'active')
    .eq('scope', 'global')
    .limit(30)
  return (data || []).map(r => r.title)
}

// ── Step 2: generation prompt ─────────────────────────────────────────────────
function buildGenerationPrompt(band, existingTitles) {
  const { label, tone, themes } = BAND_META[band]
  const avoid = existingTitles.length
    ? `Do NOT repeat or closely resemble these existing titles: ${existingTitles.join(', ')}.`
    : ''
  return `
You are generating story starter ideas for children, age band: ${label}.
Tone: ${tone}.
Allowed theme categories: ${themes}.

${PROHIBITED}

Generate exactly ${PER_RUN} original story ideas as a JSON array.
Each item: { "emoji": string, "title": string, "topic": string, "description": string }
- emoji: 1 relevant emoji
- title: short (2–4 words), evocative
- topic: exactly 1 sentence — concrete, specific, age-appropriate. Name the protagonist,
  the situation, and the direction of the story. Avoid vague phrases like "shattering
  discovery" or "severe repercussions". The sentence should make the tone and resolution
  direction obvious (hope, curiosity, adventure, problem-to-solve).
- description: 1–2 sentences of flavour / hook (can be empty string if nothing to add)

${avoid}

Return ONLY the JSON array, no markdown, no extra text.
`.trim()
}

// ── Step 3a: deterministic gate ───────────────────────────────────────────────
function deterministicGate(candidate) {
  const { emoji, title, topic } = candidate
  if (!emoji || !title || !topic) return { ok: false, reason: 'missing fields' }
  if (title.length > 80)         return { ok: false, reason: 'title too long' }
  if (topic.length > 300)        return { ok: false, reason: 'topic too long' }
  const combined = `${title} ${topic} ${candidate.description || ''}`
  for (const { word, re } of BANNED_PATTERNS) {
    if (re.test(combined)) return { ok: false, reason: `banned keyword "${word}"` }
  }
  if (/https?:\/\//i.test(combined)) return { ok: false, reason: 'URL in content' }
  // Reject if it looks like an instruction leak
  if (/return json|generate|output only|as an ai/i.test(combined))
    return { ok: false, reason: 'instruction bleed' }
  return { ok: true }
}

// ── Step 3b: moderation call ──────────────────────────────────────────────────
function buildModerationPrompt(band, candidate) {
  const { label } = BAND_META[band]
  const ALLOWED_THEMES = {
    '5-7':  'animals with feelings, magic objects, friendship, gentle adventure, food worlds, small heroes',
    '8-10': 'mystery, kid detectives, time travel, supernatural powers, friendship conflicts, animal stories. Mild spookiness or suspense (Goosebumps level) is APPROPRIATE for this band.',
    '11+':  'dystopia, sci-fi, identity, family secrets, nature-vs-human conflict, technology ethics. Thought-provoking or dystopian fiction, existential/identity themes, and family-mystery plots are NORMAL for this age — they should pass.',
  }
  return `
You are a content moderator for a children's educational app.
Age band: ${label}.

ALLOWED theme categories for this band (these are pre-approved; ideas in these categories should PASS unless they contain concrete prohibited content):
${ALLOWED_THEMES[band]}

The standard is the app's own seed library. Do NOT apply a stricter bar than the seed library already sets.

Evaluate this story idea:
Title: ${candidate.title}
Topic: ${candidate.topic}
Description: ${candidate.description || ''}

${PROHIBITED}

REJECTION RULES:
- Reject ONLY if a prohibited item above is concretely present in the text.
- Reject if the topic is so vague that intent cannot be determined.
- Do NOT reject solely because a theme is ambitious, dark-toned, or thought-provoking — those are appropriate for the stated band.
- "When in doubt" means doubt about concrete prohibited content, NOT doubt about whether a theme is bold.

Respond ONLY with this JSON: { "verdict": "approve" | "reject", "reason": "string" }
No markdown, no extra text. When in doubt about prohibited content: reject.
`.trim()
}

async function moderationGate(band, candidate) {
  try {
    const result = await geminiJSON(buildModerationPrompt(band, candidate))
    if (result?.verdict === 'approve') return { ok: true, reason: result.reason }
    return { ok: false, reason: result?.reason || 'moderation rejected' }
  } catch (err) {
    // fail closed
    return { ok: false, reason: `moderation error: ${err.message}` }
  }
}

// ── Step 4: insert with dedup ─────────────────────────────────────────────────
async function insertIdea(band, candidate) {
  const row = {
    age_band:    band,
    emoji:       candidate.emoji,
    title:       candidate.title,
    topic:       candidate.topic,
    description: candidate.description || null,
    scope:       'global',
    source:      'generated',
    status:      'active',
  }
  const { error } = await supabase.from('story_ideas').insert(row)
  if (!error)                          return 'inserted'
  if (error.code === '23505')          return 'dup'
  console.error('  Insert error:', error.message)
  return 'error'
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function processBand(band) {
  console.log(`\n── Band ${band} ──`)

  // Check cap
  const { count } = await supabase
    .from('story_ideas')
    .select('*', { count: 'exact', head: true })
    .eq('age_band', band)
    .eq('status', 'active')
    .eq('scope', 'global')

  if (count >= CAP) {
    console.log(`  Skipped — at cap (${count}/${CAP})`)
    return { generated: 0, detPass: 0, approved: 0, inserted: 0, dup: 0, rejected: [] }
  }

  const existingTitles = await fetchExistingTitles(band)

  // Generate candidates
  let candidates = []
  try {
    const raw = await geminiJSON(buildGenerationPrompt(band, existingTitles))
    candidates = Array.isArray(raw) ? raw : []
  } catch (err) {
    console.error(`  Generation failed: ${err.message}`)
    return { generated: 0, detPass: 0, approved: 0, inserted: 0, dup: 0, rejected: [`generation error: ${err.message}`] }
  }
  console.log(`  Generated: ${candidates.length}`)

  const stats = { generated: candidates.length, detPass: 0, approved: 0, inserted: 0, dup: 0, rejected: [] }

  for (const candidate of candidates) {
    // Deterministic gate
    const det = deterministicGate(candidate)
    if (!det.ok) {
      stats.rejected.push(`[det] "${candidate.title}": ${det.reason}`)
      continue
    }
    stats.detPass++

    // Moderation gate
    const mod = await moderationGate(band, candidate)
    if (!mod.ok) {
      stats.rejected.push(`[mod] "${candidate.title}": ${mod.reason}`)
      continue
    }
    stats.approved++

    // Insert
    const result = await insertIdea(band, candidate)
    if (result === 'inserted') stats.inserted++
    else if (result === 'dup') stats.dup++
  }

  console.log(`  Det-pass: ${stats.detPass} | Approved: ${stats.approved} | Inserted: ${stats.inserted} | Dup-skipped: ${stats.dup}`)
  if (stats.rejected.length) {
    console.log('  Rejected:')
    stats.rejected.forEach(r => console.log(`    • ${r}`))
  }

  return stats
}

async function main() {
  console.log(`=== generateStoryIdeas — ${new Date().toISOString()} ===`)

  const totals = { generated: 0, detPass: 0, approved: 0, inserted: 0, dup: 0, rejected: 0 }

  for (const band of BANDS) {
    const s = await processBand(band)
    totals.generated += s.generated
    totals.detPass   += s.detPass
    totals.approved  += s.approved
    totals.inserted  += s.inserted
    totals.dup       += s.dup
    totals.rejected  += s.rejected.length
  }

  console.log('\n=== Summary ===')
  console.log(`Generated: ${totals.generated} | Det-pass: ${totals.detPass} | Approved: ${totals.approved} | Inserted: ${totals.inserted} | Dup-skipped: ${totals.dup} | Rejected: ${totals.rejected}`)
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
