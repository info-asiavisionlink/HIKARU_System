import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

export async function GET() {
  const auth = await getAuthContext()
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const client = auth.adminClient  // service_role で RLS をバイパス
  const cid    = auth.companyId

  const now = new Date()
  const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const thisYearStart  = `${now.getFullYear()}-01-01`

  const [projectsRes, clientsRes, employeesRes, partnersRes, revenueRes] = await Promise.all([
    client.from('projects').select('status, project_type').eq('company_id', cid),
    client.from('clients').select('is_active').eq('company_id', cid),
    client.from('employees').select('status').eq('company_id', cid).neq('status', 'deleted'),
    client.from('partners').select('status').eq('company_id', cid).neq('status', 'deleted'),
    client.from('v_project_revenue').select('*').eq('company_id', cid),
  ])

  const projects = { total: 0, active: 0, paused: 0, completed: 0, cancelled: 0, spot: 0, recurring: 0, hotel: 0 }
  projectsRes.data?.forEach((p) => {
    projects.total++
    if (p.status in projects) projects[p.status as keyof typeof projects]++
    if (p.project_type in projects) projects[p.project_type as keyof typeof projects]++
  })

  const clients = { total: 0, active: 0 }
  clientsRes.data?.forEach((c) => { clients.total++; if (c.is_active) clients.active++ })

  const employees = { total: 0, active: 0, on_leave: 0, resigned: 0, suspended: 0 }
  employeesRes.data?.forEach((e) => {
    employees.total++
    if (e.status in employees) employees[e.status as keyof typeof employees]++
  })

  const partners = { total: 0, active: 0, suspended: 0, terminated: 0 }
  partnersRes.data?.forEach((p) => {
    partners.total++
    if (p.status in partners) partners[p.status as keyof typeof partners]++
  })

  // 売上集計
  const revenue = {
    this_month:       0,  // 今月売上（請求済/入金済）
    this_year:        0,  // 年間売上
    unbilled:         0,  // 未請求合計
    unpaid:           0,  // 未入金合計（請求済+入金待ち）
    by_type: { spot: 0, recurring: 0, hotel: 0 },
  }

  revenueRes.data?.forEach((r: any) => {
    const inc = Number(r.total_inc_tax ?? 0)
    const bs  = r.billing_status

    // 年間売上（contract_dateが今年 or billing_dateが今年）
    const dateStr = r.billing_date ?? r.contract_date ?? ''
    if (dateStr >= thisYearStart) revenue.this_year += inc

    // 今月売上
    if (dateStr >= thisMonthStart) revenue.this_month += inc

    // 未請求
    if (bs === 'unbilled') revenue.unbilled += inc
    // 未入金（請求済 or 入金待ち）
    if (bs === 'billed' || bs === 'awaiting_payment') revenue.unpaid += inc

    // 種別別
    const pt = r.project_type as 'spot' | 'recurring' | 'hotel'
    if (pt in revenue.by_type) revenue.by_type[pt] += inc
  })

  return NextResponse.json({ projects, clients, stores: { total: 0, active: 0 }, employees, partners, revenue })
}
