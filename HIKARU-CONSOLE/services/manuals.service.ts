import { createClient } from '@/lib/supabase/client'

export type ManualType = 'pdf' | 'image' | 'video' | 'text' | 'faq' | 'note'

export interface ManualRow {
  id: string
  project_id: string
  type: ManualType
  title: string
  content: string | null
  file_url: string | null
  order_num: number
  created_at: string
  updated_at: string
}

export interface ManualInsert {
  project_id: string
  type: ManualType
  title: string
  content?: string | null
  file_url?: string | null
  order_num?: number
}

export const manualTypeLabel: Record<ManualType, string> = {
  pdf:   'PDF',
  image: '画像',
  video: '動画',
  text:  '文章',
  faq:   'FAQ',
  note:  '注意事項',
}

export async function listManuals(projectId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('manuals')
    .select('*')
    .eq('project_id', projectId)
    .order('order_num', { ascending: true })
  return { data: data as ManualRow[] | null, error }
}

export async function listAllManuals(opts?: { search?: string; type?: ManualType | '' }) {
  const supabase = createClient()
  let query = supabase
    .from('manuals')
    .select('*, projects(id, name)')
    .order('created_at', { ascending: false })

  if (opts?.search) {
    query = query.or(`title.ilike.%${opts.search}%,content.ilike.%${opts.search}%`)
  }
  if (opts?.type) {
    query = query.eq('type', opts.type)
  }

  const { data, error } = await query
  return { data, error }
}

export async function createManual(input: ManualInsert) {
  const supabase = createClient()
  const { data: existing } = await supabase
    .from('manuals')
    .select('order_num')
    .eq('project_id', input.project_id)
    .order('order_num', { ascending: false })
    .limit(1)
    .single()

  const nextOrder = input.order_num ?? ((existing?.order_num ?? -1) + 1)

  const { data, error } = await supabase
    .from('manuals')
    .insert({ ...input, order_num: nextOrder })
    .select()
    .single()
  return { data, error }
}

export async function updateManual(id: string, input: Partial<Omit<ManualInsert, 'project_id'>>) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('manuals')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

export async function deleteManual(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('manuals').delete().eq('id', id)
  return { error }
}
