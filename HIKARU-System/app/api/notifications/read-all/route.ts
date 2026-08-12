import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// PATCH /api/notifications/read-all
// 本人の全未読通知を一括既読化。クライアントからIDを受け取らずサーバー側で条件を固定。
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

  // サーバー側で本人条件を固定 — クライアントからIDは受け取らない
  const { error } = await admin
    .from('notifications')
    .update({ is_read: true })
    .eq('recipient_profile_id', uid)
    .eq('company_id', profile.company_id)
    .eq('is_read', false)

  if (error) {
    if (error.code === '42703') {
      return NextResponse.json({ ok: true, updated: 0 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
