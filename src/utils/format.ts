function safeDate(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

export function parseIsoDate(value: string) {
  return safeDate(value)
}

export function formatTime(isoTime: string) {
  const date = safeDate(isoTime)

  if (!date) {
    return '无效时间'
  }

  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatDateTime(isoTime: string) {
  const date = safeDate(isoTime)

  if (!date) {
    return '无效时间'
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function clampText(value: string, maxLength: number) {
  return value.trim().slice(0, maxLength)
}
