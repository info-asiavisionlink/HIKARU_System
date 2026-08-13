import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const CATEGORY_LABELS: Record<string, string> = {
  transport: '交通費', parking: '駐車場代', supplies: '備品',
  consumables: '消耗品', other: 'その他',
}

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

  // 管理者へSystem通知（fire-and-forget・失敗しても申請を取り消さない）
  void notifyAdminsOfExpenseSubmitted(id, uid)

  return NextResponse.json({ expense: data })
}

// ---------------------------------------------------------------
// helper: 同一 company の管理者全員へ経費申請通知（fire-and-forget）
// ---------------------------------------------------------------
async function notifyAdminsOfExpenseSubmitted(expenseId: string, workerId: string) {
  try {
    const admin = createAdminClient()

    // 提出済み経費レコードをサーバー側で再取得（クライアント値を信用しない）
    const { data: expense } = await admin
      .from('expenses')
      .select('company_id, category, amount, description')
      .eq('id', expenseId)
      .single()

    if (!expense?.company_id) return

    // Worker 名をサーバー側で取得
    const { data: workerProfile } = await admin
      .from('profiles')
      .select('name')
      .eq('id', workerId)
      .single()
    const workerName = (workerProfile?.name as string | null) ?? 'Worker'

    // 通知本文を生成
    const categoryLabel = CATEGORY_LABELS[expense.category as string] ?? expense.category ?? 'その他'
    const amount        = (expense.amount as number | null) ?? 0
    const description   = (expense.description as string | null) ?? ''
    const body          = [
      `${workerName}さんから経費申請が届きました。`,
      `金額: ¥${amount.toLocaleString('ja-JP')}`,
      `内容: ${categoryLabel}${description ? ` / ${description}` : ''}`,
    ].join('\n')

    // 同一会社の管理者 profiles.id 一覧
    const { data: admins } = await admin
      .from('profiles')
      .select('id')
      .eq('company_id', expense.company_id)
      .eq('role', 'admin')

    if (!admins || admins.length === 0) return

    // 管理者全員へ 1 件ずつ通知を挿入
    const rows = admins.map((a: { id: string }) => ({
      company_id:           expense.company_id,
      recipient_profile_id: a.id,
      title:                '新しい経費申請があります',
      body,
      type:                 'expense_submitted',
      target_app:           'console',
      is_read:              false,
      target_url:           `/expenses/${expenseId}`,
    }))

    const { error } = await admin.from('notifications').insert(rows)
    if (error) console.error('[Admin通知] 経費申請通知挿入失敗:', error.message)
  } catch (e) {
    console.error('[Admin通知] 経費申請 予期しないエラー:', e)
  }
}
