import { createClient } from '@/lib/supabase/client'

export interface StoreRow {
  id: string
  client_id: string
  company_id: string
  name: string
  code: string | null
  address: string | null
  phone: string | null
  business_hours: string | null
  manager_name: string | null
  emergency_contact: string | null
  contract_info: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface StoreInsert {
  client_id: string
  name: string
  code?: string | null
  address?: string | null
  phone?: string | null
  business_hours?: string | null
  manager_name?: string | null
  emergency_contact?: string | null
  contract_info?: string | null
  notes?: string | null
}

async function getCompanyId(): Promise<string | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
  return data?.company_id ?? null
}

export async function listStores(opts?: {
  search?: string
  clientId?: string
  page?: number
  pageSize?: number
  activeOnly?: boolean
}) {
  const supabase = createClient()
  const page = opts?.page ?? 1
  const pageSize = opts?.pageSize ?? 20

  let query = supabase
    .from('stores')
    .select('*, clients(id, name)', { count: 'exact' })
    .order('name', { ascending: true })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (opts?.search) {
    query = query.or(`name.ilike.%${opts.search}%,code.ilike.%${opts.search}%,address.ilike.%${opts.search}%`)
  }
  if (opts?.clientId) {
    query = query.eq('client_id', opts.clientId)
  }
  if (opts?.activeOnly) {
    query = query.eq('is_active', true)
  }

  const { data, count, error } = await query
  return { data, count: count ?? 0, error }
}

export async function getStore(id: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('stores')
    .select('*, clients(id, name, code)')
    .eq('id', id)
    .single()
  return { data, error }
}

export async function createStore(input: StoreInsert) {
  const supabase = createClient()
  const companyId = await getCompanyId()
  if (!companyId) return { data: null, error: new Error('会社情報が取得できません') }

  const { data, error } = await supabase
    .from('stores')
    .insert({ company_id: companyId, ...input })
    .select()
    .single()
  return { data, error }
}

export async function updateStore(id: string, input: Partial<Omit<StoreInsert, 'client_id'>> & { is_active?: boolean }) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('stores')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

export async function deleteStore(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('stores').delete().eq('id', id)
  return { error }
}
