// Puzzle (NVR) twin of english-matrix.mjs, against the harness: hints, one-try-then-help, gems, review, parent messages.
//   node scripts/english-harness.mjs --port 3999 --matrix &   then   node scripts/puzzle-matrix.mjs [family-prefix]
const B = process.env.HARNESS || 'http://localhost:3999'
const post = async (p, b) => { const r = await fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b || {}) }); return { status: r.status, ...(await r.json().catch(() => ({}))) } }
const get = async (p) => (await fetch(B + p)).json()
const fam = await get('/__h/families')
const only = process.argv[2]
const fails = [], rows = []
const MARK = { tr: /[çğıöşüÇĞİÖŞÜ]|\b(bir|ve|mi|bu|için|şekil)\b/i, es: /[áéíóúñ¿¡]|\b(la|el|una|de|con|las|los|figura)\b/i, en: /\b(the|a|of|is|and|shape|look|at|they|all)\b/i }
const note = (key, m) => fails.push(`${key}: ${m}`)
const lastMsgs = async (chat) => (await get('/__h/notes')).filter(n => n[0] === 'telegram.sendTelegramMessage' && String(n[1][0]) === chat).map(n => n[1][1])
const wrongOf = (q) => q.options.map((_, i) => i).find(i => i !== q.correct_index)

