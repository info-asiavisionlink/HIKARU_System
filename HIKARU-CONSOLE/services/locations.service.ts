import { createClient } from '@/lib/supabase/client'

export interface LocationRow {
  id: string
  store_id: string
  name: string
  order_num: number
  is_active: boolean
  created_at: string
}

export async function listLocations(storeId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('store_id', storeId)
    .order('order_num', { ascending: true })
  return { data: data as LocationRow[] | null, error }
}

export async function createLocation(storeId: string, name: string, orderNum?: number) {
  const supabase = createClient()
  const { data: existing } = await supabase
    .from('locations')
    .select('order_num')
    .eq('store_id', storeId)
    .order('order_num', { ascending: false })
    .limit(1)
    .single()

  const nextOrder = orderNum ?? ((existing?.order_num ?? -1) + 1)

  const { data, error } = await supabase
    .from('locations')
    .insert({ store_id: storeId, name, order_num: nextOrder })
    .select()
    .single()
  return { data, error }
}

export async function updateLocation(id: string, input: { name?: string; order_num?: number; is_active?: boolean }) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('locations')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

export async function deleteLocation(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('locations').delete().eq('id', id)
  return { error }
}

export async function reorderLocations(storeId: string, orderedIds: string[]) {
  const supabase = createClient()
  const updates = orderedIds.map((id, idx) =>
    supabase.from('locations').update({ order_num: idx }).eq('id', id).eq('store_id', storeId)
  )
  const results = await Promise.all(updates)
  const firstError = results.find((r) => r.error)?.error
  return { error: firstError ?? null }
}
