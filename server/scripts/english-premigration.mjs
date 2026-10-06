// With the English help migration NOT run (harness --no-migration): play and finish a sitting; nothing may break.
const B = 'http://localhost:3999'
const post = async (p, b) => { const r = await fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b || {}) }); return { status: r.status, ...(await r.json().catch(() => ({}))) } }
const get = async (p) => (await fetch(B + p)).json()
const fams = await get('/__h/families'); const cid = fams.main.child
const s = await post(`/api/children/${cid}/english-session`); const key = await get(`/__h/sheet/${s.session_id}`)
const fails = []
for (let i = 0; i < key.length; i++) {
  const wrong = key[i].options.map((_, k) => k).filter(k => !key[i].correct.includes(k)).slice(0, key[i].pick)
  const r = await post(`/api/english-sessions/${s.session_id}/answer`, { question_index: i, chosen: i < 8 ? key[i].correct : wrong })
  if (r.status !== 200) fails.push(`answer ${i}: ${r.status} ${r.error}`)
}
// second wrong taps settle the last two
for (let i = 8; i < 10; i++) {
  const wrong = key[i].options.map((_, k) => k).filter(k => !key[i].correct.includes(k)).slice(0, key[i].pick)
  const r = await post(`/api/english-sessions/${s.session_id}/answer`, { question_index: i, chosen: wrong })
  if (r.status !== 200) fails.push(`answer2 ${i}: ${r.status} ${r.error}`)
}
const f = await post(`/api/english-sessions/${s.session_id}/finish`)
if (f.status !== 200) fails.push(`finish ${f.status} ${f.error}`)
// 8/10 right on accuracy scale: 30 * (0.33 + 0.67*0.8) = 26
if (f.gems_earned !== 26) fails.push(`gems ${f.gems_earned}, expected 26 on the old scale`)
if (f.review) fails.push('review offered without its table')
const hint = await post(`/api/english-sessions/${s.session_id}/hint`, { question_index: 0 })
console.log(fails.length ? fails.join('\n') : `pre-migration ok: ${JSON.stringify({ gems: f.gems_earned, review: f.review })}`)
process.exit(fails.length ? 1 : 0)
