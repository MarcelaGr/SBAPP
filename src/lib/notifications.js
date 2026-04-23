export function buildNotificationId(prefix = 'notification') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function createNotification({
  id = buildNotificationId(),
  type = 'info',
  title,
  body = '',
  entityType,
  entityId,
  createdAt = new Date().toISOString(),
  read = false,
}) {
  return {
    id,
    type,
    title,
    body,
    entityType,
    entityId,
    createdAt,
    read,
  }
}
