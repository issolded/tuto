// LIVE run of the English matrix: the same checks as english-matrix.mjs, against the deployed server and
// the real database, on test children (names ZZ<age><lang>) added to a test family. Needs the service key
// (node --env-file=.env) to READ the keys and the rows it checks; everything it writes goes through the
// public endpoints, like a child's app. The parent's channel is set to 'none' by the caller so nothing is sent.
//   node --env-file=.env scripts/english-live.mjs <state.json> <plang>
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const B = process.env.LIVE_URL || 'https://tuto-production-d1db.up.railway.app'
const STATE = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const PLANG = process.argv[3]
const post = async (p, b) => { const r = await fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b || {}) }); return { status: r.status, ...(await r.json().catch(() => ({}))) } }
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const sheetOf = async (id) => {
  const a = await sb.from('english_sessions').select('sheet').eq('id', id).maybeSingle()
  if (a.data) return a.data.sheet
  return (await sb.from('english_reviews').select('sheet').eq('id', id).maybeSingle()).data?.sheet
}
const reviewRow = async (id) => (await sb.from('english_reviews').select('*').eq('id', id).maybeSingle()).data
const msgsFor = async (name) => ((await sb.from('messages').select('content, created_at').eq('parent_id', STATE.parent).eq('role', 'tuto').order('created_at', { ascending: true }).limit(2000)).data || []).map(m => m.content).filter(c => c.startsWith(name))
const fails = []
const rows = []
const MARK = { tr: /[çğıöşüÇĞİÖŞÜ]|\b(bir|ve|mi|bu|için|kelime)\b/i, es: /[áéíóúñ¿¡]|\b(la|el|una|de|con|las|los|palabra)\b/i, en: /\b(the|a|of|is|and|word|did|some|they|their|find|say|comparing|add|never)\b/i }
const note = (key, m) => { fails.push(`${key}: ${m}`) }
const wrongIdx = (q) => q.options.map((_, i) => i).filter(i => !q.correct.includes(i))
const ans = (sid, i, chosen, extra) => post(`/api/english-sessions/${sid}/answer`, { question_index: i, chosen, ...extra })

async function sitting(key, cid) {
  const s = await post(`/api/children/${cid}/english-session`)
  if (s.status !== 200) { note(key, `session ${s.status} ${JSON.stringify(s)}`); return null }
  return { sid: s.session_id, sheet: await sheetOf(s.session_id), s }
}
const ledger = async (cid) => (await sb.from('bt_ledger').select('amount, reason, capped').eq('child_id', cid).order('created_at')).data || []
const attempts = async (sid) => (await sb.from('english_attempts').select('*').eq('session_id', sid).order('question_index')).data || []

