import OpenAI from 'openai'

// ============================================================
// OpenAI モデル定数
// モデル変更はここだけ修正する
// ============================================================
export const OPENAI_MODELS = {
  CHAT: 'gpt-4o',
  VISION: 'gpt-4o',
  REPORT: 'gpt-4o',
  ANALYZE: 'gpt-4o',
} as const

export type OpenAIModelKey = keyof typeof OPENAI_MODELS
export type OpenAIModelValue = (typeof OPENAI_MODELS)[OpenAIModelKey]

// ============================================================
// OpenAI クライアントインスタンス
// サーバーサイド（API Routes）でのみ使用すること
// ============================================================
export function createOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured')
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}
