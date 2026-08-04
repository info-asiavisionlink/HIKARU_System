import { createClient } from '@/lib/supabase/client'

export interface PhotoSpotRow {
  id: string
  project_id: string
  store_id: string | null  // 後方互換性のため残す
  name: string
  description: string | null
  order_num: number
  is_required: boolean
  ref_image_url: string | null
  created_at: string
  updated_at: string
}

export interface PhotoSpotInsert {
  name: string
  description?: string | null
  order_num?: number
  is_required?: boolean
  ref_image_url?: string | null
}

export async function listPhotoSpots(projectId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('photo_spots')
    .select('*')
    .eq('project_id', projectId)
    .order('order_num', { ascending: true })
  return { data: data as PhotoSpotRow[] | null, error }
}

export async function createPhotoSpot(projectId: string, input: PhotoSpotInsert) {
  const supabase = createClient()
  const { data: existing } = await supabase
    .from('photo_spots')
    .select('order_num')
    .eq('project_id', projectId)
    .order('order_num', { ascending: false })
    .limit(1)
    .single()

  const nextOrder = input.order_num ?? ((existing?.order_num ?? -1) + 1)

  const { data, error } = await supabase
    .from('photo_spots')
    .insert({ project_id: projectId, ...input, order_num: nextOrder })
    .select()
    .single()
  return { data, error }
}

export async function updatePhotoSpot(id: string, input: Partial<PhotoSpotInsert>) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('photo_spots')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

export async function deletePhotoSpot(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('photo_spots').delete().eq('id', id)
  return { error }
}

export async function reorderPhotoSpots(projectId: string, orderedIds: string[]) {
  const supabase = createClient()
  const updates = orderedIds.map((id, idx) =>
    supabase.from('photo_spots').update({ order_num: idx }).eq('id', id).eq('project_id', projectId)
  )
  const results = await Promise.all(updates)
  const firstError = results.find((r) => r.error)?.error
  return { error: firstError ?? null }
}
