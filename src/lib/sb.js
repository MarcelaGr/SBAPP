function sanitizeToken(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
}

export function normalizeSbNumber(value) {
  const raw = sanitizeToken(value)
  if (!raw) return ''

  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (compact.startsWith('SB')) {
    const suffix = compact.slice(2)
    return suffix ? `SB ${suffix}` : 'SB'
  }

  return raw.toUpperCase()
}

export function getSbSearchTokens(...values) {
  return values
    .flat()
    .filter(Boolean)
    .map((value) => normalizeSbNumber(value))
    .flatMap((value) => [value, value.replace(/\s+/g, '')])
    .filter(Boolean)
}

export function getEntitySbNumber(entity) {
  return normalizeSbNumber(entity?.sb_number || entity?.cases?.sb_number || entity?.client?.sb_number || '')
}
