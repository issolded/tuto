// Puzzle sitting with the help migration NOT run (harness --no-migration): nothing may break, gems on the old scale.
const B = process.env.HARNESS || 'http://localhost:3999'
const post = async (p, b) => { const r = await fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b || {}) }); return { status: r.status, ...(await r.json().catch(() => ({}))) } }
const get = async (p) => (await fetch(B + p)).json()
const cid = (await get('/__h/families')).main.child
const s = await post(`/api/children/${cid}/puzzle-session`, { icons: false }); const key = await get(`/__h/sheet/${s.session_id}`)
const fails = []
const wr = (q) => q.options.map((_, i) => i).filter(i => i !== q.correct_index)
for (let i = 0; i < 10; i++) {
  const A = (c) => post(`/api/puzzle-sessions/${s.session_id}/answer`, { question_index: i, chosen_index: c })
  const r = await A(i < 8 ? key[i].correct_index : wr(key[i])[0])
  if (r.status !== 200) fails.push(`answer ${i}: ${r.status} ${r.error}`)
  if (i >= 8) { const r2 = await A(wr(key[i])[1] ?? wr(key[i])[0]); if (r2.status !== 200) fails.push(`answer2 ${i}`) }
}
const h = await post(`/api/puzzle-sessions/${s.session_id}/hint`, { question_index: 0 }); if (h.status !== 409) fails.push(`hint after settle ${h.status}`)
const f = await post(`/api/puzzle-sessions/${s.session_id}/finish`)
if (f.status !== 200) fails.push(`finish ${f.status} ${f.error}`)
if (f.gems_earned !== 26) fails.push(`gems ${f.gems_earned}, expected 26 on the old scale`)
if (f.review) fails.push('review offered without its table')
console.log(fails.length ? fails.join('\n') : `puzzle pre-migration ok: ${JSON.stringify({ gems: f.gems_earned, review: f.review })}`)
process.exit(fails.length ? 1 : 0)
