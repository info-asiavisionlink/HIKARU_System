import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

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

  // 管理者へSystem通知（fire-and-forget・業務処理に影響させない）
  void notifyAdminsOfExpenseSubmitted(createAdminClient(), id, uid)

  return NextResponse.json({ expense: data })
}

// ---------------------------------------------------------------
// 管理者System通知: 経費申請
// ---------------------------------------------------------------
async function notifyAdminsOfExpenseSubmitted(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin:     any,
  expenseId: string,
  workerId:  string,
): Promise<void> {
  try {
    const { data: workerProfile } = await admin
      .from('profiles').select('name, company_id').eq('id', workerId).single()
    if (!workerProfile?.company_id) return

    const workerName = (workerProfile as { name?: string; company_id: string }).name ?? '作業者'
    const companyId  = (workerProfile as { company_id: string }).company_id

    const { data: admins } = await admin
      .from('profiles').select('id').eq('company_id', companyId).eq('role', 'admin')

    if (!admins?.length) return

    const rows = (admins as { id: string }[]).map((a) => ({
      company_id:           companyId,
      recipient_profile_id: a.id,
      title:                '経費申請が届きました',
      body:                 `${workerName}さんから経費申請が届きました。`,
      type:                 'expense_submitted',
      target_app:           'console',
      is_read:              false,
      target_url:           `/expenses/${expenseId}`,
    }))

    const { error } = await admin.from('notifications').insert(rows)
    if (error) console.error('[Admin通知] 経費申請通知挿入失敗:', error.message)
  } catch (e) {
    console.error('[Admin通知] 経費申請通知 予期しないエラー:', e)
  }
}
