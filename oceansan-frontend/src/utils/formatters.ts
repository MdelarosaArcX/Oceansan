export function formatTime12h(time: string | null): string {
  if (!time) return '—'

  const parts = time.split(':')
  if (parts.length !== 2) return '—'

  const h = Number(parts[0])
  const m = Number(parts[1])

  // Validate
  if (isNaN(h) || isNaN(m)) return '—'

  const hour12 = h % 12 || 12
  const ampm = h >= 12 ? 'pm' : 'am'

  return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`
}
