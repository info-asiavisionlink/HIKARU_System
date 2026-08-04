// ============================================================
// 共通フォーマット関数
// ============================================================

export function formatDate(dateString: string, locale = 'ja-JP'): string {
  return new Date(dateString).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function formatDateTime(dateString: string, locale = 'ja-JP'): string {
  return new Date(dateString).toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatScore(score: number): string {
  return `${score}点`
}

export function getScoreLabel(score: number): {
  label: string
  variant: 'pass' | 'check' | 'fail'
} {
  if (score >= 80) return { label: '合格', variant: 'pass' }
  if (score >= 60) return { label: '要確認', variant: 'check' }
  return { label: '再清掃', variant: 'fail' }
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}...`
}
