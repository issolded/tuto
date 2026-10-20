import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import {questionKind,operationSigns} from '../../src/lib/reviewQuestions.js'
const context=vm.createContext({console,TextEncoder,TextDecoder})
vm.runInContext(readFileSync(new URL('../androidApp/src/main/assets/engine/math.js',import.meta.url),'utf8'),context)
let count=0
for(const lang of ['en','tr','es']) for(const age of [7,9,12]) {
 const session=JSON.parse(context.TutoMath.buildSession(JSON.stringify({age,lang,count:10})))
 for(const q of session.questions.slice(0,3)) {
  const r=JSON.parse(context.TutoMath.review(JSON.stringify(q),lang))
  assert.equal(r.topic_id,q.topic_id)
  assert.equal(questionKind(r.operand_key),questionKind(q.operand_key))
  assert.equal(operationSigns(r.question),operationSigns(q.question))
  assert.ok(r.answer!=null)
  count++
 }
}
console.log(`${count} same-skill native review questions passed`)
