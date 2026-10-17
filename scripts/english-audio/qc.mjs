// Quality check for a speech clip, independent of the model that made it. Three layers:
//   1. signal — plain code on the samples: length, silence, clipping, loudness, sound in the last 20 ms
//   2. asr    — Whisper (whisper.cpp, local) must hear exactly the script
//   3. judge  — an audio LLM classifies the accent BLIND (told the target, it agreed with the label on a
//               British clip marked American) and rates stress and naturalness; advisory
// A clip is accepted when 1 and 2 pass and 3 raises nothing. See docs/ENGLISH-AUDIO.md.

import { readFileSync, existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { fetchRetry } from './net.mjs'

export function readWav(buf) {
  const channels = buf.readUInt16LE(22), rate = buf.readUInt32LE(24), bits = buf.readUInt16LE(34)
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || bits !== 16) throw new Error('not a 16-bit WAV')
  let off = 12, data = null
  while (off < buf.length - 8) {
    const id = buf.toString('ascii', off, off + 4), size = buf.readUInt32LE(off + 4)
    if (id === 'data') { data = buf.subarray(off + 8, off + 8 + size); break }
    off += 8 + size
  }
  const n = Math.floor(data.length / 2 / channels), s = new Float32Array(n)
  for (let i = 0; i < n; i++) s[i] = data.readInt16LE(i * 2 * channels) / 32768
  return { s, rate, channels }
}

const dB = x => (x > 0 ? 20 * Math.log10(x) : -120)
const countWords = t => t.trim().split(/\s+/).length

export function checkSignal(wavBuf, text, kind) {
  const { s, rate, channels } = readWav(wavBuf)
  const frame = Math.round(rate * 0.02)
  const rms = []
  for (let i = 0; i + frame <= s.length; i += frame) {
    let e = 0
    for (let j = i; j < i + frame; j++) e += s[j] * s[j]
    rms.push(Math.sqrt(e / frame))
  }
  const gate = Math.max(...rms) * 0.03
  const first = rms.findIndex(r => r > gate)
  const last = rms.length - 1 - [...rms].reverse().findIndex(r => r > gate)
  const secs = s.length / rate, lead = first * 0.02, trail = (rms.length - 1 - last) * 0.02
  const speech = rms.slice(first, last + 1)
  const speechDb = dB(Math.sqrt(speech.reduce((a, r) => a + r * r, 0) / speech.length))
  let clipped = 0
  for (const x of s) if (Math.abs(x) >= 0.999) clipped++
  const w = countWords(text)
  const range = kind === 'word' ? [0.3, 2.0] : [w * 0.2, w * 0.7 + 1.5]
  const issues = []
  if (channels !== 1) issues.push(`${channels} channels`)
  if (secs < range[0] || secs > range[1]) issues.push(`length ${secs.toFixed(2)}s outside ${range[0].toFixed(1)}–${range[1].toFixed(1)}s`)
  if (lead > 0.7) issues.push(`${lead.toFixed(2)}s silence before speech`)
  if (trail > 1.0) issues.push(`${trail.toFixed(2)}s silence after speech`)
  if (clipped / s.length > 0.001) issues.push(`clipping on ${(100 * clipped / s.length).toFixed(2)}% of samples`)
  if (speechDb < -32 || speechDb > -10) issues.push(`speech level ${speechDb.toFixed(1)} dBFS`)
  if (dB(rms[rms.length - 1]) > -45) issues.push('sound in the last 20 ms: cut off, or noise at the end')
  return { ok: !issues.length, issues, secs: +secs.toFixed(2) }
}

// Text compared as words. Two spellings of the same spoken words count as one, since Whisper picks its own:
// letters said one by one ("a.m.", "TV", "T-shirt" -> am, tv, tshirt; a run of single letters is joined),
// and a few fixed pairs. Each pair must sound the same: "a.m." = "am" holds only because a run of letters
// is joined first, so the verb "am" is still told apart from a wrong word.
const SAME = { alright: 'all right', okay: 'ok', mister: 'mr', missus: 'mrs', 'o clock': "o'clock", gonna: 'going to' }
const norm = t => {
  let w = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim()
  w = w.replace(/\b(?:[a-z] ){1,}[a-z]\b/g, run => run.replace(/ /g, ''))
  for (const [k, v] of Object.entries(SAME)) w = w.replace(new RegExp(`\\b${k}\\b`, 'g'), v)
  return w
}

