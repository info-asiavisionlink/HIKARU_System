import { createClient } from '@/lib/supabase/client'

export type UserRole = 'admin' | 'worker' | 'client'

export interface UserRow {
  id: string
  email: string
  name: string
  role: UserRole
  company_id: string | null
  phone: string | null
  avatar_url: string | null
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export const roleLabel: Record<UserRole, string> = {
  admin:  '管理者',
  worker: '作業者',
  client: 'オーナー',
}

export async function listUsers(opts?: {
  search?: string
  role?: UserRole | ''
  page?: number
  pageSize?: number
}) {
  const supabase = createClient()
  const page = opts?.page ?? 1
  const pageSize = opts?.pageSize ?? 20

  let query = supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (opts?.search) {
    query = query.or(`name.ilike.%${opts.search}%,email.ilike.%${opts.search}%`)
  }
  if (opts?.role) {
    query = query.eq('role', opts.role)
  }

  const { data, count, error } = await query
  return { data: data as UserRow[] | null, count: count ?? 0, error }
}

export async function getUser(id: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()
  return { data: data as UserRow | null, error }
}

export async function updateUser(id: string, input: { name?: string; role?: UserRole; phone?: string | null }) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

export async function inviteUser(email: string, name: string, role: UserRole) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: new Error('未認証') }

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { name, role, company_id: profile?.company_id },
  })
  return { data, error }
}

export async function getUserStats() {
  const supabase = createClient()
  const { data } = await supabase.from('profiles').select('role')
  const stats = { admin: 0, worker: 0, client: 0, total: data?.length ?? 0 }
  data?.forEach((u) => {
    if (u.role in stats) stats[u.role as keyof typeof stats]++
  })
  return stats
}
