import test from 'node:test'
import assert from 'node:assert/strict'
import { BANDS, bandForAge, generateQuestion, generateSession, validateQuestion } from '../../src/lib/puzzleTemplates.js'
import { foldNet, cubeFits, SPATIAL_TYPES } from '../../src/lib/puzzleSpatial.js'
import { spatialOracle } from '../lib/spatial-oracle.mjs'

test('age routing preserves established child bands and fills the two gaps', () => {
  assert.deepEqual([5,6,7,8,9,10,11,12,13].map(bandForAge),
    ['5-6','6-7','7-8','8-9','9-10','10-11','11-12','11-12','11-12'])
  assert.equal(bandForAge(undefined), '5-6')
})

test('spatial answers survive independent solving and reject every wrong key', () => {
  for (const type of SPATIAL_TYPES) for (let i=0;i<200;i++) {
    const band=type==='hidden-part'?'6-7':'11-12'
    const q=generateQuestion(band,type,260926+i*41,{icons:false})
    assert.ok(q, `${type} seed ${i}`)
    assert.equal(q.type,type)
    assert.equal(validateQuestion(q),null)
    assert.equal(spatialOracle(q),null,`${type} ${q.seed}`)
    for(let k=0;k<5;k++) if(k!==q.correct_index) {
      assert.ok(validateQuestion({...q,correct_index:k}))
      assert.ok(spatialOracle({...q,correct_index:k}))
    }
    // The correct figure itself must also be checked, not merely the index.
    const corrupted=JSON.parse(JSON.stringify(q))
    const answer=corrupted.options[q.correct_index].spec
    if(answer.form==='cube') [answer.faces[0],answer.faces[1]]=[answer.faces[1],answer.faces[0]]
    else answer.parts[0].fill=1-answer.parts[0].fill
    if(type!=='cube-net' && type!=='hidden-part') assert.ok(validateQuestion(corrupted),`${type} corruption seed ${q.seed}`)
  }
})

test('folding rejects overlapping nets, opposite neighbours and mirror-handed corners', () => {
  const cells=[[1,0],[0,1],[1,1],[2,1],[1,2],[1,3]].map(([x,y],symbol)=>({x,y,symbol}))
  const net={cells}
  assert.equal(foldNet(cells).length,6)
  const cube=faces=>({faces})
  assert.equal(cubeFits(net,cube([0,2,1])),false)
  assert.equal(cubeFits(net,cube([0,1,2])),true) // same three faces, physically valid order
  assert.equal(cubeFits(net,cube([0,4,2])),false) // top and bottom are opposite
  assert.equal(cubeFits(net,cube([0,2,0])),false)
  assert.equal(foldNet(Array.from({length:6},(_,x)=>({x,y:0,symbol:x}))),null)
})

test('both new bands fill sessions without the icon font', () => {
  for(const band of ['6-7','11-12']) for(let seed=0;seed<100;seed++) {
    const session=generateSession(band,10,seed,{icons:false})
    assert.equal(session.length,10)
    assert.ok(session.every(q=>q.band===band && validateQuestion(q)===null))
  }
})

// Physical fixture: north folds to the top, centre is left/front, east is right/front.
// These expected faces are NOT derived from either folding implementation.
test('physical cross net fixes chirality in both engine and oracle', () => {
  const net={cells:[[1,0],[0,1],[1,1],[2,1],[1,2],[1,3]].map(([x,y],symbol)=>({x,y,symbol}))}
  assert.equal(cubeFits(net,{faces:[0,2,3]}),true)
  assert.equal(cubeFits(net,{faces:[0,3,2]}),false)
  const q={type:'cube-net',prompt:[net],options:[{spec:{faces:[0,2,3]}},{spec:{faces:[0,3,2]}}],correct_index:0,stem_key:'puzzle_stem_cube'}
  assert.equal(spatialOracle(q),null)
  assert.ok(spatialOracle({...q,correct_index:1}))
  assert.equal(spatialOracle({...q,stem_key:'puzzle_stem_cube_not',correct_index:1}),null)
})

test('older band retains all established types and younger band includes semantic analogy', () => {
  for(const type of BANDS['10-11'].types) assert.ok(BANDS['11-12'].types.includes(type),type)
  assert.ok(BANDS['6-7'].glyphTypes.includes('glyph-analogy'))
})
