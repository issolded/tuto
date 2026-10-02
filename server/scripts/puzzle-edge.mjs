// Edge cases for the puzzle endpoints against the harness (HARNESS=url, default http://localhost:3999).
const B = process.env.HARNESS || 'http://localhost:3999'
const post = async (p, b, raw) => { const r = await fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw ?? JSON.stringify(b || {}) }); return { status: r.status, ...(await r.json().catch(() => ({}))) } }
const get = async (p) => (await fetch(B + p)).json()
const fams = await get('/__h/families'); const cid = fams['9-en']?.child || fams.main.child
const fails = []; const ok = (c, m) => { if (!c) fails.push(m) }
const s = await post(`/api/children/${cid}/puzzle-session`, { icons: false }); const sid = s.session_id; const key = await get(`/__h/sheet/${sid}`)
const A = (i, c, x) => post(`/api/puzzle-sessions/${sid}/answer`, { question_index: i, chosen_index: c, ...x })
const wr = (q) => q.options.map((_, i) => i).filter(i => i !== q.correct_index)
ok(!/correct_index|"why"|"rule"/.test(JSON.stringify(s.questions)), 'session payload leaks the key')
ok((await A(99, 0)).status === 400, 'question out of range')
ok((await A(0, 99)).status === 400, 'option out of range')
ok((await A(0, -1)).status === 400, 'negative option')
ok((await A(0, 'x')).status === 400, 'non-numeric option')
ok((await post(`/api/puzzle-sessions/${sid}/hint`, { question_index: 99 })).status === 400, 'hint out of range')
ok((await post('/api/puzzle-sessions/00000000-0000-0000-0000-000000000000/answer', { question_index: 0, chosen_index: 0 })).status === 404, 'unknown session')
// settle q0 wrong (two wrong), then a right tap must not flip it, one row
const q0 = key[0]
const r1 = await A(0, wr(q0)[0]); ok(r1.retry === true && r1.correct_index === undefined, 'first wrong reveals nothing')
const r2 = await A(0, wr(q0)[1] ?? wr(q0)[0]); ok(r2.correct === false && r2.correct_index === q0.correct_index && r2.why, 'second wrong settles with the answer and why')
const again = await A(0, q0.correct_index); ok(again.correct === false && again.repeated, `settled stays wrong ${JSON.stringify(again).slice(0, 80)}`)
ok((await get('/__h/table/puzzle_attempts')).filter(a => a.session_id === sid && a.question_index === 0).length === 1, 'one row for q0')
// race on q1
const q1 = key[1]
await Promise.all([A(1, q1.correct_index), A(1, q1.correct_index), A(1, wr(q1)[0])])
ok((await get('/__h/table/puzzle_attempts')).filter(a => a.session_id === sid && a.question_index === 1).length === 1, 'race wrote more than one row')
ok((await post(`/api/puzzle-sessions/${sid}/hint`, { question_index: 0 })).status === 409, 'hint after settle')
ok((await post(`/api/puzzle-sessions/${sid}/finish`)).status === 400, 'finish with unanswered questions')
for (let i = 0; i < key.length; i++) await A(i, key[i].correct_index)
const f1 = await post(`/api/puzzle-sessions/${sid}/finish`), f2 = await post(`/api/puzzle-sessions/${sid}/finish`)
ok(f1.gems_earned === f2.gems_earned, 'second finish echoes the first')
ok((await get('/__h/table/bt_ledger')).filter(l => l.ref_id === sid).length === 1, 'gems paid more than once')
ok([404, 409].includes((await A(3, 0)).status), 'answer after finish')
if (f1.review) {
  const st = await post(`/api/children/${cid}/puzzle-review/${f1.review.id}/start`)
  ok(!/correct_index|"why"|"rule"/.test(JSON.stringify(st.questions)), 'review start leaks the key')
  const rk = await get(`/__h/sheet/${f1.review.id}`)
  const RA = (i, c) => post(`/api/puzzle-sessions/${f1.review.id}/answer`, { question_index: i, chosen_index: c })
  const first = await RA(0, rk[0].correct_index), dup = await RA(0, wr(rk[0])[0])
  ok(first.correct && dup.correct && dup.repeated, 'review double answer')
  const rf = await post(`/api/children/${cid}/puzzle-review/${f1.review.id}/finish`)
  ok(rf.status === 200 && rf.asked === f1.review.count, `partial finish ${JSON.stringify(rf)}`)
  ok((await RA(0, rk[0].correct_index)).status >= 400, 'answering a finished review')
}
console.log(fails.length ? `${fails.length} FAILURES\n` + fails.join('\n') : 'all puzzle edge checks passed')
process.exit(fails.length ? 1 : 0)
