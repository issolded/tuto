// LIVE puzzle run on the ZZ test children (see english-live-setup.mjs). Without the puzzle migration the old behaviour is
// expected (gems on the accuracy scale, no review, message at once); with it, the full help/review flow.
//   node --env-file=.env scripts/puzzle-live.mjs <state.json> <plang> [migrated]
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const B = process.env.LIVE_URL || 'https://tuto-production-d1db.up.railway.app'
const S = JSON.parse(readFileSync(process.argv[2], 'utf8')); const PLANG = process.argv[3]; const MIG = process.argv[4] === 'migrated'
const post = async (p, b) => { const r = await fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b || {}) }); return { status: r.status, ...(await r.json().catch(() => ({}))) } }
const msgs = async (name) => ((await sb.from('messages').select('content').eq('parent_id', S.parent).eq('role', 'tuto').order('created_at').limit(2000)).data || []).map(m => m.content).filter(c => c.startsWith(name))
const fails = [], rows = []
const wr = (q) => q.options.map((_, i) => i).filter(i => i !== q.correct_index)
await Promise.all(S.kids.filter(k => k.plang === PLANG).map(async (f) => {
  const key = `${f.age}-${f.lang}${f.cross ? 'x' : ''}`, name = f.cross ? 'ZZcross' : `ZZ${f.age}${f.lang}`
  const note = (m) => fails.push(`${key}: ${m}`)
  const before = (await msgs(name)).length
  const s = await post(`/api/children/${f.child}/puzzle-session`, { icons: false })
  if (s.status !== 200) return note(`session ${s.status} ${s.error}`)
  const sheet = (await sb.from('puzzle_sessions').select('sheet').eq('id', s.session_id).maybeSingle()).data.sheet
  const A = (i, c, x) => post(`/api/puzzle-sessions/${s.session_id}/answer`, { question_index: i, chosen_index: c, lang: f.lang, ...x })
  const types = new Set()
  for (let i = 0; i < 10; i++) {
    const q = sheet[i]; types.add(q.type)
    if (i < 3) {   // all three rungs on the first questions
      const h = []
      for (let r = 0; r < 3; r++) h.push(await post(`/api/puzzle-sessions/${s.session_id}/hint`, { question_index: i, lang: f.lang }))
      if (h.some(x => x.status !== 200) || typeof h[0].text !== 'string' || typeof h[2].text !== 'string' || h[1].eliminate === q.correct_index) note(`q${i} ${q.type} hints ${JSON.stringify(h).slice(0, 160)}`)
      const a = await A(i, q.correct_index); if (!a.correct || !a.helped) note(`q${i} hinted right ${JSON.stringify(a).slice(0, 80)}`)
    } else if (i === 3) {
      const r1 = await A(i, wr(q)[0]); if (!r1.retry || r1.correct_index !== undefined) note(`q3 first wrong ${JSON.stringify(r1).slice(0, 80)}`)
      const r2 = await A(i, q.correct_index); if (!r2.correct || !r2.helped) note('q3 retry-right')
    } else if (i === 4) {
      await A(i, wr(q)[0]); const r2 = await A(i, wr(q)[1] ?? wr(q)[0])
      if (r2.correct || r2.correct_index !== q.correct_index || !r2.why) note(`q4 settled wrong ${JSON.stringify(r2).slice(0, 100)}`)
    } else await A(i, q.correct_index)
  }
  const fin = await post(`/api/puzzle-sessions/${s.session_id}/finish`)
  if (fin.status !== 200) return note(`finish ${fin.status} ${fin.error}`)
  // 9/10 right. Migrated: 6 whole + 3 hinted halves... q0-2 half, q3 half, q4 zero, q5-9 whole => (4*0.5+5)/10*30 = 21
  const expect = MIG ? 21 : Math.round(30 * (0.33 + 0.67 * 0.9))
  if (fin.gems_earned !== expect) note(`gems ${fin.gems_earned}, expected ${expect}`)
  if (MIG && !fin.review) note('no review offered'); if (!MIG && fin.review) note('review offered without its table')
  const held = (await msgs(name)).length - before
  if (MIG ? held !== 0 : held !== 1) note(`parent messages right after finish: ${held}`)
  if (MIG && fin.review) {
    await post(`/api/children/${f.child}/puzzle-review/${fin.review.id}/start`)
    const rv = (await sb.from('puzzle_reviews').select('*').eq('id', fin.review.id).maybeSingle()).data
    for (let k = 0; k < rv.sheet.length; k++) await post(`/api/puzzle-sessions/${fin.review.id}/answer`, { question_index: k, chosen_index: rv.sheet[k].correct_index, lang: f.lang })
    const rf = await post(`/api/children/${f.child}/puzzle-review/${fin.review.id}/finish`)
    if (rf.status !== 200) note(`review finish ${rf.status}`)
    const m = (await msgs(name)).slice(before); if (m.length !== 1) note(`review: ${m.length} messages`)
  }
  rows.push(`${key.padEnd(7)} types ${types.size} gems ${fin.gems_earned} review ${fin.review ? fin.review.count + 'q' : 'none'}`)
}))
console.log(rows.sort().join('\n'))
console.log(fails.length ? `\n${fails.length} FAILURES\n` + fails.join('\n') : '\nall checks passed')
process.exit(fails.length ? 1 : 0)
