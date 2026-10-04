export function matchFamilyChild(children, pinHash, childId) {
  const matches = (children || []).filter(c => c.pin_hash === pinHash && (!childId || c.id === childId))
  return matches.length === 1 ? matches[0] : null
}
