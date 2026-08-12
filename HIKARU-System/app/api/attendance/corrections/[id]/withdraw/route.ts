import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// PATCH /api/attendance/corrections/[id]/withdraw
// submitted → withdrawn（本人・申請中のみ）
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: existing, error: fetchErr } = await admin
    .from('attendance_correction_requests')
    .select('id, worker_id, status')
    .eq('id', id)
    .single()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: '申請が見つかりません' }, { status: 404 })
  }
  if (existing.worker_id !== uid) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }
  if (existing.status !== 'submitted') {
    return NextResponse.json({ error: '申請中の修正申請のみ取り下げできます' }, { status: 400 })
  }

  // status: 'withdrawn' のみ更新（他フィールドは変更しない）
  const { data, error } = await admin
    .from('attendance_correction_requests')
    .update({ status: 'withdrawn' })
    .eq('id', id)
    .eq('worker_id', uid)
    .select('id, status, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ correction: data })
}
