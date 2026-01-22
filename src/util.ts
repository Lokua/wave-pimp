const SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

export function formatSize(bytes: number): string {
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < SIZE_UNITS.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  const rounded =
    unitIndex === 0 || size >= 10 ? Math.round(size) : Math.round(size * 10) / 10

  return `${rounded} ${SIZE_UNITS[unitIndex]}`
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) {
    return '0:00'
  }

  const totalSeconds = Math.max(0, Math.round(seconds))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const remainderSeconds = totalSeconds % 60
  const paddedMinutes = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes)
  const paddedSeconds = String(remainderSeconds).padStart(2, '0')

  return hours > 0
    ? `${hours}:${paddedMinutes}:${paddedSeconds}`
    : `${minutes}:${paddedSeconds}`
}
