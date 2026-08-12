import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

const CATEGORY_LABELS: Record<string, string> = {
  transport: '交通費', parking: '駐車場代', supplies: '備品',
  consumables: '消耗品', other: 'その他',
}

// GET /api/expenses - 管理者用一覧（自社の全経費）
export async function GET(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const p = req.nextUrl.searchParams
  const status    = p.get('status')
  const workerId  = p.get('worker_id')
  const projectId = p.get('project_id')
  const category  = p.get('category')
  const dateFrom  = p.get('date_from')
  const dateTo    = p.get('date_to')

  let query = auth.adminClient
    .from('expenses')
    .select(`
      *,
      projects:project_id (id, name),
      expense_receipts (id)
    `)
    .eq('company_id', auth.companyId)
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (status)    query = query.eq('status', status)
  if (workerId)  query = query.eq('worker_id', workerId)
  if (projectId) query = query.eq('project_id', projectId)
  if (category)  query = query.eq('category', category)
  if (dateFrom)  query = query.gte('expense_date', dateFrom)
  if (dateTo)    query = query.lte('expense_date', dateTo)

  const { data: expenses, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // profiles は worker_id FK がキャッシュ未登録の可能性があるため別途取得してマージ
  const workerIds = [...new Set((expenses ?? []).map(e => e.worker_id).filter(Boolean))]
  const profilesMap: Record<string, { id: string; name: string; email: string; entity_type: string }> = {}

  if (workerIds.length > 0) {
    const { data: profiles } = await auth.adminClient
      .from('profiles')
      .select('id, name, email, entity_type')
      .in('id', workerIds)
      .eq('company_id', auth.companyId)

    for (const prof of profiles ?? []) {
      profilesMap[prof.id] = prof
    }
  }

  const result = (expenses ?? []).map(e => ({
    ...e,
    profile: profilesMap[e.worker_id] ?? null,
  }))

  // KPI 集計（今月）
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const { data: kpiData } = await auth.adminClient
    .from('expenses')
    .select('status, amount')
    .eq('company_id', auth.companyId)
    .gte('expense_date', monthStart)

  const kpi = {
    submitted: 0, approved: 0, settled: 0, rejected: 0,
    submitted_amount: 0, approved_amount: 0, settled_amount: 0,
  }
  for (const e of kpiData ?? []) {
    if (e.status === 'submitted') { kpi.submitted++; kpi.submitted_amount += e.amount ?? 0 }
    if (e.status === 'approved')  { kpi.approved++;  kpi.approved_amount  += e.amount ?? 0 }
    if (e.status === 'settled')   { kpi.settled++;   kpi.settled_amount   += e.amount ?? 0 }
    if (e.status === 'rejected')  { kpi.rejected++ }
  }

  return NextResponse.json({ expenses: result, kpi, category_labels: CATEGORY_LABELS })
}
