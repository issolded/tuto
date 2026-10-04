import { test } from 'node:test'
import assert from 'node:assert/strict'
import { issueDeviceBinding, verifyDeviceBinding } from '../../server/deviceBinding.js'
import { matchFamilyChild } from '../../server/familyPin.js'
const key='test-only-secret-not-a-production-key'
test('devices for siblings remain independent',()=>{
 const alp=issueDeviceBinding('family','alp',key,1000), sarp=issueDeviceBinding('family','sarp',key,1000)
 assert.equal(verifyDeviceBinding(alp,key,2000).childId,'alp')
 assert.equal(verifyDeviceBinding(sarp,key,2000).childId,'sarp')
 assert.notEqual(verifyDeviceBinding(alp,key,2000).deviceId,verifyDeviceBinding(sarp,key,2000).deviceId)
})
test('changing the child, wrong key, missing and expired credentials are rejected',()=>{
 const token=issueDeviceBinding('family','alp',key,1000)
 const [body,sig]=token.split('.')
 const data=JSON.parse(Buffer.from(body,'base64url').toString());data.childId='sarp'
 assert.equal(verifyDeviceBinding(Buffer.from(JSON.stringify(data)).toString('base64url')+'.'+sig,key,2000),null)
 assert.equal(verifyDeviceBinding(token,'wrong-key',2000),null)
 assert.equal(verifyDeviceBinding(null,key,2000),null)
 assert.equal(verifyDeviceBinding(token,key,1000+365*86400000),null)
})
test('only bound child can match a PIN, even when siblings share a PIN',()=>{
 const binding=verifyDeviceBinding(issueDeviceBinding('family','alp',key,1000),key,2000)
 assert.equal(matchFamilyChild([{id:'alp',pin_hash:'a'},{id:'sarp',pin_hash:'s'}],'s',binding.childId),null)
 assert.equal(matchFamilyChild([{id:'alp',pin_hash:'same'},{id:'sarp',pin_hash:'same'}],'same',binding.childId).id,'alp')
})
