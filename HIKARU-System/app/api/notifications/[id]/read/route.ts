import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Worker向け通知と同じ境界（取得APIと一致させる）。
const WORKER_NOTIFICATION_TYPES = [
  'attendance_correction_approved',
  'attendance_correction_rejected',
  'expense_approved',
  'expense_rejected',
  'shift_created',
  'shift_updated',
  'shift_cancelled',
  'shift_confirmed',
  'project_assigned',
  'project_unassigned',
  'project_cancelled',
  'project_paused',
  'project_completed',
  'project_details_changed',
]

// PATCH /api/notifications/[id]/read
// 本人の Worker 通知1件のみ既読化。is_read のみ更新（Mass Assignment防止）。
// target_app='console' の通知はWorker境界外として既読化不可（404を返す）。
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // company_id をサーバー側のprofileから取得
  const { data: profile } = await admin
    .from('profiles')
    .select('company_id')
    .eq('id', uid)
    .single()

  if (!profile?.company_id) {
    return NextResponse.json({ error: '会社情報が取得できません' }, { status: 403 })
  }

  // ownership確認: id + recipient_profile_id + company_id + Worker境界の四重チェック
  // target_app='console' 通知はWorkerから既読化不可（404を返す）
  const { data: existing } = await admin
    .from('notifications')
    .select('id, is_read')
    .eq('id', id)
    .eq('recipient_profile_id', uid)
    .eq('company_id', profile.company_id)
    .in('type', WORKER_NOTIFICATION_TYPES)
    .or('target_app.eq.worker,target_app.is.null')
    .single()

  if (!existing) {
    return NextResponse.json({ error: '通知が見つかりません' }, { status: 404 })
  }

  if (existing.is_read) {
    return NextResponse.json({ ok: true, already_read: true })
  }

  // is_read のみ更新（他フィールドはrequest bodyから受け取らない）
  const { error } = await admin
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
    .eq('recipient_profile_id', uid)
    .eq('company_id', profile.company_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
