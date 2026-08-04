export const APP = {
  NAME: 'HIKARU CONSOLE',
  VERSION: '0.1.0',
} as const

export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  PROJECTS: '/projects',
  PROJECT: (id: string) => `/projects/${id}`,
  PROJECT_NEW: '/projects/new',
  CLIENTS: '/clients',
  CLIENT: (id: string) => `/clients/${id}`,
  WORKERS: '/workers',
  WORKER: (id: string) => `/workers/${id}`,
  MANUALS: '/manuals',
  ANALYTICS: '/analytics',
  ANALYTICS_STORE: (id: string) => `/analytics/store/${id}`,
  ANALYTICS_WORKER: (id: string) => `/analytics/worker/${id}`,
  SETTINGS: '/settings',
} as const

export const API = {
  AI_ANALYZE: '/api/ai/analyze',
  PROJECTS: '/api/projects',
  CLIENTS: '/api/clients',
  WORKERS: '/api/workers',
  MANUALS: '/api/manuals',
} as const

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
} as const
