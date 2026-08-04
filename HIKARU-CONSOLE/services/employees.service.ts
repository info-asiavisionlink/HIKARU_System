export type EmployeeStatus = 'active' | 'on_leave' | 'resigned' | 'suspended' | 'deleted'

export interface EmployeeRow {
  id: string
  employee_number: string | null
  company_id: string
  name: string
  name_kana: string | null
  birth_date: string | null
  gender: 'male' | 'female' | 'other' | null
  phone: string | null
  email: string | null
  address: string | null
  emergency_contact: string | null
  hire_date: string | null
  department: string | null
  position: string | null
  qualifications: string[]
  notes: string | null
  status: EmployeeStatus
  auth_user_id: string | null
  created_at: string
  updated_at: string
}

export interface EmployeeDetail extends EmployeeRow {
  loginEmail: string | null
  assignments: {
    project_id: string
    assigned_at: string
    projects: { id: string; name: string; code: string | null; status: string } | null
  }[]
}

export const employeeStatusLabel: Record<EmployeeStatus, string> = {
  active:   '在籍中',
  on_leave: '休職中',
  resigned: '退職',
  suspended: '利用停止',
  deleted:  '削除済み',
}

export const employeeStatusOptions: { value: EmployeeStatus; label: string }[] = [
  { value: 'active',   label: '在籍中' },
  { value: 'on_leave', label: '休職中' },
  { value: 'resigned', label: '退職' },
  { value: 'suspended', label: '利用停止' },
]

export async function listEmployees(opts?: {
  search?: string
  status?: EmployeeStatus | ''
  page?: number
  pageSize?: number
}): Promise<{ data: EmployeeRow[]; count: number }> {
  const params = new URLSearchParams()
  if (opts?.search)   params.set('search', opts.search)
  if (opts?.status)   params.set('status', opts.status)
  if (opts?.page)     params.set('page', String(opts.page))
  if (opts?.pageSize) params.set('pageSize', String(opts.pageSize))

  const res = await fetch(`/api/employees?${params}`, { credentials: 'include', cache: 'no-store' })
  if (!res.ok) return { data: [], count: 0 }
  return res.json()
}

export async function getEmployee(id: string): Promise<EmployeeDetail | null> {
  const res = await fetch(`/api/employees/${id}`, { credentials: 'include', cache: 'no-store' })
  if (!res.ok) return null
  const { data } = await res.json()
  return data
}

export async function createEmployee(input: {
  name: string
  name_kana?: string | null
  birth_date?: string | null
  gender?: 'male' | 'female' | 'other' | null
  phone?: string | null
  email?: string | null
  address?: string | null
  emergency_contact?: string | null
  hire_date?: string | null
  department?: string | null
  position?: string | null
  qualifications?: string[]
  notes?: string | null
  loginEmail?: string
  loginPassword?: string
  role?: 'admin' | 'worker'
}): Promise<{ data: EmployeeRow | null; error: string | null }> {
  const res = await fetch('/api/employees', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const json = await res.json()
  if (!res.ok) return { data: null, error: json.error }
  return { data: json.data, error: null }
}

export async function updateEmployee(
  id: string,
  input: Partial<Omit<EmployeeRow, 'id' | 'company_id' | 'employee_number' | 'auth_user_id' | 'created_at' | 'updated_at'>>
): Promise<{ data: EmployeeRow | null; error: string | null }> {
  const res = await fetch(`/api/employees/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const json = await res.json()
  if (!res.ok) return { data: null, error: json.error }
  return { data: json.data, error: null }
}

export async function changeEmployeePassword(
  id: string,
  password: string
): Promise<{ error: string | null }> {
  const res = await fetch(`/api/employees/${id}/password`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  const json = await res.json()
  return { error: res.ok ? null : json.error }
}

export async function deleteEmployee(id: string): Promise<{ error: string | null }> {
  const res = await fetch(`/api/employees/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  const json = await res.json()
  return { error: res.ok ? null : json.error }
}
