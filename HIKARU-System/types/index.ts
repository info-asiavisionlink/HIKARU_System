// 共有型をre-export
export type {
  UserRole,
  JobStatus,
  PhotoType,
  ManualType,
  QualityRecommendation,
  AppUser,
  Job,
  Photo,
  Location,
  Manual,
  AIEvaluation,
  Report,
  ChatMessage,
  ServiceResult,
  ApiResponse,
  ManualChatRequest,
  ManualChatResponse,
  PhotoQualityCheckRequest,
  PhotoQualityCheckResponse,
  PhotoEvaluationRequest,
  PhotoEvaluationResponse,
  ReportGenerateRequest,
  ReportGenerateResponse,
} from '@hikaru/types'

// HIKARU-System固有の型
export interface JobWithRelations extends Job {
  project: {
    id: string
    name: string
    storeId: string
    storeName: string
  }
  locations: Location[]
}

export interface PhotoWithEvaluation extends Photo {
  evaluation?: AIEvaluation
}

export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: Error | null
}

// 再エクスポートのためのJob型（循環参照回避）
import type { Job } from '@hikaru/types'
