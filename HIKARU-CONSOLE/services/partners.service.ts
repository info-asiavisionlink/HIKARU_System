export type PartnerStatus = 'active' | 'suspended' | 'terminated' | 'deleted'

export interface PartnerRow {
  id: string
  company_id: string
  company_name: string
  company_name_kana: string | null
  contact_person_name: string | null
  contact_person_kana: string | null
  phone: string | null
  email: string | null
  address: string | null
  billing_info: Record<string, unknown> | null
  contract_start_date: string | null
  contract_end_date: string | null
  service_areas: string[]
  service_types: string[]
  qualifications: string[]
  notes: string | null
  status: PartnerStatus
  auth_user_id: string | null
  created_at: string
  updated_at: string
}

export interface PartnerDetail extends PartnerRow {
  loginEmail: string | null
  assignments: {
    project_id: string
    assigned_at: string
    projects: { id: string; name: string; code: string | null; status: string } | null
  }[]
}

export const partnerStatusLabel: Record<PartnerStatus, string> = {
  active:     '契約中',
  suspended:  '一時停止',
  terminated: '契約終了',
  deleted:    '削除済み',
}

export const partnerStatusOptions: { value: PartnerStatus; label: string }[] = [
  { value: 'active',     label: '契約中' },
  { value: 'suspended',  label: '一時停止' },
  { value: 'terminated', label: '契約終了' },
]

export async function listPartners(opts?: {
  search?: string
  status?: PartnerStatus | ''
  page?: number
  pageSize?: number
}): Promise<{ data: PartnerRow[]; count: number }> {
  const params = new URLSearchParams()
  if (opts?.search)   params.set('search', opts.search)
  if (opts?.status)   params.set('status', opts.status)
  if (opts?.page)     params.set('page', String(opts.page))
  if (opts?.pageSize) params.set('pageSize', String(opts.pageSize))

  const res = await fetch(`/api/partners?${params}`, { credentials: 'include', cache: 'no-store' })
  if (!res.ok) return { data: [], count: 0 }
  return res.json()
}

export async function getPartner(id: string): Promise<PartnerDetail | null> {
  const res = await fetch(`/api/partners/${id}`, { credentials: 'include', cache: 'no-store' })
  if (!res.ok) return null
  const { data } = await res.json()
  return data
}

export async function createPartner(input: {
  company_name: string
  company_name_kana?: string | null
  contact_person_name?: string | null
  contact_person_kana?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  billing_info?: Record<string, unknown> | null
  contract_start_date?: string | null
  contract_end_date?: string | null
  service_areas?: string[]
  service_types?: string[]
  qualifications?: string[]
  notes?: string | null
  loginEmail?: string
  loginPassword?: string
}): Promise<{ data: PartnerRow | null; error: string | null }> {
  const res = await fetch('/api/partners', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const json = await res.json()
  if (!res.ok) return { data: null, error: json.error }
  return { data: json.data, error: null }
}

export async function updatePartner(
  id: string,
  input: Partial<Omit<PartnerRow, 'id' | 'company_id' | 'auth_user_id' | 'created_at' | 'updated_at'>>
): Promise<{ data: PartnerRow | null; error: string | null }> {
  const res = await fetch(`/api/partners/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const json = await res.json()
  if (!res.ok) return { data: null, error: json.error }
  return { data: json.data, error: null }
}

export async function changePartnerPassword(
  id: string,
  password: string
): Promise<{ error: string | null }> {
  const res = await fetch(`/api/partners/${id}/password`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  const json = await res.json()
  return { error: res.ok ? null : json.error }
}

export async function deletePartner(id: string): Promise<{ error: string | null }> {
  const res = await fetch(`/api/partners/${id}`, { method: 'DELETE', credentials: 'include' })
  const json = await res.json()
  return { error: res.ok ? null : json.error }
}
