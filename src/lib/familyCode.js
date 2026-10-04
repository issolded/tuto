// An existing family code is permanent: failed reads must never rotate it.
export async function ensureFamilyCode(client, parentId) {
  const read = () => client.from('parents').select('family_code').eq('id', parentId).single()
  const current = await read()
  if (current.error) throw current.error
  if (!current.data) throw new Error('Parent not found')
  if (current.data.family_code) return current.data.family_code
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const code = Array.from(bytes, n => alphabet[n % alphabet.length]).join('')
  const result = await client.from('parents').update({ family_code: code })
    .eq('id', parentId).is('family_code', null)
  if (result.error) throw result.error
  // A simultaneous setup may have won the conditional write. Use the stored winner.
  const saved = await read()
  if (saved.error) throw saved.error
  if (!saved.data?.family_code) throw new Error('Family code unavailable')
  return saved.data.family_code
}
