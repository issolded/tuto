import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ensureFamilyCode } from '../../src/lib/familyCode.js'
function client(reads, winner) {
 let writes=0; let stored=null
 return {get writes(){return writes},from(){return {
 select(){return {eq(){return {single:async()=>reads.length?reads.shift():({data:{family_code:stored}})}}}},
 update(value){writes++;return {eq(){return {is:async(field,expected)=>{assert.equal(field,'family_code');assert.equal(expected,null);stored=winner||value.family_code;return {error:null}}}}}
 }}}}
}
test('a failed lookup never replaces the family code',async()=>{
 const c=client([{error:new Error('network')}]);await assert.rejects(ensureFamilyCode(c,'parent'));assert.equal(c.writes,0)
})
test('a second device retains the existing code',async()=>{
 const c=client([{data:{family_code:'EXISTING'}}]);assert.equal(await ensureFamilyCode(c,'parent'),'EXISTING');assert.equal(c.writes,0)
})
test('concurrent first setups return the code that won the conditional write',async()=>{
 const c=client([{data:{family_code:null}}],'WINNER12');assert.equal(await ensureFamilyCode(c,'parent'),'WINNER12');assert.equal(c.writes,1)
})
test('new families receive exactly eight characters',async()=>{
 const c=client([{data:{family_code:null}}]);assert.match(await ensureFamilyCode(c,'parent'),/^[A-HJ-NP-Z2-9]{8}$/)
})

import { matchFamilyChild } from '../../server/familyPin.js'
test('selected sibling cannot be replaced by another matching PIN or another family',()=>{
 const kids=[{id:'alp',pin_hash:'a'},{id:'sarp',pin_hash:'s'}]
 assert.equal(matchFamilyChild(kids,'s','alp'),null)
 assert.equal(matchFamilyChild(kids,'a','other-family'),null)
 assert.equal(matchFamilyChild(kids,'a','alp').id,'alp')
 assert.equal(matchFamilyChild(kids,'s','sarp').id,'sarp')
})
test('duplicate legacy PINs require a specific child',()=>{
 const kids=[{id:'alp',pin_hash:'same'},{id:'sarp',pin_hash:'same'}]
 assert.equal(matchFamilyChild(kids,'same'),null)
 assert.equal(matchFamilyChild(kids,'same','alp').id,'alp')
})
