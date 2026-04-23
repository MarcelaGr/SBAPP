import { getEntitySbNumber, getSbSearchTokens, normalizeSbNumber } from './sb'

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export function buildSearchText(values) {
  return values
    .flat()
    .filter((value) => value !== null && value !== undefined)
    .map((value) => normalizeText(value))
    .join(' ')
}

export function matchesSearch(values, query) {
  const normalizedQuery = normalizeText(query)
  if (!normalizedQuery) return true

  const haystack = buildSearchText(values)
  if (haystack.includes(normalizedQuery)) return true

  const sbTokens = getSbSearchTokens(values)
  const normalizedSbQuery = normalizeSbNumber(query)

  return sbTokens.some((token) => {
    const normalizedToken = normalizeText(token)
    return normalizedToken.includes(normalizedQuery) || normalizedToken.includes(normalizeText(normalizedSbQuery))
  })
}

export function getCaseSearchValues(caseItem) {
  return [
    getEntitySbNumber(caseItem),
    caseItem?.clients?.first_name,
    caseItem?.clients?.last_name,
    caseItem?.brief_description,
    caseItem?.full_description,
    caseItem?.association_case_number,
    caseItem?.associations?.short_name,
    caseItem?.associations?.name,
    caseItem?.case_type,
    caseItem?.status,
  ]
}

export function getClientSearchValues(client) {
  return [
    getEntitySbNumber(client),
    client?.first_name,
    client?.last_name,
    client?.email,
    client?.phone,
    client?.member_id,
    client?.associations?.short_name,
    client?.associations?.name,
    client?.notes,
  ]
}

export function getCalendarEventSearchValues(event) {
  return [
    event?.title,
    event?.event_type,
    event?.location_notes,
    event?.staff?.full_name,
    event?.staff?.initials,
    event?.cases?.sb_number,
    event?.cases?.brief_description,
  ]
}

export function getTimeslipSearchValues(entry) {
  return [
    entry?.cases?.sb_number,
    entry?.cases?.brief_description,
    entry?.cases?.clients?.first_name,
    entry?.cases?.clients?.last_name,
    entry?.description,
    entry?.staff?.full_name,
    entry?.staff?.initials,
    entry?.status,
  ]
}
