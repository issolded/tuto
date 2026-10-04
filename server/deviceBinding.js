import { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto'
const PURPOSE = 'tuto-child-device-v1'
function signature(payload, secret) {
 if (!secret) throw new Error('Device signing key unavailable')
 return createHmac('sha256', secret).update(PURPOSE + ':' + payload).digest('base64url')
}
export function issueDeviceBinding(parentId, childId, secret, now = Date.now()) {
 const body = Buffer.from(JSON.stringify({ parentId, childId, deviceId: randomUUID(), exp: now + 365 * 86400000 })).toString('base64url')
 return body + '.' + signature(body, secret)
}
export function verifyDeviceBinding(token, secret, now = Date.now()) {
 try {
  if (typeof token !== 'string' || token.length > 2048) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const expected = Buffer.from(signature(parts[0], secret))
  const actual = Buffer.from(parts[1])
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
  const data = JSON.parse(Buffer.from(parts[0], 'base64url').toString())
  return data.parentId && data.childId && data.deviceId && data.exp > now ? data : null
 } catch { return null }
}
