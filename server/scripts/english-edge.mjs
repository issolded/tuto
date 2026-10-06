// Edge cases for the English endpoints, against the harness (node scripts/english-harness.mjs --port 3999 first).
const B = 'http://localhost:3999'
const post = async (p, b, raw) => { const r = await fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw ?? JSON.stringify(b || {}) }); return { status: r.status, ...(await r.json().catch(() => ({}))) } }
const get = async (p) => (await fetch(B + p)).json()
const fams = await get('/__h/families'); const cid = fams.main.child
const fails = []
const ok = (c, m) => { if (!c) fails.push(m) }
const wrongOf = (q) => q.options.map((_, i) => i).filter(i => !q.correct.includes(i)).slice(0, q.pick)

const s = await post(`/api/children/${cid}/english-session`); const sid = s.session_id; const key = await get(`/__h/sheet/${sid}`)
const A = (i, c, x) => post(`/api/english-sessions/${sid}/answer`, { question_index: i, chosen: c, ...x })

// invalid input
ok((await A(99, [0])).status === 400, 'out-of-range question')
ok((await A(-1, [0])).status === 400, 'negative question')
ok((await A('x', [0])).status === 400, 'non-numeric question')
ok((await A(0, [])).status === 400, 'empty choice')
ok((await A(0, [99])).status === 400, 'option out of range')
ok((await A(0, [0, 1, 2])).status === 400 || key[0].pick === 3, 'too many options')
ok((await post(`/api/english-sessions/${sid}/answer`, null, 'not json')).status >= 400, 'malformed body')
ok((await post(`/api/english-sessions/${sid}/hint`, { question_index: 99 })).status === 400, 'hint out of range')
ok((await post('/api/english-sessions/00000000-0000-0000-0000-000000000000/answer', { question_index: 0, chosen: [0] })).status === 404, 'unknown session')
ok((await post('/api/children/00000000-0000-0000-0000-000000000000/english-review/00000000-0000-0000-0000-000000000000/start')).status === 404, 'unknown review start')

// a wrong pick is never a different answer: duplicate indices are one pick, still wrong
const singles = key.map((q, i) => (q.pick === 1 ? i : -1)).filter(i => i >= 0)
const I0 = singles[0], I1 = singles[1]
const q0 = key[I0]
const w = wrongOf(q0)
const r1 = await A(I0, [w[0], w[0]])
ok(r1.retry === true, `duplicate index on single answer should be one wrong try: ${JSON.stringify(r1)}`)
// settle, then a repeated tap must not change the verdict nor double-record
await A(I0, wrongOf(q0))
const again = await A(I0, q0.correct)
ok(again.correct === false && again.repeated, `settled-wrong then right tap must stay wrong: ${JSON.stringify(again).slice(0, 120)}`)
const atts = (await get('/__h/table/english_attempts')).filter(a => a.session_id === sid && a.question_index === I0)
ok(atts.length === 1, `one attempt row for q0, got ${atts.length}`)

// concurrent taps on a fresh question: one verdict, one row
const q1 = key[I1]
const race = await Promise.all([A(I1, q1.correct), A(I1, q1.correct), A(I1, wrongOf(q1))])
const rows1 = (await get('/__h/table/english_attempts')).filter(a => a.session_id === sid && a.question_index === I1)
ok(rows1.length === 1, `race wrote ${rows1.length} rows`)
ok(race.filter(r => r.correct === true).length >= 1 || rows1[0].correct === false, 'race verdicts inconsistent')

// two-answer question: retry strikes nothing client-side, and a half-right pair is wrong
const i2 = key.findIndex(q => q.pick === 2)
if (i2 >= 0) {
  const q = key[i2], half = [q.correct[0], wrongOf({ ...q, pick: 1 })[0]]
  ok((await A(i2, half)).retry === true, 'half-right pair should retry, not settle')
  ok((await A(i2, q.correct)).correct === true, 'right pair after retry')
}

// hint after settle
ok((await post(`/api/english-sessions/${sid}/hint`, { question_index: I0 })).status === 409, 'hint after settle')

// finish before everything is answered is refused; then finish properly, twice
ok((await post(`/api/english-sessions/${sid}/finish`)).status === 400, 'finish with unanswered questions')
for (let i = 0; i < key.length; i++) await A(i, key[i].correct)
const f1 = await post(`/api/english-sessions/${sid}/finish`)
const f2 = await post(`/api/english-sessions/${sid}/finish`)
ok(f1.gems_earned === f2.gems_earned && f1.correct === f2.correct, 'second finish should echo the first')
ok((await get('/__h/table/bt_ledger')).filter(l => l.ref_id === sid).length === 1, 'gems paid more than once for one sitting')
// answers and hints after finish are refused
ok([409, 404].includes((await A(3, [0])).status), 'answer after finish')
ok([409, 404].includes((await post(`/api/english-sessions/${sid}/hint`, { question_index: 3 })).status), 'hint after finish')

// review: answered twice, finished before any answer, finished twice
const rv = f1.review
if (rv) {
  const rk = await get(`/__h/sheet/${rv.id}`)
  ok(!JSON.stringify((await post(`/api/children/${cid}/english-review/${rv.id}/start`)).questions).includes('"correct"'), 'review start leaks the key')
  const RA = (i, c) => post(`/api/english-sessions/${rv.id}/answer`, { question_index: i, chosen: c })
  const first = await RA(0, rk[0].correct); const dup = await RA(0, wrongOf(rk[0]))
  ok(first.correct && dup.correct && dup.repeated, `review double answer: ${JSON.stringify(dup).slice(0, 100)}`)
  const rf = await post(`/api/children/${cid}/english-review/${rv.id}/finish`)   // only q0 answered
  ok(rf.status === 200 && rf.asked === rv.count, `finish with partial results: ${JSON.stringify(rf)}`)
  ok((await RA(0, rk[0].correct)).status >= 400, 'answering a finished review')
  const rr = (await get('/__h/table/english_reviews')).find(r => r.id === rv.id)
  ok(rr.state === 'done' && (rv.count < 2 || rr.carry_types?.length >= 1), `unanswered review questions are carried: ${JSON.stringify(rr.carry_types)}`)
}

// the answer key never travels with the question
const s2 = await post(`/api/children/${cid}/english-session`)
const keysOf = (v) => (v && typeof v === 'object' ? Object.entries(v).flatMap(([k, x]) => [k, ...keysOf(x)]) : [])
ok(!keysOf(s2.questions).some(k => ['correct', 'why', 'rule'].includes(k)), 'session payload leaks key fields')

console.log(fails.length ? `${fails.length} FAILURES\n` + fails.join('\n') : 'all edge checks passed')
process.exit(fails.length ? 1 : 0)
