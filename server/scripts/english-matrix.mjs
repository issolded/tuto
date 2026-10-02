// Plays the English module against the harness for every age x language family, checking hints,
// one-try-then-help, gems, the review round and the parent's messages against numbers worked out
// here independently of the server.
//   node --env-file=/dev/null scripts/english-harness.mjs --port 3999 --matrix &   then   node scripts/english-matrix.mjs
const B = 'http://localhost:3999'
const post = async (p, b) => { const r = await fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b || {}) }); return { status: r.status, ...(await r.json()) } }
const get = async (p) => (await fetch(B + p)).json()
const fam = await get('/__h/families')
const only = process.argv[2]
const fails = []
const rows = []
const MARK = { tr: /[çğıöşüÇĞİÖŞÜ]|\b(bir|ve|mi|bu|için|kelime)\b/i, es: /[áéíóúñ¿¡]|\b(la|el|una|de|con|las|los|palabra)\b/i, en: /\b(the|a|of|is|and|word|did|some|they|their|find|say|comparing|add|never)\b/i }
const note = (key, m) => { fails.push(`${key}: ${m}`) }

async function sitting(key, f, cid) {
  const s = await post(`/api/children/${cid}/english-session`)
  if (s.status !== 200) { note(key, `session ${s.status} ${JSON.stringify(s)}`); return null }
  const sheet = await get(`/__h/sheet/${s.session_id}`)
  return { sid: s.session_id, sheet, s }
}
const wrongIdx = (q) => q.options.map((_, i) => i).filter(i => !q.correct.includes(i))
const ans = (sid, i, chosen, extra) => post(`/api/english-sessions/${sid}/answer`, { question_index: i, chosen, ...extra })
const lastMsgs = async (chat) => (await get('/__h/notes')).filter(n => n[0] === 'telegram.sendTelegramMessage' && String(n[1][0]) === chat).map(n => n[1][1])