async function family(f) {
  const key = `${f.age}-${f.lang}${f.cross ? 'x' : ''}`
  const name = f.cross ? 'ZZcross' : `ZZ${f.age}${f.lang}`
  const cid = f.child, lang = f.lang
  const before = (await msgsFor(name)).length
  const log = []
  const heard = async () => (await msgsFor(name)).length - before
  // ── A: every question gets all three rungs, then is answered right ──
  let A = await sitting(key, cid)
  if (!A) return
  let types = new Set()
  for (let i = 0; i < A.sheet.length; i++) {
    const q = A.sheet[i]; types.add(q.type)
    const h = []
    for (let r = 1; r <= 4; r++) h.push(await post(`/api/english-sessions/${A.sid}/hint`, { question_index: i }))
    if (h.map(x => x.level).join() !== '1,2,3,3') note(key, `q${i} ${q.type} rung levels ${h.map(x => x.level)}`)
    if (typeof h[0].text !== 'string' || h[0].text.length < 10) note(key, `q${i} ${q.type} rung1 empty`)
    if (h[1].eliminate != null && q.correct.includes(h[1].eliminate)) note(key, `q${i} ${q.type} rung2 crosses out a right option`)
    if (!Array.isArray(h[2].steps) || !h[2].steps.length) note(key, `q${i} ${q.type} rung3 empty`)
    const all = JSON.stringify(h)
    if (/undefined|NaN|\[object/.test(all)) note(key, `q${i} ${q.type} bad text: ${all.slice(0, 120)}`)
    if (!MARK[lang].test(h[0].text)) note(key, `q${i} ${q.type} rung1 not in ${lang}: ${h[0].text}`)
    const a = await ans(A.sid, i, q.correct)
    if (!a.correct || !a.helped) note(key, `q${i} right after hint should be correct+helped: ${JSON.stringify(a).slice(0, 100)}`)
    const late = await post(`/api/english-sessions/${A.sid}/hint`, { question_index: i })
    if (late.status !== 409) note(key, `q${i} hint after settle gave ${late.status}`)
  }
  let fin = await post(`/api/english-sessions/${A.sid}/finish`)
  if (fin.gems_earned !== 15) note(key, `A gems ${fin.gems_earned}, expected 15 (all half)`)
  if (fin.review && fin.review.gems_possible) note(key, 'A: review of help-only questions should not promise gems')
  const heldA = await heard()
  if (fin.review && heldA !== 0) note(key, `A: parent told before review settled (${heldA})`)
  if (fin.review) {
    const st = await post(`/api/children/${cid}/english-review/${fin.review.id}/start`)
    const rk = await sheetOf(fin.review.id)
    for (let i = 0; i < rk.length; i++) await ans(fin.review.id, i, rk[i].correct)
    const rf = await post(`/api/children/${cid}/english-review/${fin.review.id}/finish`)
    if (rf.gems_earned !== 0) note(key, `A review paid ${rf.gems_earned}, expected 0 (practice only)`)
    const m = (await msgsFor(name)).slice(before)
    if (m.length !== 1) note(key, `A: expected 1 parent message, got ${m.length}`)
    else {
      if (!/\b10\/10\b/.test(m[0])) note(key, `A msg lacks 10/10: ${m[0]}`)
      if (!/\b0\b.*\b10\b/.test(m[0])) note(key, `A msg lacks 0 alone / 10 with help: ${m[0]}`)
      if (!MARK[f.plang].test(m[0])) note(key, `A msg not in ${f.plang}: ${m[0]}`)
      if (f.plang !== 'en' && /\bEnglish\b/.test(m[0]) && f.plang === 'tr') note(key, 'A msg english leak')
    }
    log.push(`A:${fin.gems_earned}g review ${rk.length}q`)
  } else log.push('A: no review')

  // ── B: mixed pattern ──
  const B1 = await sitting(key, cid)
  const nB = (await msgsFor(name)).length
  const q = B1.sheet
  await ans(B1.sid, 0, q[0].correct)
  const r1 = await ans(B1.sid, 1, wrongIdx(q[1]).slice(0, q[1].pick)); if (!r1.retry) note(key, 'B q1 first wrong should retry')
  const r1b = await ans(B1.sid, 1, q[1].correct); if (!r1b.helped) note(key, 'B q1 retry-right should be helped')
  await post(`/api/english-sessions/${B1.sid}/hint`, { question_index: 2 }); await ans(B1.sid, 2, q[2].correct)
  const w1 = await ans(B1.sid, 3, wrongIdx(q[3]).slice(0, q[3].pick)); const w2 = await ans(B1.sid, 3, wrongIdx(q[3]).slice(0, q[3].pick))
  if (!w1.retry || w2.retry || !w2.explain?.length) note(key, `B q3 wrong,wrong: ${JSON.stringify([w1.retry, w2.retry, w2.explain?.length])}`)
  const sk = await ans(B1.sid, 4, [], { skip: true }); if (!sk.explain?.length || sk.correct) note(key, 'B skip')
  for (let i = 5; i < 10; i++) await ans(B1.sid, i, q[i].correct)
  const finB = await post(`/api/english-sessions/${B1.sid}/finish`)
  // 5 whole + 2 halves of 10 = 6/10 ... q0, q5-9 whole (6), q1,q2 half (1) => 7/10
  if (finB.gems_earned !== 21) note(key, `B gems ${finB.gems_earned}, expected 21`)
  const atts = await attempts(B1.sid)
  const want = atts.map(a => `${a.question_index}:${a.correct ? 1 : 0}/${a.wrong_tries}/${a.hints_used}`).join(' ')
  const wantExp = '0:1/0/0 1:1/1/0 2:1/0/1 3:0/2/0 4:0/0/0 5:1/0/0 6:1/0/0 7:1/0/0 8:1/0/0 9:1/0/0'
  if (want !== wantExp) note(key, `B attempts rows ${want}`)
  const expectTypes = [q[2].type, q[3].type, q[4].type]
  if (!finB.review || finB.review.count < 1 || finB.review.count > 3) note(key, `B review count ${finB.review?.count}, expected up to 3`)
  const msgsB = (await msgsFor(name)).length - nB
  if (msgsB !== 0) note(key, `B: parent told early (${msgsB})`)
  if (finB.review) {
    await post(`/api/children/${cid}/english-review/${finB.review.id}/start`)
    const rv = await reviewRow(finB.review.id)
    const rk = rv.sheet
    // each fresh question is the same KIND as the one it stands in for
    rv.picks.forEach((p, k) => { if (rk[k].type !== p.topic_id) note(key, `B review q${k} kind ${rk[k].type} != ${p.topic_id}`) })
    const seen = new Set(q.map(x => JSON.stringify(x.prompt) + x.correct.map(i => x.options[i].text)))
    rk.forEach((x, k) => { if (seen.has(JSON.stringify(x.prompt) + x.correct.map(i => x.options[i].text))) note(key, `B review q${k} repeats a question just seen`) })
    // idx2 (hinted) right alone; idx3 wrong,wrong; idx4 right after a hint
    let exp = 0
    for (let k = 0; k < rv.picks.length; k++) {
      const p = rv.picks[k]
      if (p.idx === 3) { await ans(finB.review.id, k, wrongIdx(rk[k]).slice(0, rk[k].pick)); await ans(finB.review.id, k, wrongIdx(rk[k]).slice(0, rk[k].pick)) }
      else if (p.idx === 4) { await post(`/api/english-sessions/${finB.review.id}/hint`, { question_index: k }); await ans(finB.review.id, k, rk[k].correct); exp += 0.5 * 0.5 }
      else { await ans(finB.review.id, k, rk[k].correct) }
    }
    const rf = await post(`/api/children/${cid}/english-review/${finB.review.id}/finish`)
    const expGems = Math.round(30 * exp / 10)
    if (rf.gems_earned !== expGems) note(key, `B review paid ${rf.gems_earned}, expected ${expGems}`)
    const again = await post(`/api/children/${cid}/english-review/${finB.review.id}/finish`); if (!again.already) note(key, 'B review paid twice')
    const m = (await msgsFor(name)).slice(nB)
    if (m.length !== 1) note(key, `B expected 1 message, got ${m.length}`)
    else {
      if (!/8\/10/.test(m[0])) note(key, `B msg lacks 8/10: ${m[0]}`)
      if (!/6/.test(m[0]) || !/\b3\b|1/.test(m[0])) note(key, `B msg numbers: ${m[0]}`)
      if (!MARK[f.plang].test(m[0])) note(key, `B msg not in ${f.plang}`)
    }
    const rvAfter = await reviewRow(finB.review.id)
    const carried = (rvAfter.carry_types || []).map(t => t.topic_id)
    const shouldCarry = rv.picks.filter(p => p.idx === 3 || p.idx === 4).map(p => p.topic_id)
    if (shouldCarry.some(t => !carried.includes(t)) || carried.length !== new Set(shouldCarry).size) note(key, `B carry ${carried} vs ${shouldCarry}`)
    log.push(`B:${finB.gems_earned}g review ${rv.picks.length}q +${rf.gems_earned}g carry ${carried.join('/')}`)

    // ── C: next sitting leans on the carried kinds, then the child says "not now" ──
    const C = await sitting(key, cid)
    const lead = C.sheet.slice(0, carried.length).map(x => x.type)
    const bandHas = (t) => true
    if (carried.length && !carried.every(t => C.sheet.slice(0, 3).some(x => x.type === t))) note(key, `C does not lead with carried ${carried}: ${lead}`)
    const rvUsed = await reviewRow(finB.review.id)
    if (!rvUsed.carry_used_at) note(key, 'C carry not marked used')
    const nC = (await msgsFor(name)).length
    for (let i = 0; i < 10; i++) await ans(C.sid, i, i < 6 ? C.sheet[i].correct : wrongIdx(C.sheet[i]).slice(0, C.sheet[i].pick))
    for (let i = 6; i < 10; i++) await ans(C.sid, i, wrongIdx(C.sheet[i]).slice(0, C.sheet[i].pick))
    const finC = await post(`/api/english-sessions/${C.sid}/finish`)
    if (finC.review) {
      const d = await post(`/api/children/${cid}/english-review/${finC.review.id}/decline`)
      const m = (await msgsFor(name)).slice(nC)
      if (m.length !== 1) note(key, `C declined: ${m.length} messages`)
      else if (!MARK[f.plang].test(m[0])) note(key, 'C msg language')
      else log.push('C: declined msg ok')
    } else note(key, 'C: no review after four wrong')

    // ── D: fourth sitting of the day is past the limit; the review it offers pays nothing, and an
    //      unanswered one expires into one message ──
    const D = await sitting(key, cid)
    const nD = (await msgsFor(name)).length
    for (let i = 0; i < 10; i++) await ans(D.sid, i, i < 8 ? D.sheet[i].correct : wrongIdx(D.sheet[i]).slice(0, D.sheet[i].pick))
    for (let i = 8; i < 10; i++) await ans(D.sid, i, wrongIdx(D.sheet[i]).slice(0, D.sheet[i].pick))
    const finD = await post(`/api/english-sessions/${D.sid}/finish`)
    if (!finD.capped || finD.gems_earned !== 0) note(key, `D should be capped with 0 gems: ${JSON.stringify(finD)}`)
    if (finD.review?.gems_possible) note(key, 'D: capped sitting promises review gems')
    if (finD.review) {
      // The real sweep runs every 2 minutes; make the offer 30+ minutes old instead of waiting 30.
      await sb.from('english_reviews').update({ created_at: new Date(Date.now() - 3600e3).toISOString() }).eq('id', finD.review.id)
      for (let w = 0; w < 18 && (await msgsFor(name)).length === nD; w++) await sleep(10000)
    }
    const mD = (await msgsFor(name)).slice(nD)
    if (finD.review && mD.length !== 1) note(key, `D expiry: ${mD.length} messages`)
    if (!finD.review && mD.length !== 1) note(key, `D no review: ${mD.length} messages`)
    log.push(`D:capped msgs ${mD.length}`)
  }
  rows.push(`${key.padEnd(7)} types ${types.size} | ${log.join(' | ')}`)
}
const mine = STATE.kids.filter(k => k.plang === PLANG && (!process.argv[4] || `${k.age}-${k.lang}` === process.argv[4]) && !(process.env.SKIP || '').split(',').includes(`${k.age}-${k.lang}${k.cross ? 'x' : ''}`))
await Promise.all(mine.map(f => family(f).catch(e => note(`${f.age}-${f.lang}`, `crashed: ${e.stack || e}`))))
console.log(rows.sort().join('\n'))
console.log(fails.length ? `\n${fails.length} FAILURES\n` + fails.join('\n') : '\nall checks passed')
process.exit(fails.length ? 1 : 0)
