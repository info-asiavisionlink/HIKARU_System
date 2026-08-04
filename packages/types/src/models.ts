// ============================================================
// HIKARUドメインモデル型定義
// Supabaseのスキーマと対応する
// ============================================================

export type UserRole = 'admin' | 'worker' | 'client'
export type EmployeeStatus = 'active' | 'on_leave' | 'resigned' | 'suspended' | 'deleted'
export type PartnerStatus = 'active' | 'suspended' | 'terminated' | 'deleted'
export type AssigneeType = 'employee' | 'partner'

export type ProjectStatus = 'active' | 'paused' | 'completed' | 'cancelled'

export type JobStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

export type PhotoType = 'before' | 'after'

export type ManualType = 'pdf' | 'text' | 'image' | 'video' | 'faq' | 'note'

export type QualityRecommendation = 'pass' | 'check' | 'redo'

export type ChatRole = 'user' | 'assistant'

// ---- エンティティ型 ----

export interface AppUser {
  id: string
  email: string
  name: string
  role: UserRole
  companyId: string | null
  phone?: string | null
  avatarUrl?: string | null
  lastLoginAt?: string | null
  createdAt?: string
}

export interface Profile {
  id: string
  email: string
  name: string
  role: UserRole
  companyId: string | null
  phone: string | null
  avatarUrl: string | null
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Company {
  id: string
  name: string
  logoUrl: string | null
  createdAt: string
}

export interface Client {
  id: string
  companyId: string
  name: string
  code: string | null
  email: string | null
  phone: string | null
  address: string | null
  contactName: string | null
  notes: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Store {
  id: string
  clientId: string
  companyId: string
  name: string
  code: string | null
  address: string | null
  phone: string | null
  businessHours: string | null
  managerName: string | null
  emergencyContact: string | null
  contractInfo: string | null
  notes: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Location {
  id: string
  storeId: string
  name: string
  orderNum: number
  isActive: boolean
  createdAt: string
}

export interface PhotoSpot {
  id: string
  storeId: string
  name: string
  description: string | null
  orderNum: number
  isRequired: boolean
  refImageUrl: string | null
  createdAt: string
  updatedAt: string
}

export interface Project {
  id: string
  companyId: string
  storeId: string
  name: string
  code: string | null
  status: ProjectStatus
  startDate: string | null
  endDate: string | null
  contractInfo: string | null
  notes: string | null
  address: string | null
  assignedTo: string | null
  createdAt: string
  updatedAt: string
}

export interface Manual {
  id: string
  projectId: string
  type: ManualType
  title: string
  content: string | null
  fileUrl: string | null
  orderNum: number
  createdAt: string
  updatedAt: string
}

export interface Notification {
  id: string
  companyId: string
  title: string
  body: string | null
  type: 'info' | 'warning' | 'error' | 'success'
  isRead: boolean
  targetUrl: string | null
  createdAt: string
}

export interface Job {
  id: string
  projectId: string
  workerId: string
  scheduledDate: string
  status: JobStatus
  startedAt: string | null
  completedAt: string | null
  createdAt: string
}

export interface Photo {
  id: string
  jobId: string
  locationId: string
  type: PhotoType
  url: string
  createdAt: string
}

export interface AIEvaluation {
  id: string
  jobId: string
  locationId: string
  score: number
  recommendation: QualityRecommendation
  feedback: string | null
  createdAt: string
}

export interface Report {
  id: string
  jobId: string
  content: string
  pdfUrl: string | null
  createdAt: string
}

export interface Employee {
  id: string
  employeeNumber: string | null
  companyId: string
  name: string
  nameKana: string | null
  birthDate: string | null
  gender: 'male' | 'female' | 'other' | null
  phone: string | null
  email: string | null
  address: string | null
  emergencyContact: string | null
  hireDate: string | null
  department: string | null
  position: string | null
  qualifications: string[]
  notes: string | null
  status: EmployeeStatus
  authUserId: string | null
  createdAt: string
  updatedAt: string
}

export interface Partner {
  id: string
  companyId: string
  companyName: string
  companyNameKana: string | null
  contactPersonName: string | null
  contactPersonKana: string | null
  phone: string | null
  email: string | null
  address: string | null
  billingInfo: Record<string, unknown> | null
  contractStartDate: string | null
  contractEndDate: string | null
  serviceAreas: string[]
  serviceTypes: string[]
  qualifications: string[]
  notes: string | null
  status: PartnerStatus
  authUserId: string | null
  createdAt: string
  updatedAt: string
}

export interface ProjectAssignment {
  id: string
  projectId: string
  assigneeType: AssigneeType
  assigneeId: string
  assignedAt: string
}

export interface ChatMessage {
  id: string
  jobId: string
  workerId: string
  role: ChatRole
  content: string
  createdAt: string
}