for (const [key, f] of Object.entries(fam)) {
  if (key === 'main' || (only && key !== only && !key.startsWith(only))) continue
  const cid = f.child, lang = f.lang
  const before = (await lastMsgs(key)).length
  const log = []

  // ── A: every question gets all three rungs, then is answered right ──
  let A = await sitting(key, f, cid)
  if (!A) continue
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
  const heldA = (await lastMsgs(key)).length - before
  if (fin.review && heldA !== 0) note(key, `A: parent told before review settled (${heldA})`)
  if (fin.review) {
    const st = await post(`/api/children/${cid}/english-review/${fin.review.id}/start`)
    const rk = await get(`/__h/sheet/${fin.review.id}`)
    for (let i = 0; i < rk.length; i++) await ans(fin.review.id, i, rk[i].correct)
    const rf = await post(`/api/children/${cid}/english-review/${fin.review.id}/finish`)
    if (rf.gems_earned !== 0) note(key, `A review paid ${rf.gems_earned}, expected 0 (practice only)`)
    const m = (await lastMsgs(key)).slice(before)
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
  const B1 = await sitting(key, f, cid)
  const nB = (await lastMsgs(key)).length
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
  const expectTypes = [q[2].type, q[3].type, q[4].type]
  if (!finB.review || finB.review.count < 1 || finB.review.count > 3) note(key, `B review count ${finB.review?.count}, expected up to 3`)
  const msgsB = (await lastMsgs(key)).length - nB
  if (msgsB !== 0) note(key, `B: parent told early (${msgsB})`)
  if (finB.review) {
    await post(`/api/children/${cid}/english-review/${finB.review.id}/start`)
    const rv = (await get('/__h/table/english_reviews')).find(r => r.id === finB.review.id)
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
    const m = (await lastMsgs(key)).slice(nB)
    if (m.length !== 1) note(key, `B expected 1 message, got ${m.length}`)
    else {
      if (!/8\/10/.test(m[0])) note(key, `B msg lacks 8/10: ${m[0]}`)
      if (!/6/.test(m[0]) || !/\b3\b|1/.test(m[0])) note(key, `B msg numbers: ${m[0]}`)
      if (!MARK[f.plang].test(m[0])) note(key, `B msg not in ${f.plang}`)
    }
    const rvAfter = (await get('/__h/table/english_reviews')).find(r => r.id === finB.review.id)
    const carried = (rvAfter.carry_types || []).map(t => t.topic_id)
    const shouldCarry = rv.picks.filter(p => p.idx === 3 || p.idx === 4).map(p => p.topic_id)
    if (shouldCarry.some(t => !carried.includes(t)) || carried.length !== new Set(shouldCarry).size) note(key, `B carry ${carried} vs ${shouldCarry}`)
    log.push(`B:${finB.gems_earned}g review ${rv.picks.length}q +${rf.gems_earned}g carry ${carried.join('/')}`)

    // ── C: next sitting leans on the carried kinds, then the child says "not now" ──
    const C = await sitting(key, f, cid)
    const lead = C.sheet.slice(0, carried.length).map(x => x.type)
    const bandHas = (t) => true
    if (carried.length && !carried.every(t => C.sheet.slice(0, 3).some(x => x.type === t))) note(key, `C does not lead with carried ${carried}: ${lead}`)
    const rvUsed = (await get('/__h/table/english_reviews')).find(r => r.id === finB.review.id)
    if (!rvUsed.carry_used_at) note(key, 'C carry not marked used')
    const nC = (await lastMsgs(key)).length
    for (let i = 0; i < 10; i++) await ans(C.sid, i, i < 6 ? C.sheet[i].correct : wrongIdx(C.sheet[i]).slice(0, C.sheet[i].pick))
    for (let i = 6; i < 10; i++) await ans(C.sid, i, wrongIdx(C.sheet[i]).slice(0, C.sheet[i].pick))
    const finC = await post(`/api/english-sessions/${C.sid}/finish`)
    if (finC.review) {
      const d = await post(`/api/children/${cid}/english-review/${finC.review.id}/decline`)
      const m = (await lastMsgs(key)).slice(nC)
      if (m.length !== 1) note(key, `C declined: ${m.length} messages`)
      else if (!MARK[f.plang].test(m[0])) note(key, 'C msg language')
      else log.push('C: declined msg ok')
    } else note(key, 'C: no review after four wrong')

    // ── D: fourth sitting of the day is past the limit; the review it offers pays nothing, and an
    //      unanswered one expires into one message ──
    const D = await sitting(key, f, cid)
    const nD = (await lastMsgs(key)).length
    for (let i = 0; i < 10; i++) await ans(D.sid, i, i < 8 ? D.sheet[i].correct : wrongIdx(D.sheet[i]).slice(0, D.sheet[i].pick))
    for (let i = 8; i < 10; i++) await ans(D.sid, i, wrongIdx(D.sheet[i]).slice(0, D.sheet[i].pick))
    const finD = await post(`/api/english-sessions/${D.sid}/finish`)
    if (!finD.capped || finD.gems_earned !== 0) note(key, `D should be capped with 0 gems: ${JSON.stringify(finD)}`)
    if (finD.review?.gems_possible) note(key, 'D: capped sitting promises review gems')
    await get('/__h/sweep')
    const mD = (await lastMsgs(key)).slice(nD)
    if (finD.review && mD.length !== 1) note(key, `D expiry: ${mD.length} messages`)
    if (!finD.review && mD.length !== 1) note(key, `D no review: ${mD.length} messages`)
    log.push(`D:capped msgs ${mD.length}`)
  }
  rows.push(`${key.padEnd(6)} types ${types.size} | ${log.join(' | ')}`)
}
console.log(rows.join('\n'))
console.log(fails.length ? `\n${fails.length} FAILURES\n` + fails.join('\n') : '\nall checks passed')
process.exit(fails.length ? 1 : 0)
