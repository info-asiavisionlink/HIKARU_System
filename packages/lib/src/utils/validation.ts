// ============================================================
// 共通バリデーション関数
// ============================================================

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function isValidImageFile(file: File): boolean {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  return allowedTypes.includes(file.type)
}

export function isValidPdfFile(file: File): boolean {
  return file.type === 'application/pdf'
}

export function isValidVideoFile(file: File): boolean {
  const allowedTypes = ['video/mp4', 'video/webm']
  return allowedTypes.includes(file.type)
}

export function isWithinFileSizeLimit(
  file: File,
  limitMB: number
): boolean {
  return file.size <= limitMB * 1024 * 1024
}

export const FILE_SIZE_LIMITS = {
  IMAGE_MB: 10,
  PDF_MB: 50,
  VIDEO_MB: 500,
} as const
