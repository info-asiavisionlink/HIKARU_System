// ============================================================
// AI API in-memory Rate Limiter
//
// ⚠️ 重要な制限事項:
//   - Vercel serverless はリクエストごとに独立したインスタンスで動作するため
//     このMapはインスタンス間で共有されない
//   - Cold Start時にカウンタはリセットされる
//   - これは「正式 Rate Limit」ではなく「初期防御」として機能する
//   - Phase C 以降で Upstash Redis 等の共有型 Rate Limit へ移行予定
// ============================================================

interface RateLimitEntry {
  count:   number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

/**
 * Rate Limit チェック
 * @returns true = リクエスト許可, false = 制限超過(429)
 */
export function checkRateLimit(
  key:      string,
  limit:    number,
  windowMs: number
): boolean {
  const now   = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= limit) return false

  entry.count++
  return true
}

// Worker単位の設定: 60 req / 60s
export const WORKER_RATE_LIMIT  = { limit: 60,  windowMs: 60_000 }

// Company単位の設定: 300 req / 60s（将来のcompany_id取得後に使用）
export const COMPANY_RATE_LIMIT = { limit: 300, windowMs: 60_000 }

// 429レスポンスを生成
export function rateLimitExceededResponse(): Response {
  return Response.json(
    {
      success: false,
      error: {
        code:    'RATE_LIMIT_EXCEEDED',
        message: 'AI利用回数が一時的な上限に達しました。少し時間をおいて再度お試しください。',
      },
    },
    { status: 429 }
  )
}
