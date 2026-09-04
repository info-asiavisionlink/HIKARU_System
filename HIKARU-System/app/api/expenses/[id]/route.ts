import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/expenses/[id]
// Defense-in-depth: RLS 頼みにせず、uid + worker_id + company_id を明示検証
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = await createClient()

  // 呼び出し元 worker の company_id を取得 (cross-tenant leak 防御)
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', uid)
    .single()
  if (!profile?.company_id) {
    return NextResponse.json({ error: '会社情報が取得できません' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('expenses')
    .select(`
      *,
      projects:project_id (id, name, location_name, address),
      shifts:shift_id (id, shift_date, start_time, end_time, status),
      jobs:job_id (id, work_date, started_at, completed_at, status),
      expense_receipts (id, file_name, mime_type, storage_path, file_size, created_at)
    `)
    .eq('id', id)
    .eq('worker_id', uid)
    .eq('company_id', profile.company_id)
    .single()

  if (error || !data) return NextResponse.json({ error: '経費が見つかりません' }, { status: 404 })
  return NextResponse.json({ expense: data })
}

// PUT /api/expenses/[id] - draft のみ編集可
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = await createClient()

  // draft チェック（RLS でも保護されているが二重確認）
  const { data: existing } = await supabase.from('expenses').select('status, worker_id').eq('id', id).single()
  if (!existing) return NextResponse.json({ error: '経費が見つかりません' }, { status: 404 })
  if (existing.worker_id !== uid) return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  if (existing.status !== 'draft') return NextResponse.json({ error: '申請済みの経費は編集できません' }, { status: 400 })

  const body = await req.json()
  const allowed = ['expense_date','category','amount','description','note','project_id','shift_id','job_id']
  const update: Record<string, unknown> = {}
  for (const k of allowed) if (k in body) update[k] = body[k]
  if (update.expense_date) update.claim_month = (update.expense_date as string).slice(0, 7) + '-01'

  const { data, error } = await supabase.from('expenses').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ expense: data })
}

// DELETE /api/expenses/[id] - draft のみ削除可
// Defense-in-depth: RLS 頼みにせず、uid + worker_id + company_id + status='draft' を明示検証
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', uid)
    .single()
  if (!profile?.company_id) {
    return NextResponse.json({ error: '会社情報が取得できません' }, { status: 403 })
  }

  // 削除前に対象 row の存在 + ownership + company + draft status を明示確認
  const { data: existing } = await supabase
    .from('expenses')
    .select('status, worker_id, company_id')
    .eq('id', id)
    .single()
  if (!existing) return NextResponse.json({ error: '経費が見つかりません' }, { status: 404 })
  if (existing.worker_id !== uid || existing.company_id !== profile.company_id) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }
  if (existing.status !== 'draft') {
    return NextResponse.json({ error: 'draft の経費のみ削除できます' }, { status: 400 })
  }

  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id)
    .eq('worker_id', uid)
    .eq('company_id', profile.company_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
