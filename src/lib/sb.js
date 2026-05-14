function sanitizeToken(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
}

export function sanitizeSbNumberInput(value) {
  return String(value || '')
    .replace(/[‐‑‒–—―]/g, '-')
    .replace(/[^A-Z0-9-\s]/gi, '')
}

export function isValidSbNumber(value) {
  const cleaned = sanitizeToken(value)
  if (!cleaned) return true
  return /^[A-Z0-9][A-Z0-9-\s]*$/i.test(cleaned)
}

export function normalizeSbNumber(value) {
  const raw = sanitizeToken(sanitizeSbNumberInput(value))
  if (!raw) return ''

  const cleaned = raw
    .toUpperCase()
    .replace(/[^A-Z0-9-\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) return ''

  if (cleaned === 'SB') return 'SB'

  if (cleaned.startsWith('SB ')) {
    const suffix = cleaned.slice(3).trim()
    return suffix ? `SB ${suffix}` : 'SB'
  }

  return cleaned
}

export function getSbSearchTokens(...values) {
  return values
    .flat()
    .filter(Boolean)
    .map((value) => normalizeSbNumber(value))
    .flatMap((value) => [value, value.replace(/[\s-]+/g, '')])
    .filter(Boolean)
}

export function getEntitySbNumber(entity) {
  return normalizeSbNumber(entity?.sb_number || entity?.cases?.sb_number || entity?.client?.sb_number || '')
}
