// The forgotten-PIN flow against the harness: the parent's reset (chosen or made), uniqueness among siblings, the
// lockout cleared, the old PIN dead, and the child's "I forgot my PIN" telling the parent once.
const B = process.env.HARNESS || 'http://localhost:3999'
const post = async (p, b) => { const r = await fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b || {}) }); return { status: r.status, ...(await r.json().catch(() => ({}))) } }
const get = async (p) => (await fetch(B + p)).json()
const fails = []; const ok = (c, m) => { if (!c) fails.push(m) }
const fam = (await get('/__h/families'))['9-en']
const code = (await get('/__h/table/parents')).find(p => p.id === fam.parent).family_code ?? null
// the harness families have no family code: give this one
const parentRow = (await get('/__h/table/parents')).find(p => p.id === fam.parent)
const FAMILY = 'PINTEST1'
await post('/__h/patch', { table: 'parents', id: fam.parent, patch: { family_code: FAMILY } })
const sib = await post('/__h/insert/children', { parent_id: fam.parent, name: 'Sibling', age: 6, language: 'en', task_settings: {} })
const R = (child, pin, parent = fam.parent) => post('/__h/reset-pin', { child, pin, parent })
const V = (pin) => post(`/api/family/${FAMILY}/verify-pin`, { pin })

const a = await R(fam.child, '4821'); ok(a.success && a.pin === '4821' && a.chosen_by_parent, `chosen pin ${JSON.stringify(a)}`)
ok((await V('4821')).child?.id === fam.child, 'the new PIN signs the child in')
ok((await R(sib.id, '4821')).success === false, 'a sibling cannot take the same PIN')
ok((await R(sib.id, 'abcd')).success === false && (await R(sib.id, '123')).success === false && (await R(sib.id, '12345')).success === false, 'PIN must be four digits')
ok((await R(fam.child, '1234', 'someone-else')).error === 'forbidden', 'another parent cannot reset')
const b = await R(sib.id)
ok(b.success && /^\d{4}$/.test(b.pin) && !b.chosen_by_parent, `made pin ${JSON.stringify(b)}`)
ok(b.pin !== '4821' && !/^(\d)\1{3}$/.test(b.pin) && b.pin !== '1234', 'made PIN is neither taken nor trivial')
ok((await V(b.pin)).child?.id === sib.id, 'the made PIN signs the sibling in')
for (let i = 0; i < 40; i++) { const m = await R(sib.id); ok(m.success && m.pin !== '4821' && !/^(\d)\1{3}$/.test(m.pin) && !['0123', '1234', '2345', '3456', '4567', '5678', '6789', '9876', '4321'].includes(m.pin), `made PIN ${m.pin}`); }
// lockout: five wrong, then a reset clears it at once
for (let i = 0; i < 5; i++) await V('0000')
ok((await V('4821')).status === 429, 'locked after five wrong')
ok((await R(fam.child, '7351')).success, 'reset while locked')
ok((await V('7351')).child?.id === fam.child, 'the lockout is cleared by the reset')
ok((await V('4821')).status === 401, 'the old PIN no longer works')

// "I forgot my PIN": the parent hears once, at most every ten minutes, and nothing changes
const before = (await get('/__h/notes')).filter(n => n[0] === 'telegram.sendTelegramMessage').length
ok((await post(`/api/family/${FAMILY}/forgot-pin`)).ok === true, 'forgot-pin answers ok')
await new Promise(r => setTimeout(r, 300))
const mid = (await get('/__h/notes')).filter(n => n[0] === 'telegram.sendTelegramMessage')
ok(mid.length === before + 1, `parent told once (${mid.length - before})`)
await post(`/api/family/${FAMILY}/forgot-pin`); await post(`/api/family/${FAMILY}/forgot-pin`)
await new Promise(r => setTimeout(r, 300))
ok((await get('/__h/notes')).filter(n => n[0] === 'telegram.sendTelegramMessage').length === before + 1, 'repeat taps do not spam the parent')
ok((await V('7351')).child?.id === fam.child, 'forgetting changes nothing')
const unknown = await post('/api/family/NOSUCHFAM/forgot-pin'); ok(unknown.ok === true, 'unknown family answers the same')
console.log(fails.length ? `${fails.length} FAILURES\n` + fails.join('\n') : 'all PIN checks passed')
process.exit(fails.length ? 1 : 0)