export function checkAsr(wavBuf, text) {
  const model = process.env.WHISPER_MODEL
  if (!model || !existsSync(model)) return { ok: null, issues: ['WHISPER_MODEL not set'] }
  const tmpIn = join(tmpdir(), `qc-in-${process.pid}.wav`), tmp16 = join(tmpdir(), `qc-16-${process.pid}.wav`)
  execFileSync('sh', ['-c', `cat > "${tmpIn}"`], { input: wavBuf })
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', tmpIn, '-ar', '16000', '-ac', '1', tmp16])
  const out = execFileSync(process.env.WHISPER_BIN || 'whisper-cli', ['-m', model, '-f', tmp16, '-l', 'en', '-nt', '-np'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  for (const f of [tmpIn, tmp16]) try { unlinkSync(f) } catch {}
  const heard = norm(out), want = norm(text)
  if (heard === want) return { ok: true, issues: [], heard }
  // A word said alone has no context: Whisper writes "bye" for "by", "c" for "sea", "center" for "centre",
  // "100" for "hundred". Same sound in a pronunciation dictionary = heard right.
  if (soundsSame(heard, want)) return { ok: true, issues: [], heard, note: `heard "${heard}", same sound` }
  return { ok: false, issues: [`heard "${heard}"`], heard }
}

// UK and US pronunciation dictionaries (open-dict-data ipa-dict, MIT; scripts/english/vendor). word -> IPA
// strings without stress marks. A phrase sounds the same when, in one of the two dictionaries, a reading of
// it word by word equals a reading of the other; spaces, hyphens and accents do not count.
const DIGITS = { 0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine',
  10: 'ten', 11: 'eleven', 12: 'twelve', 13: 'thirteen', 14: 'fourteen', 15: 'fifteen', 16: 'sixteen', 17: 'seventeen',
  18: 'eighteen', 19: 'nineteen', 20: 'twenty', 100: 'hundred', 1000: 'thousand' }
let dicts = null
function loadDicts() {
  if (dicts) return dicts
  const dir = new URL('../english/vendor/', import.meta.url)
  dicts = ['ipa-en_UK.txt', 'ipa-en_US.txt'].map(f => {
    const m = new Map()
    for (const line of readFileSync(new URL(f, dir), 'utf8').split('\n')) {
      const [w, ipa] = line.split('\t')
      if (ipa) m.set(w, ipa.split(',').map(x => x.replace(/[\/ˈˌ\s]/g, '')))
    }
    return m
  })
  return dicts
}
// Figures as words, 0-999 ("24" -> "twenty four"), so Whisper's digits compare with the script's words.
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
function say(n) {
  if (n in DIGITS && n < 100) return DIGITS[n]
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + DIGITS[n % 10] : '')
  if (n < 1000) return DIGITS[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + say(n % 100) : '')
  return String(n)
}
const plain = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/-/g, ' ').split(' ')
  .map(w => (/^\d+$/.test(w) && +w < 1000 ? say(+w) : w)).join(' ').replace(/\band (?=\w)/g, m => m).replace(/\s+/g, ' ').trim()
function readings(phrase, dict) {
  let out = ['']
  for (const w of phrase.split(/[ -]+/).filter(Boolean)) {
    const p = dict.get(w)
    if (!p) return []
    out = out.flatMap(a => p.slice(0, 3).map(b => a + b)).slice(0, 27)
  }
  return out
}
function sameWord(a, b, d) { if (a === b) return true; const ra = new Set(readings(a, d)); return readings(b, d).some(r => ra.has(r)) }
export function soundsSame(a, b) {
  a = plain(a); b = plain(b)
  if (a.replace(/[ -]/g, '') === b.replace(/[ -]/g, '')) return true          // firefighter / fire fighter
  if (loadDicts().some(d => sameWord(a, b, d))) return true
  // A sentence: word by word, each the same or the same sound ("wear your shirt" / "where your shirt").
  const wa = a.split(' '), wb = b.split(' ')
  return wa.length === wb.length && wa.length > 1 && loadDicts().some(d => wa.every((w, i) => sameWord(w, wb[i], d)))
}

async function judgeOnce(wavBuf, text) {
  const prompt = `You are checking a recording made for a children's English quiz.
Script: "${text}"
Listen and answer ONLY with JSON: {"accent":"british|american|unclear","accent_cues":"…","stress_ok":true|false,"natural":1-5,"child_friendly":true|false,"problems":["…"]}
accent: decide from concrete cues (r after vowels, t between vowels, vowels in words like bath/can't/hot); say unclear if the clip has no such cues.
natural: 5 = sounds like a careful human speaker, 1 = robotic or garbled. problems: mispronunciation, wrong stress, odd pause, extra or missing words, noise. Empty if none.`
  for (let tries = 0; tries < 5; tries++) {
    const r = await fetchRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ inlineData: { mimeType: 'audio/wav', data: wavBuf.toString('base64') } }, { text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' } }),
    })
    if (r.status === 429 || r.status >= 500) { await new Promise(res => setTimeout(res, 15000)); continue }
    const j = await r.json()
    const t = j.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || ''
    try { return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)) } catch { /* unreadable: try again */ }
  }
  return null
}

// Two independent runs; a problem counts only if BOTH raise it. Measured 2026-10-16: on short clips the
// accent verdict is not reliable (the same British clip was "American" 3/3 asked in general and "British"
// 2/2 asked cue by cue; a clip with no cue at all is still called British). So below 8 words the accent is
// only noted, never a reason to send the clip to a person.
export const ACCENT_MIN_WORDS = 8
export async function judge(wavBuf, text, variety, kind) {
  const runs = [await judgeOnce(wavBuf, text), await judgeOnce(wavBuf, text)]
  if (runs.some(v => !v)) return { ok: null, issues: ['judge unavailable'] }
  const want = variety === 'uk' ? 'british' : 'american'
  const flags = v => {
    const f = new Set()
    if (v.accent !== want && v.accent !== 'unclear') f.add('accent')
    if (v.stress_ok === false) f.add('stress')
    if (v.natural < 4) f.add('naturalness')
    if (v.child_friendly === false) f.add('child-friendly')
    if ((v.problems || []).length) f.add('problems')
    return f
  }
  const [a, b] = runs.map(flags)
  const both = [...a].filter(x => b.has(x))
  const short = countWords(text) < ACCENT_MIN_WORDS
  const issues = [], notes = []
  for (const f of both) {
    const say = f === 'accent' ? `accent judged ${runs[0].accent} twice (${runs[0].accent_cues})`
      : f === 'naturalness' ? `naturalness ${runs[0].natural}/5 and ${runs[1].natural}/5`
      : f === 'problems' ? `problems: ${[...(runs[0].problems || []), ...(runs[1].problems || [])].join('; ')}` : f
    if (f === 'accent' && short) notes.push(say + ' (short clip: not trusted)')
    else issues.push(say)
  }
  return { ok: !issues.length, issues, notes, accent: runs.map(v => v.accent), natural: runs.map(v => v.natural) }
}
