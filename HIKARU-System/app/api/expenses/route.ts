import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const CATEGORY_LABELS: Record<string, string> = {
  transport: '交通費', parking: '駐車場代', supplies: '備品',
  consumables: '消耗品', other: 'その他',
}

// GET /api/expenses - 自分の経費一覧
export async function GET(req: NextRequest) {
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const p      = req.nextUrl.searchParams
  const status = p.get('status')
  const month  = p.get('month') // YYYY-MM

  const supabase = await createClient()

  let query = supabase
    .from('expenses')
    .select(`
      *,
      projects:project_id (id, name, location_name),
      shifts:shift_id (id, shift_date, start_time, end_time),
      jobs:job_id (id, work_date),
      expense_receipts (id, file_name, mime_type, storage_path)
    `)
    .eq('worker_id', uid)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (month)  query = query.gte('expense_date', `${month}-01`).lte('expense_date', `${month}-31`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ expenses: data ?? [], category_labels: CATEGORY_LABELS })
}

// POST /api/expenses - 経費登録（draft として保存）
export async function POST(req: NextRequest) {
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = await createClient()

  // profile から company_id + entity を取得
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, entity_type, entity_id')
    .eq('id', uid)
    .single()

  if (!profile?.company_id) return NextResponse.json({ error: '会社情報が取得できません' }, { status: 403 })

  const body = await req.json()
  const { expense_date, category, amount, description, project_id, shift_id, job_id, note } = body

  if (!expense_date) return NextResponse.json({ error: '経費発生日は必須です' }, { status: 400 })
  if (!category)     return NextResponse.json({ error: 'カテゴリーは必須です' }, { status: 400 })
  if (!amount || amount <= 0) return NextResponse.json({ error: '金額を正しく入力してください' }, { status: 400 })

  // claim_month = expense_date の月初日
  const claimMonth = expense_date.slice(0, 7) + '-01'

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      worker_id:     uid,
      company_id:    profile.company_id,
      assignee_type: profile.entity_type ?? 'employee',
      employee_id:   profile.entity_type === 'employee' ? profile.entity_id : null,
      partner_id:    profile.entity_type === 'partner'  ? profile.entity_id : null,
      expense_date,
      category,
      amount,
      description:   description || null,
      note:          note || null,
      project_id:    project_id || null,
      shift_id:      shift_id   || null,
      job_id:        job_id     || null,
      claim_month:   claimMonth,
      status:        'draft',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ expense: data }, { status: 201 })
}
