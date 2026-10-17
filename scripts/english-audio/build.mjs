// Makes, checks and stores the English recordings listed in clips.mjs, for UK and US English.
//
//   GEMINI_API_KEY=… WHISPER_MODEL=~/.cache/whisper-cpp/ggml-base.en.bin node scripts/english-audio/build.mjs [--set trial|words] [--only id,id] [--takes 3] [--wait-quota]
//   GEMINI_API_KEY is for the listening model (and for --engine gemini); Chirp uses the gcloud login.
//   --set trial (default) | words (the Cambridge wordlist) | listening (the A4/A5 bank).
//   --wait-quota: at the daily quota, sleep until the API says it resets and go on (for unattended runs).
//   --no-qc: make only, one take, signal check only; status "unchecked" until --rejudge runs Whisper and the
//     listening model. For runs where the TTS rate is what matters.
//   --shard k/n: only every n-th clip from the k-th (0-based), so n processes can share one set.
//   TTS_GAP_MS: least time between TTS requests (default 6500, for the 10-a-minute free tier).
//
// Nothing here runs in the app: recordings are made once, checked, and stored as files the screen plays.
// For each clip and variety, up to --takes recordings are made; the first that passes all three checks in
// qc.mjs is kept. If none does, the best one is kept and marked "listen" or "fail" for a person.
// Already-accepted clips whose text, voice and model are unchanged are skipped (the id is a hash of them).
//
// Out:
//   public/english-audio/<id>.m4a                    AAC 32 kb/s mono; the name is a hash, never the word
//   scripts/english-audio/provenance/<id>.c2pa        the "made by AI" manifest Google appends to the audio
//   src/lib/literacy/audioManifest.generated.json    clip -> file, text, voice, checks, status

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, renameSync, rmdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { CLIPS as TRIAL_CLIPS, WORD_CLIPS, LISTENING_CLIPS, VOICES, SPEAKERS } from './clips.mjs'
import { checkSignal, checkAsr, judge } from './qc.mjs'
import { fetchRetry } from './net.mjs'

// --engine chirp (default, chosen 2026-10-17 by ear and by the checks) | gemini. Chirp = Google Cloud
// Text-to-Speech, Chirp 3 HD voices (same voice names as Gemini's). Cloud TTS takes no API key: it uses the gcloud login (gcloud auth application-default login,
// quota project set) and allows 200 requests a minute instead of Gemini TTS's 10 a minute / 100 a day.
const ENGINE = (() => { const i = process.argv.indexOf('--engine'); return i > 0 ? process.argv[i + 1] : 'chirp' })()
const MODEL = ENGINE === 'chirp' ? 'chirp3-hd' : 'gemini-3.8-flash-tts'
const LANG = { uk: 'en-GB', us: 'en-US' }
const OUT_AUDIO = 'public/english-audio'
const OUT_PROV = 'scripts/english-audio/provenance'
const MANIFEST = process.env.AUDIO_MANIFEST || 'src/lib/literacy/audioManifest.generated.json'   // another file for a trial engine
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d }
const ONLY = arg('only') ? new Set(arg('only').split(',')) : null
const TAKES = Number(arg('takes', 3))
const SET = arg('set', 'trial')
const SETS = { trial: TRIAL_CLIPS, words: WORD_CLIPS, listening: LISTENING_CLIPS }
const CLIPS = SETS[SET] || (() => { throw new Error(`--set ${SET}? (${Object.keys(SETS).join(', ')})`) })()
const IN_SET = new Set(CLIPS.map(c => c.id))
const WAIT_QUOTA = process.argv.includes('--wait-quota')
const NO_QC = process.argv.includes('--no-qc')
const GAP = Number(process.env.TTS_GAP_MS || 6500)
const [SHARD, SHARDS] = (arg('shard', '0/1')).split('/').map(Number)
const PAUSE = 0.45            // seconds between dialogue lines
const sleep = ms => new Promise(r => setTimeout(r, ms))

for (const d of [OUT_AUDIO, OUT_PROV]) mkdirSync(d, { recursive: true })
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {}

// Several shards write the one manifest: each write takes a lock (mkdir is atomic), re-reads the file so no
// other shard's entries are lost, sets its own entry and replaces the file whole.
function saveEntry(key, entry) {
  const lock = MANIFEST + '.lock'
  for (let i = 0; ; i++) {
    try { mkdirSync(lock); break } catch {
      if (i > 2000) throw new Error(`manifest lock stuck: remove ${lock}`)
      execFileSync('sleep', ['0.01'])
    }
  }
  try {
    const now = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {}
    now[key] = entry
    writeFileSync(MANIFEST + '.tmp', JSON.stringify(now, null, 1) + '\n')
    renameSync(MANIFEST + '.tmp', MANIFEST)
    Object.assign(manifest, now)
  } finally { rmdirSync(lock) }
}

