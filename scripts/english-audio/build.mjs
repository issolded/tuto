// Makes, checks and stores the English recordings listed in clips.mjs, for UK and US English.
//
//   GEMINI_API_KEY=… WHISPER_MODEL=~/.cache/whisper-cpp/ggml-base.en.bin node scripts/english-audio/build.mjs [--only id,id] [--takes 3]
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

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { CLIPS, VOICES, SPEAKERS } from './clips.mjs'
import { checkSignal, checkAsr, judge } from './qc.mjs'

const MODEL = 'gemini-3.8-flash-tts'
const LANG = { uk: 'en-GB', us: 'en-US' }
const OUT_AUDIO = 'public/english-audio'
const OUT_PROV = 'scripts/english-audio/provenance'
const MANIFEST = 'src/lib/literacy/audioManifest.generated.json'
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d }
const ONLY = arg('only') ? new Set(arg('only').split(',')) : null
const TAKES = Number(arg('takes', 3))
const PAUSE = 0.45            // seconds between dialogue lines
const sleep = ms => new Promise(r => setTimeout(r, ms))

for (const d of [OUT_AUDIO, OUT_PROV]) mkdirSync(d, { recursive: true })
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {}

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

class DailyQuota extends Error {}
let lastCall = 0
async function speak(text, voice, lang, tries = 5) {
  const wait = 6500 - (Date.now() - lastCall)            // the TTS model allows 10 requests a minute
  if (wait > 0) await sleep(wait)
  lastCall = Date.now()
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { languageCode: lang, voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } }),
  })
  const j = await r.json()
  // The model allows 100 requests a day per project: past that, waiting a minute does not help.
  if (r.status === 429 && /per_day|PerDay/.test(JSON.stringify(j.error))) throw new DailyQuota(j.error?.message)
  if ((r.status === 429 || r.status >= 500) && tries > 0) { await sleep(15000); return speak(text, voice, lang, tries - 1) }
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
    const { pcm, c2pa, rate } = await speak(text, voice, LANG[variety])
    const w = wav(pcm, rate)
    const qc = await check(w, text, variety, kind)
    const take = { pcm, c2pa, rate, qc, take: t }
    if (!best || rank[qc.status] < rank[best.qc.status] || (qc.status === best.qc.status && qc.issues.length < best.qc.issues.length)) best = take
    console.log(`    take ${t}: ${qc.status}${qc.issues.length ? ' · ' + qc.issues.join(' · ') : ''}`)
    if (qc.status === 'ok') break
  }
  return best
}

function encode(wavBuf, dst) {
  const tmp = join(tmpdir(), `ea-${process.pid}.wav`)
  writeFileSync(tmp, wavBuf)
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', tmp, '-c:a', 'aac', '-b:a', '32k', '-ac', '1', '-movflags', '+faststart', dst])
  unlinkSync(tmp)
}

const hash = s => createHash('sha1').update(s).digest('hex').slice(0, 16)

let stopped = null
clipLoop: for (const clip of CLIPS) {
  if (ONLY && !ONLY.has(clip.id)) continue
  for (const variety of ['uk', 'us']) {
    const voices = clip.kind === 'dialogue'
      ? clip.lines.map(([sp]) => VOICES[variety][SPEAKERS[sp]])
      : [VOICES[variety].female]
    const script = clip.kind === 'dialogue' ? clip.lines.map(([sp, l]) => `${sp}: ${l}`).join('\n') : clip.text
    const id = hash([MODEL, variety, voices.join('+'), script].join('|'))
    const key = `${clip.id}:${variety}`
    if (manifest[key]?.id === id && manifest[key].status === 'ok' && existsSync(join(OUT_AUDIO, `${id}.m4a`))) {
      console.log(`skip ${key} (accepted, unchanged)`)
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
        lines.push({ speaker: sp, voice: voices[i], text: line, status: b.qc.status, issues: b.qc.issues, take: b.take })
        parts.push(b.pcm, Buffer.alloc(Math.round(b.rate * PAUSE) * 2))
        c2pa = c2pa || b.c2pa; rate = b.rate
      }
      pcm = Buffer.concat(parts.slice(0, -1))
    } else {
      const b = await bestTake(clip.text, voices[0], variety, clip.kind === 'word' ? 'word' : 'sentence')
      pcm = b.pcm; c2pa = b.c2pa; rate = b.rate
      lines.push({ voice: voices[0], text: clip.text, status: b.qc.status, issues: b.qc.issues, take: b.take })
    }
    } catch (e) {
      if (!(e instanceof DailyQuota)) throw e
      stopped = key
      break clipLoop
    }
    const statusRank = { fail: 3, unchecked: 2, listen: 1, ok: 0 }
    const status = lines.reduce((w, l) => (statusRank[l.status] > statusRank[w] ? l.status : w), 'ok')
    // A dialogue is also heard whole: Whisper on the joined clip must give every line, in order.
    const whole = clip.kind === 'dialogue' ? checkAsr(wav(pcm, rate), clip.lines.map(([, l]) => l).join(' ')) : null
    encode(wav(pcm, rate), join(OUT_AUDIO, `${id}.m4a`))
    if (c2pa) writeFileSync(join(OUT_PROV, `${id}.c2pa`), c2pa)
    if (manifest[key]?.id && manifest[key].id !== id) {
      for (const f of [join(OUT_AUDIO, `${manifest[key].id}.m4a`), join(OUT_PROV, `${manifest[key].id}.c2pa`)]) try { unlinkSync(f) } catch {}
    }
    manifest[key] = {
      id, file: `english-audio/${id}.m4a`, clip: clip.id, variety, kind: clip.kind, items: clip.items,
      text: clip.kind === 'dialogue' ? undefined : clip.text, lines: clip.kind === 'dialogue' ? lines : undefined,
      voice: clip.kind === 'dialogue' ? undefined : voices[0], model: MODEL, made: new Date().toISOString().slice(0, 10),
      status: whole && whole.ok === false ? 'fail' : status,
      issues: [...lines.flatMap(l => l.issues), ...(whole && whole.ok === false ? [`whole dialogue: ${whole.issues[0]}`] : [])],
      approved: false,   // set by a person after listening
    }
    writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + '\n')
    console.log(`  → ${manifest[key].status}`)
  }
}

if (stopped) {
  const left = CLIPS.flatMap(c => ['uk', 'us'].map(v => `${c.id}:${v}`)).filter(k => !manifest[k])
  console.log(`\nStopped at ${stopped}: the TTS model's daily quota (100 requests) is used up. Run the same command`)
  console.log(`tomorrow; accepted clips are skipped. Not made yet (${left.length}): ${left.join(', ')}`)
}
const all = Object.values(manifest)
const c = s => all.filter(m => m.status === s).length
console.log(`\n${all.length} recordings · ok ${c('ok')} · listen ${c('listen')} · fail ${c('fail')} · unchecked ${c('unchecked')}`)
