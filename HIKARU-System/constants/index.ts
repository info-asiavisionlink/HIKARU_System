// ============================================================
// HIKARU-System 定数
// ============================================================

export const APP = {
  NAME: 'HIKARU System',
  VERSION: '0.1.0',
} as const

export const ROUTES = {
  LOGIN: '/login',
  JOBS: '/jobs',
  JOB: (jobId: string) => `/jobs/${jobId}`,
  MANUAL: (jobId: string) => `/jobs/${jobId}/manual`,
  BEFORE: (jobId: string) => `/jobs/${jobId}/before`,
  AFTER: (jobId: string) => `/jobs/${jobId}/after`,
  REPORT: (jobId: string) => `/jobs/${jobId}/report`,
} as const

export const API = {
  AI_MANUAL: '/api/ai/manual',
  AI_QUALITY: '/api/ai/quality',
  AI_REPORT: '/api/ai/report',
  JOBS: '/api/jobs',
  PHOTOS: '/api/photos',
} as const

export const QUALITY_THRESHOLDS = {
  PASS: 80,
  CHECK: 60,
} as const

export const PHOTO = {
  MAX_SIZE_MB: 10,
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp'] as const,
} as const

export const LOCATION_PRESETS = [
  '入口',
  '床',
  'トイレ',
  '厨房',
  '窓',
  '壁',
  'テーブル',
  '椅子',
] as const
