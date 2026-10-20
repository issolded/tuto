// Plays one English ladder lab sitting against the harness and prints what was stored.
// Start two harnesses first (fake env vars are enough, nothing leaves the machine):
//   SUPABASE_URL=http://127.0.0.1:9 SUPABASE_SERVICE_ROLE_KEY=fake LITERACY_LAB=1 node scripts/english-harness.mjs --port 3998
//   SUPABASE_URL=http://127.0.0.1:9 SUPABASE_SERVICE_ROLE_KEY=fake node scripts/english-harness.mjs --port 3997   (flag off)
// then: node scripts/literacy-lab-play.mjs
const [ON, OFF] = ['http://localhost:3998', 'http://localhost:3997']
const fam = async (base) => (await (await fetch(`${base}/__h/families`)).json()).main.child
const post = async (base, path, body) => { const r = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); const t = await r.text(); let j = null; try { j = JSON.parse(t) } catch {} return [r.status, j] }
const offChild = await fam(OFF)
console.log('flag off:', (await post(OFF, `/api/lab/literacy/${offChild}/next`, {}))[0])
const child = await fam(ON)
let sid, leaks = 0, n = 0
const seen = []
for (;;) {
  const [st, r] = await post(ON, `/api/lab/literacy/${child}/next`, { sitting_id: sid, min_status: 'draft' })
  if (st !== 200) { console.log('next failed', st, r); break }
  sid = r.sitting_id
  if (r.done) { console.log('done after', n, r.reason || ''); break }
  n++
  const it = r.item
  if (/"key"|"answer"|"correct"|"evidence"/.test(JSON.stringify(it))) leaks++
  seen.push(`${it.step}:${it.format}:${it.questions.length}q`)
  const answers = it.questions.map(q => ({ question_id: q.id, chosen: q.options.slice(0, q.pick).map(o => o.id) }))
  const [ast, a] = await post(ON, `/api/lab/literacy/sittings/${sid}/answer`, { item_id: it.id, answers, hints_used: n === 3 ? 1 : 0 })
  if (ast !== 200) { console.log('answer failed', ast, a); break }
  if (n === 1) console.log('sample result', JSON.stringify(a.results[0]).slice(0, 160))
}
console.log('dealt', seen.join(' '))
console.log('key leaks in public items:', leaks)
const rows = await (await fetch(`${ON}/__h/table/english_literacy_attempts`)).json()
console.log('rows', rows.length, 'independent false', rows.filter(r => !r.independent).length)
console.log('row sample', JSON.stringify(rows[0]))
const multi = rows.filter(r => r.grp.startsWith('text:'))
console.log('text rows', multi.length, 'distinct text groups', new Set(multi.map(r => r.grp)).size)
const [_, again] = await post(ON, `/api/lab/literacy/sittings/${sid}/answer`, { item_id: 'nope', answers: [] })
console.log('bad item:', again.error)
const state = await (await fetch(`${ON}/api/lab/literacy/${child}/state`)).json()
console.log('state answers', state.answers, 'missing', state.missing)
console.log('tracks', Object.fromEntries(Object.entries(state.summary).map(([t, v]) => [t, `${v.status}${v.step ? '@' + v.step : ''} u${v.units}`])))
console.log('vr', JSON.stringify(state.vr))
