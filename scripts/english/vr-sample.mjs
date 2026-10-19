// Seven real questions per VR family, for reading the prerequisite table against the items (docs/ENGLISH-VR-PREREQUISITES.md).
//   node scripts/english/vr-sample.mjs > /tmp/vr-sample.txt
const E = await import(new URL('../../src/lib/englishTemplates.js', import.meta.url))
const { VR_FAMILIES } = await import(new URL('../../src/lib/literacy/vrPrereqs.js', import.meta.url))
const stem = k => k
const seedsFor = 7
for (const f of VR_FAMILIES) {
  console.log(`\n## ${f.band} ${f.type} [${f.load}] needs ${JSON.stringify(f.needs)} probes ${f.probes.join(',')}`)
  let shown = 0
  for (let s = 101; shown < seedsFor && s < 400; s += 37) {
    const q = E.generateItem(f.band, f.type, s)
    if (!q) continue
    shown++
    const ans = q.correct.map(i => q.options[i].text).join(' + ')
    console.log(`- ${stem(q.stem_key)} | ${JSON.stringify(q.prompt)} | ${q.options.map(o => o.text).join(' / ')} | => ${ans}`)
  }
}
