// ============================================================
// API レスポンス・リクエスト共通型定義
// ============================================================

// ---- 共通レスポンス ----

export interface ApiSuccess<T> {
  success: true
  data: T
}

export interface ApiError {
  success: false
  error: {
    code: string
    message: string
  }
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

// ---- サービス層レスポンス ----

export interface ServiceResult<T> {
  data: T | null
  error: Error | null
}

// ---- ページネーション ----

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// ---- エラーコード ----

export const API_ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AI_ERROR: 'AI_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export type ApiErrorCode = typeof API_ERROR_CODES[keyof typeof API_ERROR_CODES]

// ---- AI API レスポンス ----

export interface ManualChatRequest {
  jobId: string
  projectId: string
  message: string
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>
}

export interface ManualChatResponse {
  reply: string
  sources: string[]
}

export interface PhotoQualityCheckRequest {
  photoBase64: string
  locationName: string
}

export interface PhotoQualityCheckResponse {
  isValid: boolean
  issues: string[]
  message: string
}

export interface PhotoEvaluationRequest {
  jobId: string
  locationId: string
  beforePhotoUrl: string
  afterPhotoUrl: string
}

export interface PhotoEvaluationResponse {
  score: number
  passed: boolean
  evaluation: {
    dirtyRemoval: number
    oilStain: number
    dust: number
    shine: number
  }
  comment: string
  recommendation: 'pass' | 'check' | 'redo'
}

export interface ReportGenerateRequest {
  jobId: string
}

export interface ReportGenerateResponse {
  reportId: string
  totalScore: number
  aiSummary: string
  pdfUrl: string
}
