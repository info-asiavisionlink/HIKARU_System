import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/expenses/[id]/submit - draft → submitted
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const uid = _req.cookies.get('hk_s_uid')?.value
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('expenses').select('status, worker_id, amount').eq('id', id).single()

  if (!existing) return NextResponse.json({ error: '経費が見つかりません' }, { status: 404 })
  if (existing.worker_id !== uid) return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  if (existing.status !== 'draft') return NextResponse.json({ error: 'draft 状態の経費のみ申請できます' }, { status: 400 })
  if (!existing.amount || existing.amount <= 0) return NextResponse.json({ error: '金額が設定されていません' }, { status: 400 })

  const { data, error } = await supabase
    .from('expenses')
    .update({ status: 'submitted', submitted_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // 将来: LINE通知 expense_submitted イベントをここでキック
  return NextResponse.json({ expense: data })
}
