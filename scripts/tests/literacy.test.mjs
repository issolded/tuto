import test from 'node:test'
import assert from 'node:assert/strict'
import { WORDS, CLOZE, BE_FRAMES, PASSAGES } from '../../src/lib/literacy/content.js'
import { SKILLS, generateItem, generateSession, markAnswer, validateItem, summarize } from '../../src/lib/literacy/engine.js'

test('pilot bank has stable unique IDs and explicit common-variety source metadata',()=>{
 assert.equal(WORDS.length,100);assert.equal(PASSAGES.length,6)
 for(const bank of [WORDS,CLOZE,BE_FRAMES,PASSAGES]) assert.equal(new Set(bank.map(x=>x.id)).size,bank.length)
 assert.equal(new Set(WORDS.map(x=>x.word)).size,100)
 for(const w of WORDS){assert.equal(w.variety,'shared');assert.ok(w.meaning.length>12);assert.ok(!w.meaning.toLowerCase().split(/[^a-z]+/).includes(w.word), `Meaning leaks ${w.word}`)}
 for(const p of PASSAGES){for(const d of p.details){assert.equal(d.length,5);assert.ok(p.sentences[d[4]]);assert.equal(new Set(d.slice(1,4)).size,3)}}
})

test('5,000 generated questions validate; mutation of keys and choices is rejected',()=>{
 for(const skill of Object.keys(SKILLS))for(let i=1;i<=500;i++){
  const q=generateItem(skill,i*7919)
  assert.deepEqual(validateItem(q),[])
  assert.ok(validateItem({...q,answer:'INVALID'}).length)
  if(q.options){
   assert.ok(validateItem({...q,options:q.options.map(()=>({id:'x',text:q.answer}))}).length)
   for(const o of q.options)assert.equal(markAnswer(q,o.id).correct,o.text===q.answer)
  } else {
   assert.equal(markAnswer(q,q.answer).correct,true)
   assert.equal(markAnswer(q,q.answer+'x').correct,false)
  }
 }
})

test('grammar answers satisfy independent grammatical expectations',()=>{
 for(let i=1;i<=300;i++){
  const q=generateItem('be',i*101)
  const subject=q.stem.split(' ___ ')[0]
  const expected=subject==='I'?'am':/^(You|We|They|The cats|The dogs|The books|The cups)$/.test(subject)?'are':'is'
  assert.equal(q.answer,expected)
  const p=generateItem('plural',i)
  assert.equal(p.answer,p.sourceId+'s');assert.ok(!p.answer.includes("'"))
  const cap=generateItem('capital',i)
  assert.match(cap.answer,/^[A-Z]/)
  assert.equal(cap.options.filter(o=>/^[A-Z][^A-Z]*[.!?]$/.test(o.text)).length,1)
 }
})

test('session determinism, one skill each, no repeated content families',()=>{
 for(let seed=1;seed<=200;seed++){
  const a=generateSession(seed)
  assert.deepEqual(a,generateSession(seed));assert.equal(a.items.length,10)
  assert.equal(new Set(a.items.map(x=>x.skill)).size,10)
  assert.equal(new Set(a.items.map(x=>x.family)).size,10)
 }
 const short=generateSession(10,'sequence',10)
 assert.equal(short.items.length,6);assert.equal(short.exhausted,true)
 const empty=generateSession(10,'sequence',10,short.items.map(x=>x.family))
 assert.equal(empty.items.length,0);assert.equal(empty.exhausted,true)
 assert.throws(()=>generateSession(1,'not-a-skill'))
})

test('help and skip never count as independent success; no mastery inferred',()=>{
 const q=generateItem('be',5),response=q.options.find(o=>o.text===q.answer).id
 const independent=markAnswer(q,response),supported=markAnswer(q,response,{hintUsed:true})
 const skipped=markAnswer(q,response,{skipped:true}),invalid=markAnswer(q,'tampered-id')
 assert.equal(independent.independent,true);assert.equal(supported.independent,false)
 assert.equal(supported.correct,true);assert.equal(skipped.correct,false);assert.equal(invalid.correct,false)
 const [row]=summarize([independent,supported,skipped,invalid])
 assert.deepEqual([row.seen,row.independent,row.supported,row.needsPractice],[4,1,1,2])
 assert.ok(!('level' in row));assert.ok(!('mastery' in row))
})
