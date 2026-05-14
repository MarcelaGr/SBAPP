export const PRIVATE_CASE_TYPES = ['TRST', 'FL-TRST']

export function normalizeCaseType(value) {
  return value === 'TRS' ? 'TRST' : value
}

export function getCaseTypeSearchValues(value) {
  const normalized = normalizeCaseType(value)
  return normalized === 'TRST' ? ['TRST', 'TRS'] : [normalized].filter(Boolean)
}
