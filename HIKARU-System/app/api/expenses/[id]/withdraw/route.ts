import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/expenses/[id]/withdraw - submitted → withdrawn（承認前のみ取り下げ可）
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const uid = _req.cookies.get('hk_s_uid')?.value
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('expenses').select('status, worker_id').eq('id', id).single()

  if (!existing) return NextResponse.json({ error: '経費が見つかりません' }, { status: 404 })
  if (existing.worker_id !== uid) return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  if (existing.status !== 'submitted') {
    return NextResponse.json({ error: '申請中の経費のみ取り下げできます' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('expenses')
    .update({ status: 'withdrawn', withdrawn_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ expense: data })
}
