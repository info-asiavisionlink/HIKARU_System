import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const mode  = req.nextUrl.searchParams.get('mode') ?? 'today'
  const year  = req.nextUrl.searchParams.get('year')
  const month = req.nextUrl.searchParams.get('month')

  if (mode === 'monthly' && year && month) {
    const from = `${year}-${month.padStart(2, '0')}-01`
    const lastDay = new Date(Number(year), Number(month), 0).getDate()
    const to = `${year}-${month.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const { data, error } = await sb
      .from('attendance_records')
      .select('*')
      .eq('worker_id', user.id)
      .gte('work_date', from)
      .lte('work_date', to)
      .order('work_date', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const records = (data ?? []) as any[]
    const totalWorkMins = records.reduce((s, r) => s + (r.work_minutes ?? 0), 0)
    const totalPay      = records.reduce((s, r) => s + (r.daily_pay ?? 0), 0)
    const workDays      = records.filter(r => r.clock_out).length

    return NextResponse.json({ data: records, totalWorkMins, totalPay, workDays })
  }

  // today
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await sb
    .from('attendance_records')
    .select('*')
    .eq('worker_id', user.id)
    .eq('work_date', today)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? null })
}
