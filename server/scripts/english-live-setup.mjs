// Test-family plumbing for english-live.mjs. Adds ZZ test children (ages 7-12 x en/tr/es + one crossed) to an
// existing family, silences its parent's channel while testing, and removes everything afterwards.
//   node --env-file=.env scripts/english-live-setup.mjs seed  <FAMILYCODE> <state.json>
//   node --env-file=.env scripts/english-live-setup.mjs lang  <state.json> <en|tr|es>   (parent message language)
//   node --env-file=.env scripts/english-live-setup.mjs clean <state.json>              (delete test rows, restore parent)
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'node:fs'
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const [mode, a, b, c] = process.argv.slice(2)
if (mode === 'seed') {
  const { data: p } = await sb.from('parents').select('id, notification_channel, prefs').eq('family_code', a).single()
  const state = { parent: p.id, original: { notification_channel: p.notification_channel, language: p.prefs?.language }, kids: [] }
  state.messagesBefore = ((await sb.from('messages').select('id').eq('parent_id', p.id)).data || []).map(m => m.id)
  for (const [age, lang] of [...[7, 8, 9, 10, 11, 12].flatMap(x => ['en', 'tr', 'es'].map(l => [x, l])), [8, 'xx']]) {
    const cross = lang === 'xx'
    const { data: k, error } = await sb.from('children').insert({ parent_id: p.id, name: cross ? 'ZZcross' : `ZZ${age}${lang}`, age, language: cross ? 'tr' : lang, avatar: 'fox', pin_hash: 'ZZTEST-not-a-hash', task_settings: {} }).select('id').single()
    if (error) { console.log('insert failed', error.message); break }
    state.kids.push({ child: k.id, age, lang: cross ? 'tr' : lang, plang: cross ? 'en' : lang, cross })
  }
  writeFileSync(b, JSON.stringify(state, null, 1))
  await sb.from('parents').update({ notification_channel: 'none' }).eq('id', p.id)
  console.log(`${state.kids.length} test children; parent channel -> none (was ${state.original.notification_channel}/${state.original.language})`)
} else if (mode === 'lang') {
  const S = JSON.parse(readFileSync(a, 'utf8'))
  const { data: p } = await sb.from('parents').select('prefs').eq('id', S.parent).single()
  await sb.from('parents').update({ prefs: { ...p.prefs, language: b } }).eq('id', S.parent)
  console.log('parent language ->', b)
} else if (mode === 'clean') {
  const S = JSON.parse(readFileSync(a, 'utf8'))
  const ids = S.kids.map(k => k.child)
  const names = new Set(S.kids.map(k => (k.cross ? 'ZZcross' : `ZZ${k.age}${k.lang}`)))
  const { data: msgs } = await sb.from('messages').select('id, content').eq('parent_id', S.parent)
  const mine = (msgs || []).filter(m => !S.messagesBefore.includes(m.id) && [...names].some(n => m.content.startsWith(n))).map(m => m.id)
  console.log('messages to delete', mine.length, '| new but not ours (kept)', (msgs || []).filter(m => !S.messagesBefore.includes(m.id)).length - mine.length)
  for (let i = 0; i < mine.length; i += 100) await sb.from('messages').delete().in('id', mine.slice(i, i + 100))
  for (const t of ['english_reviews', 'english_attempts', 'english_sessions', 'bt_ledger']) {
    const { error, count } = await sb.from(t).delete({ count: 'exact' }).in('child_id', ids)
    console.log(t, error ? error.message : `deleted ${count}`)
  }
  const { error, count } = await sb.from('children').delete({ count: 'exact' }).in('id', ids).like('name', 'ZZ%')
  console.log('children', error ? error.message : `deleted ${count}`)
  const { data: p } = await sb.from('parents').select('prefs').eq('id', S.parent).single()
  await sb.from('parents').update({ notification_channel: S.original.notification_channel, prefs: { ...p.prefs, language: S.original.language } }).eq('id', S.parent)
  const { data: left } = await sb.from('children').select('name').eq('parent_id', S.parent)
  console.log('parent restored:', S.original.notification_channel, S.original.language, '| children left:', JSON.stringify(left))
}
