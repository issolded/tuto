// Extended seed sweep; run with: node scripts/puzzle-spatial-stress.mjs
import assert from 'node:assert/strict'
import {generateQuestion,generateSession,validateQuestion,figureKey} from '../src/lib/puzzleTemplates.js'
import {SPATIAL_TYPES} from '../src/lib/puzzleSpatial.js'
import {spatialOracle} from './lib/spatial-oracle.mjs'
const start=performance.now()
for(const type of SPATIAL_TYPES){
 const slots=[0,0,0,0,0];let max=0
 for(let i=0;i<5000;i++){
  const seed=(0x9e3779b9*(i+11))>>>0, before=performance.now()
  const q=generateQuestion(type==='hidden-part'?'6-7':'11-12',type,seed,{icons:false})
  max=Math.max(max,performance.now()-before)
  assert.ok(q,`${type} ${seed} empty`);assert.equal(q.type,type)
  assert.equal(validateQuestion(q),null,`${type} ${seed}`)
  assert.equal(spatialOracle(q),null,`${type} ${seed}`)
  for(let k=0;k<5;k++)if(k!==q.correct_index)assert.ok(spatialOracle({...q,correct_index:k}))
  slots[q.correct_index]++
  if(type==='matrix') assert.ok(q.prompt.filter(Boolean).every(p=>figureKey(p)!==figureKey(q.options[q.correct_index].spec)))
 }
 console.log(type,'5000 passed, slots',slots,'max generation ms',max.toFixed(1))
}
for(const band of ['6-7','11-12']){
 let repeated=0,max=0
 for(let i=0;i<500;i++){
  const before=performance.now(),seed=(0x85ebca6b*(i+23))>>>0
  const qs=generateSession(band,10,seed,{icons:i%2===0})
  max=Math.max(max,performance.now()-before)
  assert.equal(qs.length,10)
  assert.equal(JSON.stringify(qs),JSON.stringify(generateSession(band,10,seed,{icons:i%2===0})))
  qs.forEach(q=>assert.equal(validateQuestion(q),null))
  const types=qs.map(q=>q.type);if(types.some(t=>types.filter(v=>v===t).length>2))repeated++
 }
 console.log(band,'500 complete/reproducible sessions, type-cap exceptions',repeated,'max session ms',max.toFixed(1))
}
console.log('elapsed ms',(performance.now()-start).toFixed(0))