function wav(pcm, rate = 24000) {
  const h = Buffer.alloc(44)
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12)
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24)
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([h, pcm])
}

// One line of speech. The API returns a WAV file: a "fmt " chunk, the "data" chunk, and a "C2PA" chunk with
// Google's "made by AI" manifest. Only the data chunk is sound; the manifest is kept beside the clip.
// (Read as one blob of samples, the C2PA chunk played as a 125 ms crackle and the header as a click.)
function splitWav(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF') return { pcm: buf, c2pa: null, rate: 24000 }   // raw PCM, older replies
  let off = 12, pcm = null, c2pa = null, rate = 24000
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4), size = buf.readUInt32LE(off + 4)
    const body = buf.subarray(off + 8, off + 8 + size)
    if (id === 'fmt ') rate = body.readUInt32LE(4)
    else if (id === 'data') pcm = body
    else if (id === 'C2PA') c2pa = buf.subarray(off, off + 8 + size)
    off += 8 + size + (size % 2)
  }
  if (!pcm) throw new Error('WAV without a data chunk')
  return { pcm, c2pa, rate }
}

let token = null, tokenAt = 0
function cloudToken() {
  if (!token || Date.now() - tokenAt > 30 * 60000) {
    token = execFileSync('gcloud', ['auth', 'application-default', 'print-access-token'], { encoding: 'utf8' }).trim()
    tokenAt = Date.now()
  }
  return token
}
async function speakChirp(text, voice, lang, tries = 5) {
  const r = await fetchRetry('https://texttospeech.googleapis.com/v1/text:synthesize', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${cloudToken()}`, 'x-goog-user-project': process.env.CLOUD_TTS_PROJECT || 'vertexli' },
    body: JSON.stringify({ input: { text }, voice: { languageCode: lang, name: `${lang}-Chirp3-HD-${voice}` },
      audioConfig: { audioEncoding: 'LINEAR16', sampleRateHertz: 24000 } }),
  })
  const j = await r.json()
  if ((r.status === 429 || r.status >= 500) && tries > 0) {
    console.log(`    ${r.status}, waiting 10 s (${String(j.error?.message || '').slice(0, 120)})`)
    await sleep(10000); return speakChirp(text, voice, lang, tries - 1)
  }
  if (!j.audioContent) throw new Error(`no audio: ${JSON.stringify(j.error || j).slice(0, 200)}`)
  return tidyTail(splitWav(Buffer.from(j.audioContent, 'base64')))     // a WAV with a header; no C2PA chunk here
}

// Chirp sometimes starts with 0.7 s of near-silence (the check allows 0.7 s): anything quieter than -45 dB
// before the first speech is cut to 0.15 s.
function trimHead(t) {
  const f = Math.round(t.rate * 0.01), n = t.pcm.length / 2
  let first = 0
  for (let i = 0; i + f <= n; i += f) {
    let e = 0
    for (let j = i; j < i + f; j++) { const x = t.pcm.readInt16LE(j * 2) / 32768; e += x * x }
    if (20 * Math.log10(Math.sqrt(e / f) || 1e-9) > -45) { first = i; break }
  }
  const keep = Math.round(t.rate * 0.15)
  if (first <= keep) return t
  return { ...t, pcm: t.pcm.subarray((first - keep) * 2) }
}

// Chirp ends on a breath / room tail around -40 dB instead of silence, which the "sound in the last 20 ms"
// check reads as a cut. A tail that quiet is not speech (speech is about -15 dB), so it is faded over 60 ms
// and 120 ms of silence added. A louder end (-30 dB or more: speech really cut off) is left for the check.
function tidyTail(t) {
  t = trimHead(t)
  const n = t.pcm.length / 2, last = Math.round(t.rate * 0.02)
  let e = 0
  for (let i = n - last; i < n; i++) { const x = t.pcm.readInt16LE(i * 2) / 32768; e += x * x }
  if (20 * Math.log10(Math.sqrt(e / last) || 1e-9) > -30) return t
  const pcm = Buffer.concat([Buffer.from(t.pcm), Buffer.alloc(Math.round(t.rate * 0.12) * 2)])
  const fade = Math.round(t.rate * 0.06)
  for (let k = 0; k < fade; k++) {
    const i = n - fade + k
    pcm.writeInt16LE(Math.round(pcm.readInt16LE(i * 2) * (1 - k / fade)), i * 2)
  }
  return { ...t, pcm }
}

class DailyQuota extends Error {}
let lastCall = 0
// TTS_KEYS: keys of several projects, comma-separated (default GEMINI_API_KEY). The TTS model's daily quota is
// per project, so when one project's day is used up the next key goes on; with all of them resting, the run
// waits for the first to come back (--wait-quota) or stops.
const KEYS = (process.env.TTS_KEYS || process.env.GEMINI_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean)
const restUntil = new Map()     // key -> time its daily quota comes back
async function speak(text, voice, lang, tries = 5) {
  const wait = GAP - (Date.now() - lastCall)              // the free tier allows 10 requests a minute
  if (wait > 0) await sleep(wait)
  let key = KEYS.find(k => (restUntil.get(k) || 0) <= Date.now())
  if (!key) {
    const back = Math.min(...KEYS.map(k => restUntil.get(k)))
    if (!WAIT_QUOTA) throw new DailyQuota('every key has used its day')
    console.log(`    every key has used its day; waiting ${Math.round((back - Date.now()) / 60000)} min (until ${new Date(back).toLocaleTimeString()})`)
    await sleep(back - Date.now())
    return speak(text, voice, lang, tries)
  }
  lastCall = Date.now()
  const r = await fetchRetry(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { languageCode: lang, voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } }),
  })
  const j = await r.json()
  // The model allows 100 requests a day per project: past that, waiting a minute does not help.
  if (r.status === 429 && /per_day|PerDay/.test(JSON.stringify(j.error))) {
    if (!WAIT_QUOTA && KEYS.length === 1) throw new DailyQuota(j.error?.message)
    // "Please retry in 4h5m49.68s." — rest this key, try the next.
    const m = /retry in (?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?/.exec(j.error?.message || '')
    // The hint is not to be trusted (at 04:01 it said 24 h, and the day came back hours sooner): at most 30 min,
    // then ask again. A refused request costs nothing.
    const hint = m ? ((+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0)) * 1000 + 60000 : 3600000
    const ms = Math.min(hint, 30 * 60000)
    restUntil.set(key, Date.now() + ms)
    console.log(`    daily quota on key ${KEYS.indexOf(key) + 1}/${KEYS.length}; it rests until ${new Date(Date.now() + ms).toLocaleTimeString()}`)
    return speak(text, voice, lang, tries)
  }
  if ((r.status === 429 || r.status >= 500) && tries > 0) {
    console.log(`    ${r.status}, waiting 15 s (${String(j.error?.message || '').split('\n')[0].slice(0, 120)})`)
    await sleep(15000); return speak(text, voice, lang, tries - 1)
  }
  const part = j.candidates?.[0]?.content?.parts?.find(p => p.inlineData)
  if (!part) throw new Error(`no audio: ${JSON.stringify(j.error || j).slice(0, 200)}`)
  return splitWav(Buffer.from(part.inlineData.data, 'base64'))
}

async function check(wavBuf, text, variety, kind) {
  const signal = checkSignal(wavBuf, text, kind)
  const asr = checkAsr(wavBuf, text)
  const jd = signal.ok && asr.ok ? await judge(wavBuf, text, variety, kind) : { ok: null, issues: ['not judged'] }
  const status = !signal.ok || asr.ok === false ? 'fail' : jd.ok === false ? 'listen' : asr.ok === null ? 'unchecked' : 'ok'
  return { status, signal, asr, judge: jd, issues: [...signal.issues, ...asr.issues, ...(jd.ok === false ? jd.issues : [])] }
}

// The best of several takes for one line: the first that is "ok", else the one with fewest problems.
async function bestTake(text, voice, variety, kind) {
  const rank = { ok: 0, listen: 1, unchecked: 2, fail: 3 }
  let best = null
  for (let t = 1; t <= TAKES; t++) {
    const { pcm, c2pa, rate } = ENGINE === 'chirp' ? await speakChirp(text, voice, LANG[variety]) : await speak(text, voice, LANG[variety])
    const w = wav(pcm, rate)
    let qc
    if (NO_QC) {
      const sig = checkSignal(w, text, kind)
      qc = { status: sig.ok ? 'unchecked' : 'fail', issues: sig.issues }
    } else qc = await check(w, text, variety, kind)
    const take = { pcm, c2pa, rate, qc, take: t }
    if (!best || rank[qc.status] < rank[best.qc.status] || (qc.status === best.qc.status && qc.issues.length < best.qc.issues.length)) best = take
    console.log(`    take ${t}: ${qc.status}${qc.issues.length ? ' · ' + qc.issues.join(' · ') : ''}`)
    if (qc.status === 'ok' || (NO_QC && qc.status === 'unchecked')) break
  }
  return best
}

// AAC 64 kb/s with macOS's own encoder (AudioToolbox). ffmpeg's built-in aac at 32 kb/s left an audible hiss
// (coding SNR 12-17 dB against the raw speech; this one 21-27 dB, and pauses 12 dB cleaner), 2026-10-17.
// The raw speech is kept as FLAC outside the repo (MASTERS), so a later change of format re-encodes
// instead of making the recording again.
const ENCODING = 'aac_at-64k'
const MASTERS = process.env.AUDIO_MASTERS || join(process.env.HOME, 'Downloads', 'tuto-audio-masters')
mkdirSync(MASTERS, { recursive: true })
function encode(wavBuf, dst, id) {
  const tmp = join(tmpdir(), `ea-${process.pid}.wav`)
  writeFileSync(tmp, wavBuf)
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', tmp, '-c:a', 'aac_at', '-b:a', '64k', '-ac', '1', '-movflags', '+faststart', dst])
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', tmp, '-c:a', 'flac', join(MASTERS, `${id}.flac`)])
  unlinkSync(tmp)
}

const hash = s => createHash('sha1').update(s).digest('hex').slice(0, 16)

// --rejudge: run the checks again on recordings already made (no new audio, no TTS quota), e.g. after a
// change to qc.mjs. Dialogue lines are not stored separately, so a dialogue is re-checked whole by Whisper only.
if (process.argv.includes('--rejudge')) {
  for (const [key, m] of Object.entries(manifest)) {
    if (ONLY && !ONLY.has(m.clip)) continue
    if (!IN_SET.has(m.clip)) continue                                  // --set picks which entries
    const path = join(OUT_AUDIO, `${m.id}.m4a`)
    if (!existsSync(path)) continue
    const w = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', path, '-f', 'wav', '-acodec', 'pcm_s16le', '-ac', '1', '-ar', '24000', '-'], { maxBuffer: 1e8 })
    if (m.kind === 'dialogue') {
      const clip = CLIPS.find(c => c.id === m.clip)
      const whole = checkAsr(w, clip.lines.map(([, l]) => l).join(' '))
      // Lines are not stored apart. When the whole talk is heard right, a line that failed only on Whisper's
      // spelling ("heard ...") is cleared; other line findings (signal, accent) stay.
      if (whole.ok) for (const l of m.lines) if (l.issues.length && l.issues.every(i => i.startsWith('heard '))) Object.assign(l, { status: 'ok', issues: [] })
      const rank = { fail: 3, unchecked: 2, listen: 1, ok: 0 }
      const before = m.status
      m.status = whole.ok === false ? 'fail' : m.lines.reduce((w, l) => (rank[l.status] > rank[w] ? l.status : w), 'ok')
      m.issues = [...m.lines.flatMap(l => l.issues), ...(whole.ok === false ? [`whole dialogue: ${whole.issues[0]}`] : [])]
      saveEntry(key, m)
      console.log(`${key}: ${before} -> ${m.status} (whole dialogue ${whole.ok ? 'heard right' : whole.issues[0]})`)
      continue
    }
    const qc = await check(w, m.text, m.variety, m.kind === 'word' ? 'word' : 'sentence')
    console.log(`${key}: ${m.status} -> ${qc.status}${qc.issues.length ? ' · ' + qc.issues.join(' · ') : ''}${qc.judge?.notes?.length ? ' · note: ' + qc.judge.notes.join('; ') : ''}`)
    Object.assign(m, { status: qc.status, issues: qc.issues, notes: qc.judge?.notes || [], accent: qc.judge?.accent, natural: qc.judge?.natural })
    saveEntry(key, m)      // through the lock: other runs may be writing the same manifest
  }
  process.exit(0)
}

let stopped = null
clipLoop: for (const [index, clip] of CLIPS.entries()) {
  if (ONLY && !ONLY.has(clip.id)) continue
  if (index % SHARDS !== SHARD) continue
  for (const variety of clip.varieties || ['uk', 'us']) {
    const voices = clip.kind === 'dialogue'
      ? clip.lines.map(([sp]) => VOICES[variety][SPEAKERS[sp]])
      : [VOICES[variety].female]
    const script = clip.kind === 'dialogue' ? clip.lines.map(([sp, l]) => `${sp}: ${l}`).join('\n') : clip.text
    const id = hash([MODEL, variety, voices.join('+'), script, ENCODING].join('|'))
    const key = `${clip.id}:${variety}`
    if (manifest[key]?.id === id && manifest[key].status === 'ok' && existsSync(join(OUT_AUDIO, `${id}.m4a`))) {
      console.log(`skip ${key} (accepted, unchanged)`)
      continue
    }
    // A clip waiting for a person to listen already had its takes; redoing it costs quota for a coin toss.
    // Name it in --only to try again.
    // Likewise a clip made with --no-qc and not checked yet: --rejudge checks it, remaking it would not.
    if (!ONLY && manifest[key]?.id === id && ['listen', 'unchecked'].includes(manifest[key].status) && existsSync(join(OUT_AUDIO, `${id}.m4a`))) {
      console.log(`skip ${key} (${manifest[key].status === 'listen' ? 'waiting to be heard' : 'made, not checked yet'})`)
      continue
    }
    console.log(`${key}`)
    let pcm, c2pa, rate = 24000, lines = []
    try {
    if (clip.kind === 'dialogue') {
      const parts = []
      for (const [i, [sp, line]] of clip.lines.entries()) {
        console.log(`  ${sp}: ${line}`)
        const b = await bestTake(line, voices[i], variety, 'sentence')
        lines.push({ speaker: sp, voice: voices[i], text: line, status: b.qc.status, issues: b.qc.issues, take: b.take, accent: b.qc.judge?.accent, natural: b.qc.judge?.natural })
        parts.push(b.pcm, Buffer.alloc(Math.round(b.rate * PAUSE) * 2))
        c2pa = c2pa || b.c2pa; rate = b.rate
      }
      pcm = Buffer.concat(parts.slice(0, -1))
    } else {
      const b = await bestTake(clip.text, voices[0], variety, clip.kind === 'word' ? 'word' : 'sentence')
      pcm = b.pcm; c2pa = b.c2pa; rate = b.rate
      lines.push({ voice: voices[0], text: clip.text, status: b.qc.status, issues: b.qc.issues, take: b.take, accent: b.qc.judge?.accent, natural: b.qc.judge?.natural })
    }
    } catch (e) {
      if (!(e instanceof DailyQuota)) throw e
      stopped = key
      console.log(`    quota: ${e.message}`)
      break clipLoop
    }
    const statusRank = { fail: 3, unchecked: 2, listen: 1, ok: 0 }
    const status = lines.reduce((w, l) => (statusRank[l.status] > statusRank[w] ? l.status : w), 'ok')
    // A dialogue is also heard whole: Whisper on the joined clip must give every line, in order.
    const whole = clip.kind === 'dialogue' ? checkAsr(wav(pcm, rate), clip.lines.map(([, l]) => l).join(' ')) : null
    encode(wav(pcm, rate), join(OUT_AUDIO, `${id}.m4a`), id)
    if (c2pa) writeFileSync(join(OUT_PROV, `${id}.c2pa`), c2pa)
    if (manifest[key]?.id && manifest[key].id !== id) {
      for (const f of [join(OUT_AUDIO, `${manifest[key].id}.m4a`), join(OUT_PROV, `${manifest[key].id}.c2pa`)]) try { unlinkSync(f) } catch {}
    }
    const entry = {
      id, file: `english-audio/${id}.m4a`, clip: clip.id, variety, kind: clip.kind, items: clip.items,
      text: clip.kind === 'dialogue' ? undefined : clip.text, lines: clip.kind === 'dialogue' ? lines : undefined,
      voice: clip.kind === 'dialogue' ? undefined : voices[0], model: MODEL, made: new Date().toISOString().slice(0, 10),
      status: whole && whole.ok === false ? 'fail' : status,
      issues: [...lines.flatMap(l => l.issues), ...(whole && whole.ok === false ? [`whole dialogue: ${whole.issues[0]}`] : [])],
      accent: clip.kind === 'dialogue' ? undefined : lines[0].accent, natural: clip.kind === 'dialogue' ? undefined : lines[0].natural,
      approved: false,   // set by a person after listening
    }
    saveEntry(key, entry)
    console.log(`  → ${entry.status}`)
  }
}

if (stopped) {
  const left = CLIPS.flatMap(c => (c.varieties || ['uk', 'us']).map(v => `${c.id}:${v}`)).filter(k => !manifest[k])
  console.log(`\nStopped at ${stopped}: the TTS model's daily quota is used up (see the message above). Run the same command`)
  console.log(`tomorrow; accepted clips are skipped. Not made yet (${left.length}): ${left.join(', ')}`)
}
const all = Object.values(manifest)
const c = s => all.filter(m => m.status === s).length
console.log(`\n${all.length} recordings · ok ${c('ok')} · listen ${c('listen')} · fail ${c('fail')} · unchecked ${c('unchecked')}`)
