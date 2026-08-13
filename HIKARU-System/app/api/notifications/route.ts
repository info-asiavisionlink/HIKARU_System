import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Worker向け通知のみ表示する。ADMIN_ONLYタイプ(attendance_correction_submitted等)は除外。
// employee+admin兼任ユーザーが管理者向け通知をWorker画面で見てしまう問題を防ぐ。
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

// GET /api/notifications
// ログインWorker本人の通知のみ返す。company_id + recipient_profile_id で二重確認。
// WORKER_NOTIFICATION_TYPES と target_app の二重防御でADMIN通知を除外する:
//   - type IN WORKER_NOTIFICATION_TYPES: typeによる第1防御
//   - target_app='worker' OR target_app IS NULL: appによる第2防御 (NULL=legacy互換)
export async function GET(req: NextRequest) {
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // profiles から company_id を取得（クライアント送信値は使わない）
  const { data: profile } = await admin
    .from('profiles')
    .select('company_id')
    .eq('id', uid)
    .single()

  if (!profile?.company_id) {
    return NextResponse.json({ error: '会社情報が取得できません' }, { status: 403 })
  }

  const { data: notifications, error } = await admin
    .from('notifications')
    .select('id, title, body, type, is_read, target_url, created_at')
    .eq('recipient_profile_id', uid)
    .eq('company_id', profile.company_id)
    .in('type', WORKER_NOTIFICATION_TYPES)
    .or('target_app.eq.worker,target_app.is.null')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    // recipient_profile_id カラムが未作成の場合は空を返す（移行期の安全対応）
    if (error.code === '42703') {
      return NextResponse.json({ notifications: [], unread_count: 0 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const unread_count = (notifications ?? []).filter(n => !n.is_read).length

  return NextResponse.json({ notifications: notifications ?? [], unread_count })
}
