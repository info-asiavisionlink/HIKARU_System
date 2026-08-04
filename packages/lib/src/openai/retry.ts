// ============================================================
// OpenAI API 呼び出し共通ラッパー
// リトライ・タイムアウト・エラー正規化を担当
// ============================================================

export interface OpenAICallOptions {
  maxRetries?: number     // デフォルト: 2
  baseDelayMs?: number    // デフォルト: 1000ms
  timeoutMs?: number      // デフォルト: 30000ms
}

const DEFAULT_OPTIONS: Required<OpenAICallOptions> = {
  maxRetries:  2,
  baseDelayMs: 1000,
  timeoutMs:   30000,
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRateLimitError(err: unknown): boolean {
  return (err as any)?.status === 429
}

function isServerError(err: unknown): boolean {
  const status = (err as any)?.status
  return status >= 500 && status < 600
}

function isRetryable(err: unknown): boolean {
  return isRateLimitError(err) || isServerError(err)
}

/**
 * OpenAI APIを呼び出し、一時的エラー時にリトライする。
 * 429(レート制限)・5xx(サーバーエラー)のみリトライ対象。
 * 開発ログはconsolesに出力しない（本番ログ基盤で管理）。
 */
export async function withOpenAIRetry<T>(
  fn: () => Promise<T>,
  opts: OpenAICallOptions = {}
): Promise<T> {
  const { maxRetries, baseDelayMs, timeoutMs } = { ...DEFAULT_OPTIONS, ...opts }

  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController()
    const timeout    = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const result = await fn()
      clearTimeout(timeout)
      return result
    } catch (err) {
      clearTimeout(timeout)
      lastError = err

      if (controller.signal.aborted) {
        throw new Error(`OpenAI API タイムアウト (${timeoutMs}ms)`)
      }

      if (attempt < maxRetries && isRetryable(err)) {
        const delay = baseDelayMs * Math.pow(2, attempt) // 指数バックオフ
        await sleep(delay)
        continue
      }

      break
    }
  }

  // エラーを正規化して投げ直す
  if (lastError instanceof Error) throw lastError
  throw new Error(`OpenAI API エラー: ${String(lastError)}`)
}
