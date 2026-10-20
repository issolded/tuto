// One Gemini call with retries. JSON answers are cut from the first "{" to the last "}" before parsing:
// Gemini sometimes appends text after the object even in JSON mode (see memory: gemini JSON flakiness).
import { readFileSync } from 'node:fs'
import net from 'node:net'

// On this network Node's happy-eyeballs connect times out against Google while curl gets through;
// trying one address family at a time works. Harmless elsewhere.
net.setDefaultAutoSelectFamily(false)

export const KEY = process.env.GEMINI_API_KEY ||
  readFileSync(new URL('../../../tuto-app/server/.env', import.meta.url), 'utf8').match(/^GEMINI_API_KEY=(.*)$/m)?.[1]?.replace(/"/g, '').trim()

// Different models on purpose: a reviewer that is the generator's own model shares its blind spots.
// All are Google models (the only key here); the solver is Gemma, a separately trained open model.
export const MODELS = {
  generator: process.env.GEN_MODEL || 'gemini-3.5-flash',
  safety: process.env.SAFETY_MODEL || 'gemini-3.1-pro-preview',
  safetyFallback: 'gemini-3.8-flash',     // when the preview model will not answer; the record says which one did
  // pro, chosen by the comparison set (reviewer-set.mjs, 2026-10-17): 18/18 known faults, 0/6 false alarms,
  // against 12/18 for gemini-3.8-flash and 11/18 for gemini-3.5-flash.
  pedagogy: process.env.PED_MODEL || 'gemini-3.1-pro-preview',
  pedagogyFallback: 'gemini-3.8-flash',
  solver: process.env.SOLVER_MODEL || 'gemma-4-31b-it',
}

export const usage = {}
// The writer can run on another project's key (WRITER_KEY), so its daily pro quota is not spent by
// the reviewers and the reviewers do not wait on it.
export const WRITER_KEY = process.env.WRITER_KEY || KEY
// The pedagogy reviewer's key (REVIEW_KEY), so its pro quota can be a third project's.
export const REVIEW_KEY = process.env.REVIEW_KEY || KEY
export async function call(model, prompt, { json = true, temperature = 0, system, tries = 6, key = KEY } = {}) {
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature, ...(json && !model.startsWith('gemma') ? { responseMimeType: 'application/json' } : {}) },
  }
  if (system) {
    if (model.startsWith('gemma')) body.contents[0].parts.unshift({ text: system + '\n\n' })   // Gemma has no system role
    else body.systemInstruction = { parts: [{ text: system }] }
  }
  let last
  for (let t = 0; t < tries; t++) {
    const t0 = Date.now()
    let r
    try {
      // Streamed: a long-thinking model sends nothing for a minute or more on a plain request, and an idle
      // connection on this network gets dropped (UND_ERR_SOCKET). A stream keeps it busy.
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${key}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(180000) })
    } catch (e) { last = `network ${e.cause?.code || e.name}`; await new Promise(res => setTimeout(res, 15000 * (t + 1))); continue }
    if (r.status === 429 || r.status >= 500) { last = `${r.status} ${(await r.text()).slice(0, 200)}`; await new Promise(res => setTimeout(res, 10000 * (t + 1))); continue }
    let raw
    try { raw = await r.text() } catch (e) { last = `network ${e.cause?.code || e.name}`; await new Promise(res => setTimeout(res, 15000 * (t + 1))); continue }
    if (!r.ok) { const e = JSON.parse(raw.slice(raw.indexOf('{')) || '{}'); throw new Error(`${model}: ${e.error?.message || raw.slice(0, 200)}`) }
    const chunks = raw.split('\n').filter(l => l.startsWith('data: ')).map(l => JSON.parse(l.slice(6)))
    const j = { candidates: [{ content: { parts: chunks.flatMap(c => c.candidates?.[0]?.content?.parts || []) } }], usageMetadata: chunks.at(-1)?.usageMetadata }
    const u = j.usageMetadata || {}
    usage[model] = usage[model] || { calls: 0, in: 0, out: 0, secs: 0 }
    usage[model].calls++; usage[model].secs += Math.round((Date.now() - t0) / 1000); usage[model].in += u.promptTokenCount || 0; usage[model].out += (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0)
    const text = j.candidates?.[0]?.content?.parts?.filter(p => !p.thought).map(p => p.text).join('') || ''
    if (!json) return text
    const a = text.indexOf('{'), b = text.lastIndexOf('}')
    try { return JSON.parse(text.slice(a, b + 1)) } catch { last = `unparsable: ${text.slice(0, 200)}`; continue }
  }
  throw new Error(`${model}: gave up (${last})`)
}
