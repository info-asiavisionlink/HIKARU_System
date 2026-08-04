export type ProjectStatus = 'active' | 'paused' | 'completed' | 'cancelled'

export interface ProjectRow {
  id: string
  company_id: string
  store_id: string | null
  name: string
  code: string | null
  status: ProjectStatus
  start_date: string | null
  end_date: string | null
  contract_info: string | null
  notes: string | null
  // migration 008: 案件中心設計フィールド
  location_name: string | null
  phone: string | null
  emergency_contact: string | null
  business_hours: string | null
  created_at: string
  updated_at: string
  // store_id FK が存在する場合に JOIN される
  stores?: { id: string; name: string; clients?: { id: string; name: string } | null } | null
}

export interface ProjectInsert {
  store_id?: string | null
  name: string
  code?: string | null
  status?: ProjectStatus
  start_date?: string | null
  end_date?: string | null
  contract_info?: string | null
  notes?: string | null
  location_name?: string | null
  phone?: string | null
  emergency_contact?: string | null
  business_hours?: string | null
}

// ── 一覧取得（API Route 経由 → service_role + company_id フィルタ）
export async function listProjects(opts?: {
  search?: string
  status?: ProjectStatus | ''
  page?: number
  pageSize?: number
}) {
  const params = new URLSearchParams()
  if (opts?.search)   params.set('search',   opts.search)
  if (opts?.status)   params.set('status',   opts.status)
  if (opts?.page)     params.set('page',     String(opts.page ?? 1))
  if (opts?.pageSize) params.set('pageSize', String(opts.pageSize ?? 20))

  const res = await fetch(`/api/projects?${params}`, {
    credentials: 'include',
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { data: [] as ProjectRow[], count: 0, error: new Error(body.error ?? `HTTP ${res.status}`) }
  }
  const body = await res.json()
  return { data: (body.projects ?? []) as ProjectRow[], count: body.count ?? 0, error: null }
}

// ── 単体取得（API Route 経由）
export async function getProject(id: string) {
  const res = await fetch(`/api/projects/${id}`, { credentials: 'include', cache: 'no-store' })
  if (!res.ok) return { data: null, error: new Error(`HTTP ${res.status}`) }
  const body = await res.json()
  return { data: body.project ?? null, error: null }
}

// ── 作成（API Route 経由）
export async function createProject(input: ProjectInsert) {
  const res = await fetch('/api/projects', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { data: null, error: new Error(body.error ?? `HTTP ${res.status}`) }
  }
  const body = await res.json()
  return { data: body.project ?? null, error: null }
}

// ── 更新（API Route 経由）
export async function updateProject(id: string, input: Partial<ProjectInsert> & { status?: ProjectStatus }) {
  const res = await fetch(`/api/projects/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { data: null, error: new Error(body.error ?? `HTTP ${res.status}`) }
  }
  const body = await res.json()
  return { data: body.project ?? null, error: null }
}

// ── 削除（API Route 経由）
export async function deleteProject(id: string) {
  const res = await fetch(`/api/projects/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { error: new Error(body.error ?? `HTTP ${res.status}`) }
  }
  return { error: null }
}

// ── 統計（ダッシュボード経由で取得するため不要だが互換のため残す）
export async function getProjectStats() {
  return { active: 0, paused: 0, completed: 0, cancelled: 0, total: 0 }
}
