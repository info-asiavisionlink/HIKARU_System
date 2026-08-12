import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// PATCH /api/notifications/[id]/read
// 本人の通知1件のみ既読化。is_read のみ更新（Mass Assignment防止）。
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

  // ownership確認: id + recipient_profile_id + company_id の三重チェック
  const { data: existing } = await admin
    .from('notifications')
    .select('id, is_read')
    .eq('id', id)
    .eq('recipient_profile_id', uid)
    .eq('company_id', profile.company_id)
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
