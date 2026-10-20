// Distinct items and distinct answers per VR family, 3000 seeds each.
// node scripts/english/vr-pool.mjs
const E = await import(new URL("../../src/lib/englishTemplates.js", import.meta.url))
const fams = { '7-8': [...E.YOUNG_VR_TYPES, 'odd-two'], '8-9': ['odd-two','word-grid','letter-pair','shared-letters','hidden-word'] }
for (const [band, types] of Object.entries(fams)) for (const t of types) {
  const sig = new Set(), ans = new Set(); let ok = 0
  const N = 3000
  for (let s = 1; s <= N; s++) {
    const it = E.generateItem(band, t, s)
    if (!it) continue
    ok++; sig.add(E.itemSignature(it))
    ans.add(it.correct.map(i => it.options[i].text).join('+'))
  }
  console.log(band, t.padEnd(17), 'yield', (ok/N*100).toFixed(0)+'%', 'distinct', sig.size, 'answers', ans.size)
}
