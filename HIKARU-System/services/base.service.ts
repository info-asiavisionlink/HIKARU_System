import type { ServiceResult } from '@/types'

// ============================================================
// サービス層の基底パターン
// すべてのサービス関数はこのラッパーを使用する
// - エラーハンドリングの統一
// - ログの一元化
// ============================================================

export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context?: string
): Promise<ServiceResult<T>> {
  try {
    const data = await fn()
    return { data, error: null }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    if (process.env.NODE_ENV === 'development') {
      console.error(`[Service Error]${context ? ` [${context}]` : ''}`, error.message)
    }
    return { data: null, error }
  }
}

// ============================================================
// APIルートの共通レスポンス生成
// ============================================================

export function apiSuccess<T>(data: T, status = 200) {
  return Response.json({ success: true, data }, { status })
}

export function apiError(code: string, message: string, status = 500) {
  return Response.json(
    { success: false, error: { code, message } },
    { status }
  )
}
