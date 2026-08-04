import { createOpenAIClient, OPENAI_MODELS } from '@/lib/openai/client'
import {
  STORE_ANALYSIS_PROMPT,
  OVERVIEW_ANALYSIS_PROMPT,
  TRENDS_ANALYSIS_PROMPT,
  WORKER_FEEDBACK_PROMPT,
} from './prompts'
import type { ServiceResult } from '@/types'

// ============================================================
// 型定義
// ============================================================

export interface StoreAnalysisResult {
  trend: 'improving' | 'declining' | 'stable'
  issues: string[]
  suggestions: string[]
  summary: string
}

export interface OverviewAnalysisResult {
  overallAssessment: string
  strengths: string[]
  concerns: string[]
  suggestions: { priority: 'high' | 'medium' | 'low'; title: string; detail: string }[]
  trend: 'improving' | 'declining' | 'stable'
}

export interface TrendsAnalysisResult {
  trendComment: string
  spotInsights: { spot: string; comment: string }[]
  warnings: string[]
  forecast: string
}

export interface WorkerFeedbackResult {
  overallFeedback: string
  strengths: string[]
  improvements: string[]
  trainingAdvice: string
}

// ============================================================
// 店舗分析
// ============================================================

export async function analyzeStoreData(
  storeName: string,
  data: Record<string, unknown>
): Promise<ServiceResult<StoreAnalysisResult>> {
  try {
    const openai = createOpenAIClient()
    const response = await openai.chat.completions.create({
      model: OPENAI_MODELS.ANALYZE,
      messages: [{ role: 'user', content: STORE_ANALYSIS_PROMPT(storeName, JSON.stringify(data, null, 2)) }],
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: 800,
    })
    const result = JSON.parse(response.choices[0]?.message.content ?? '{}')
    return { data: result as StoreAnalysisResult, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('分析に失敗しました') }
  }
}

// ============================================================
// 全体サマリー分析
// ============================================================

export async function analyzeOverview(
  data: Record<string, unknown>
): Promise<ServiceResult<OverviewAnalysisResult>> {
  try {
    const openai = createOpenAIClient()
    const response = await openai.chat.completions.create({
      model: OPENAI_MODELS.ANALYZE,
      messages: [{ role: 'user', content: OVERVIEW_ANALYSIS_PROMPT(JSON.stringify(data, null, 2)) }],
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: 1000,
    })
    const result = JSON.parse(response.choices[0]?.message.content ?? '{}')
    return { data: result as OverviewAnalysisResult, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('分析に失敗しました') }
  }
}

// ============================================================
// 時系列トレンド分析
// ============================================================

export async function analyzeTrends(
  data: Record<string, unknown>
): Promise<ServiceResult<TrendsAnalysisResult>> {
  try {
    const openai = createOpenAIClient()
    const response = await openai.chat.completions.create({
      model: OPENAI_MODELS.ANALYZE,
      messages: [{ role: 'user', content: TRENDS_ANALYSIS_PROMPT(JSON.stringify(data, null, 2)) }],
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: 1000,
    })
    const result = JSON.parse(response.choices[0]?.message.content ?? '{}')
    return { data: result as TrendsAnalysisResult, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('分析に失敗しました') }
  }
}

// ============================================================
// 作業者フィードバック
// ============================================================

export async function analyzeWorkerPerformance(
  workerName: string,
  data: Record<string, unknown>
): Promise<ServiceResult<WorkerFeedbackResult>> {
  try {
    const openai = createOpenAIClient()
    const response = await openai.chat.completions.create({
      model: OPENAI_MODELS.ANALYZE,
      messages: [{ role: 'user', content: WORKER_FEEDBACK_PROMPT(workerName, JSON.stringify(data, null, 2)) }],
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: 800,
    })
    const result = JSON.parse(response.choices[0]?.message.content ?? '{}')
    return { data: result as WorkerFeedbackResult, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('分析に失敗しました') }
  }
}
