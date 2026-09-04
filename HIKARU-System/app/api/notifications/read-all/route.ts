import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Worker向け通知と同じ境界（取得APIと一致させる）。
// target_app='console' の管理者通知を全既読対象から除外する。
const WORKER_NOTIFICATION_TYPES = [
  'attendance_correction_approved',
  'attendance_correction_rejected',
  'expense_approved',
  'expense_rejected',
  'expense_settled',
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

// PATCH /api/notifications/read-all
// 本人の全未読 Worker 通知だけを一括既読化。
// type と target_app による Worker 境界を適用し、CONSOLE向け通知を巻き込まない。
export async function PATCH(req: NextRequest) {
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

  // Worker通知境界を適用 — 取得APIと同じ条件にすることで
  // target_app='console' の管理者通知を既読化しない
  const { error } = await admin
    .from('notifications')
    .update({ is_read: true })
    .eq('recipient_profile_id', uid)
    .eq('company_id', profile.company_id)
    .in('type', WORKER_NOTIFICATION_TYPES)
    .or('target_app.eq.worker,target_app.is.null')
    .eq('is_read', false)

  if (error) {
    if (error.code === '42703') {
      return NextResponse.json({ ok: true, updated: 0 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
