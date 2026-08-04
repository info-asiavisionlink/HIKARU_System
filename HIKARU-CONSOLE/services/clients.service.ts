export interface ClientRow {
  id: string
  company_id: string
  name: string
  code: string | null
  email: string | null
  phone: string | null
  address: string | null
  contact_name: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ClientInsert {
  name: string
  code?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  contact_name?: string | null
  notes?: string | null
}

export async function listClients(opts?: {
  search?: string
  page?: number
  pageSize?: number
  activeOnly?: boolean
}) {
  const params = new URLSearchParams()
  if (opts?.search)    params.set('search',   opts.search)
  if (opts?.page)      params.set('page',     String(opts.page))
  if (opts?.pageSize)  params.set('pageSize', String(opts.pageSize))

  const res = await fetch(`/api/clients?${params}`, {
    credentials: 'include',  // Cookie を必ず送信
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { data: [] as ClientRow[], count: 0, error: new Error(body.error ?? `HTTP ${res.status}`) }
  }

  const body = await res.json()
  return { data: (body.clients ?? []) as ClientRow[], count: body.count ?? 0, error: null }
}

export async function getClient(id: string) {
  const res = await fetch(`/api/clients/${id}`, { credentials: 'include', cache: 'no-store' })
  if (!res.ok) return { data: null, error: new Error(`HTTP ${res.status}`) }
  const body = await res.json()
  return { data: body.client ?? null, error: null }
}

// 以下は既存の Supabase client 直接呼び出しを継続（更新・削除は認証済みのサーバーアクション経由が望ましいが今は簡易版）
import { createClient } from '@/lib/supabase/client'

async function getCompanyId(): Promise<string | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
  return data?.company_id ?? null
}

export async function createClientRecord(input: ClientInsert) {
  const supabase = createClient()
  const companyId = await getCompanyId()
  if (!companyId) return { data: null, error: new Error('会社情報が取得できません') }
  const { data, error } = await supabase
    .from('clients')
    .insert({ company_id: companyId, ...input })
    .select()
    .single()
  return { data, error }
}

export async function updateClient(id: string, input: Partial<ClientInsert> & { is_active?: boolean }) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('clients')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

export async function deleteClient(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('clients').delete().eq('id', id)
  return { error }
}
