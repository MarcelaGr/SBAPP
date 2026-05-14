export const ROLES = {
  admin: 'admin',
  attorney: 'attorney',
}

export const INITIAL_USER_SEEDS = [
  { name: 'Muna', email: 'muna@stonebusailah.com', role: ROLES.admin },
  { name: 'Marcela', email: 'marcela@stonebusailah.com', role: ROLES.attorney },
  { name: 'M. Grecco', email: 'm.grecco@police-defense.com', role: ROLES.attorney },
]

export function normalizeRole(value, fallback = ROLES.attorney) {
  if (!value) return fallback
  const normalized = String(value).trim().toLowerCase()
  if (normalized === ROLES.admin) return ROLES.admin
  if (normalized === ROLES.attorney) return ROLES.attorney
  return fallback
}

export function isAdminRole(value) {
  return normalizeRole(value) === ROLES.admin
}

export function isAttorneyRole(value) {
  return [ROLES.admin, ROLES.attorney].includes(normalizeRole(value))
}

export function canManageInvoices(role) {
  return isAdminRole(role)
}

export function canManageSettings(role) {
  return isAdminRole(role)
}