for (const [key, f] of Object.entries(fam)) {
  if (key === 'main' || (only && !key.startsWith(only))) continue
  const cid = f.child, lang = f.lang
  const before = (await lastMsgs(key)).length
  const log = []
  const sitting = async () => { const s = await post(`/api/children/${cid}/puzzle-session`, { icons: false }); if (s.status !== 200) { note(key, `session ${s.status} ${s.error}`); return null } return { sid: s.session_id, s, sheet: await get(`/__h/sheet/${s.session_id}`) } }
  const ans = (sid, i, c, x) => post(`/api/puzzle-sessions/${sid}/answer`, { question_index: i, chosen_index: c, lang, ...x })

  // A: every question gets three rungs, then the right answer
  const A = await sitting(); if (!A) continue
  const types = new Set()
  for (let i = 0; i < A.sheet.length; i++) {
    const q = A.sheet[i]; types.add(q.type)
    const h = []
    for (let r = 1; r <= 4; r++) h.push(await post(`/api/puzzle-sessions/${A.sid}/hint`, { question_index: i, lang }))
    if (h.map(x => x.level).join() !== '1,2,3,3') note(key, `q${i} ${q.type} rung levels ${h.map(x => x.level)}`)
    if (typeof h[0].text !== 'string' || h[0].text.length < 15) note(key, `q${i} ${q.type} rung1 empty`)
    if (h[1].eliminate == null || h[1].eliminate === q.correct_index) note(key, `q${i} ${q.type} rung2 ${h[1].eliminate}`)
    if (typeof h[2].text !== 'string' || h[2].text.length < 15) note(key, `q${i} ${q.type} rung3 empty`)
    if (/undefined|NaN|\[object/.test(JSON.stringify(h))) note(key, `q${i} ${q.type} bad text ${JSON.stringify(h).slice(0, 100)}`)
    if (!MARK[lang].test(h[0].text + ' ' + h[2].text)) note(key, `q${i} ${q.type} not in ${lang}: ${h[0].text}`)
    const a = await ans(A.sid, i, q.correct_index)
    if (!a.correct || !a.helped) note(key, `q${i} right after hint: ${JSON.stringify(a).slice(0, 100)}`)
  }
  const fin = await post(`/api/puzzle-sessions/${A.sid}/finish`)
  if (fin.gems_earned !== 15) note(key, `A gems ${fin.gems_earned}, expected 15`)
  if (!fin.review) note(key, 'A: no review offered although every question was hinted')
  if (fin.review) {
    if ((await lastMsgs(key)).length !== before) note(key, 'A: parent told before the review settled')
    await post(`/api/children/${cid}/puzzle-review/${fin.review.id}/start`)
    const rk = await get(`/__h/sheet/${fin.review.id}`)
    for (let i = 0; i < rk.length; i++) await ans(fin.review.id, i, rk[i].correct_index)
    const rf = await post(`/api/children/${cid}/puzzle-review/${fin.review.id}/finish`)
    if (rf.gems_earned !== 0) note(key, `A review paid ${rf.gems_earned}, expected 0`)
    const m = (await lastMsgs(key)).slice(before)
    if (m.length !== 1) note(key, `A: ${m.length} messages`)
    else { if (!/10\/10/.test(m[0]) || !/\b0\b.*\b10\b/.test(m[0])) note(key, `A msg numbers: ${m[0]}`); if (!MARK[f.plang].test(m[0])) note(key, `A msg language`) }
    log.push(`A:15g review ${rk.length}q`)
  }

  // B: mixed pattern
  const nB = (await lastMsgs(key)).length
  const B1 = await sitting(); const q = B1.sheet
  await ans(B1.sid, 0, q[0].correct_index)
  const r1 = await ans(B1.sid, 1, wrongOf(q[1])); if (!r1.retry || r1.correct_index !== undefined) note(key, `B q1 first wrong should retry and reveal nothing: ${JSON.stringify(r1)}`)
  const r1b = await ans(B1.sid, 1, q[1].correct_index); if (!r1b.helped) note(key, 'B q1 retry-right helped')
  await post(`/api/puzzle-sessions/${B1.sid}/hint`, { question_index: 2, lang }); await ans(B1.sid, 2, q[2].correct_index)
  const w1 = await ans(B1.sid, 3, wrongOf(q[3])); const w2 = await ans(B1.sid, 3, q[3].options.map((_, i) => i).filter(i => i !== q[3].correct_index)[1] ?? wrongOf(q[3]))
  if (!w1.retry || w2.retry || w2.correct_index === undefined) note(key, `B q3 wrong,wrong: ${JSON.stringify([w1.retry, w2.retry, w2.correct_index])}`)
  const sk = await ans(B1.sid, 4, undefined, { skip: true }); if (sk.correct || sk.correct_index === undefined) note(key, `B skip ${JSON.stringify(sk)}`)
  for (let i = 5; i < 10; i++) await ans(B1.sid, i, q[i].correct_index)
  const finB = await post(`/api/puzzle-sessions/${B1.sid}/finish`)
  if (finB.gems_earned !== 21) note(key, `B gems ${finB.gems_earned}, expected 21`)
  if (!finB.review || finB.review.count < 1 || finB.review.count > 3) note(key, `B review count ${finB.review?.count}`)
  if ((await lastMsgs(key)).length !== nB) note(key, 'B: parent told early')
  if (finB.review) {
    await post(`/api/children/${cid}/puzzle-review/${finB.review.id}/start`)
    const rv = (await get('/__h/table/puzzle_reviews')).find(r => r.id === finB.review.id)
    rv.picks.forEach((p, k) => { const [t] = p.topic_id.split('|'); if (rv.sheet[k].type !== t) note(key, `B review q${k} type ${rv.sheet[k].type} != ${t}`) })
    let exp = 0
    for (let k = 0; k < rv.picks.length; k++) {
      const p = rv.picks[k], rq = rv.sheet[k]
      if (p.idx === 3) { await ans(finB.review.id, k, wrongOf(rq)); await ans(finB.review.id, k, rq.options.map((_, i) => i).filter(i => i !== rq.correct_index)[1] ?? wrongOf(rq)) }
      else if (p.idx === 4) { await post(`/api/puzzle-sessions/${finB.review.id}/hint`, { question_index: k, lang }); await ans(finB.review.id, k, rq.correct_index); exp += 0.25 }
      else await ans(finB.review.id, k, rq.correct_index)
    }
    const rf = await post(`/api/children/${cid}/puzzle-review/${finB.review.id}/finish`)
    if (rf.gems_earned !== Math.round(30 * exp / 10)) note(key, `B review paid ${rf.gems_earned}, expected ${Math.round(30 * exp / 10)}`)
    if (!(await post(`/api/children/${cid}/puzzle-review/${finB.review.id}/finish`)).already) note(key, 'B review paid twice')
    const m = (await lastMsgs(key)).slice(nB)
    if (m.length !== 1) note(key, `B ${m.length} messages`); else if (!/8\/10/.test(m[0]) || !MARK[f.plang].test(m[0])) note(key, `B msg: ${m[0]}`)
    const after = (await get('/__h/table/puzzle_reviews')).find(r => r.id === finB.review.id)
    const carried = (after.carry_types || []).map(t => t.topic_id)
    const should = rv.picks.filter(p => p.idx === 3 || p.idx === 4).map(p => p.topic_id)
    if (should.some(t => !carried.includes(t)) || carried.length !== new Set(should).size) note(key, `B carry ${carried} vs ${should}`)
    if (rf.gems_earned > (finB.review.max_gems ?? 0)) note(key, `B review paid ${rf.gems_earned}, above the offered maximum ${finB.review.max_gems}`)
    log.push(`B:21g review ${rv.picks.length}q +${rf.gems_earned}g carry ${carried.map(c => c.split('|')[0]).join('/')}`)

    // C: leans on carried kinds, then "not now"
    const C = await sitting()
    const lead = C.sheet.slice(0, 3).map(x => x.type)
    // The type must lead; the exact attribute usually does, and may stand in for a rare one (see generateSession).
    if (carried.length && !carried.every(t => C.sheet.slice(0, 3).some(x => x.type === t.split('|')[0]))) note(key, `C does not lead with ${carried}: ${C.sheet.slice(0, 3).map(x => x.type + '|' + x.rule?.attr)}`)
    const nC = (await lastMsgs(key)).length
    for (let i = 0; i < 10; i++) { const cq = C.sheet[i]; await ans(C.sid, i, i < 6 ? cq.correct_index : wrongOf(cq)) }
    for (let i = 6; i < 10; i++) { const cq = C.sheet[i]; await ans(C.sid, i, cq.options.map((_, k) => k).filter(k => k !== cq.correct_index)[1] ?? wrongOf(cq)) }
    const finC = await post(`/api/puzzle-sessions/${C.sid}/finish`)
    if (!finC.review) note(key, 'C: no review after four wrong')
    else { await post(`/api/children/${cid}/puzzle-review/${finC.review.id}/decline`); const mC = (await lastMsgs(key)).slice(nC); if (mC.length !== 1 || !MARK[f.plang].test(mC[0])) note(key, `C declined msgs ${mC.length}`) }

    // D: fourth sitting past the limit; expiry settles it into one message
    const D = await sitting(); const nD = (await lastMsgs(key)).length
    for (let i = 0; i < 10; i++) { const dq = D.sheet[i]; await ans(D.sid, i, i < 8 ? dq.correct_index : wrongOf(dq)) }
    for (let i = 8; i < 10; i++) { const dq = D.sheet[i]; await ans(D.sid, i, dq.options.map((_, k) => k).filter(k => k !== dq.correct_index)[1] ?? wrongOf(dq)) }
    const finD = await post(`/api/puzzle-sessions/${D.sid}/finish`)
    if (!finD.capped || finD.gems_earned !== 0) note(key, `D capped? ${JSON.stringify(finD)}`)
    await get('/__h/sweep')
    const mD = (await lastMsgs(key)).slice(nD)
    if (mD.length !== 1) note(key, `D: ${mD.length} messages`)
    log.push('C,D ok')
  }
  rows.push(`${key.padEnd(6)} types ${types.size} | ${log.join(' | ')}`)
}
console.log(rows.join('\n'))
console.log(fails.length ? `\n${fails.length} FAILURES\n` + fails.join('\n') : '\nall checks passed')
process.exit(fails.length ? 1 : 0)
