export type {
  UserRole,
  ProjectStatus,
  JobStatus,
  AppUser,
  Company,
  Client,
  Store,
  Project,
  Location,
  Manual,
  Job,
  Photo,
  AIEvaluation,
  Report,
  ServiceResult,
  ApiResponse,
  PaginatedResult,
} from '@hikaru/types'

// HIKARU-CONSOLE固有の型

export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: Error | null
}

export interface DashboardStats {
  todayJobs: number
  completedJobs: number
  averageScore: number
  pendingAlerts: number
}

export interface ProjectWithRelations extends Project {
  store: Store
  client: Client
  locations: Location[]
  manuals: Manual[]
}

// 循環参照回避のためのimport
import type { Project, Store, Client, Location, Manual } from '@hikaru/types'
