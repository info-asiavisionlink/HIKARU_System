import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

type PunchType = 'clock_in' | 'break_start' | 'break_end' | 'clock_out'

function calcMinutes(a: string | null, b: string | null): number {
  if (!a || !b) return 0
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { type }: { type: PunchType } = await req.json()
  const now   = new Date().toISOString()
  const today = now.split('T')[0]

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  ) as any

  // プロフィールから時給・company_idを取得
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('hourly_rate, company_id')
    .eq('id', user.id)
    .single()

  const hourlyRate  = profile?.hourly_rate ?? 0
  const companyId   = profile?.company_id

  // 今日の記録を取得or作成
  const { data: existing } = await (supabase as any)
    .from('attendance_records')
    .select('*')
    .eq('worker_id', user.id)
    .eq('work_date', today)
    .single()

  const patch: Record<string, unknown> = {
    updated_at: now,
  }

  if (type === 'clock_in') {
    if (existing?.clock_in) return NextResponse.json({ error: 'already_clocked_in' }, { status: 400 })
    patch.clock_in = now
  } else if (type === 'break_start') {
    if (!existing?.clock_in) return NextResponse.json({ error: 'not_clocked_in' }, { status: 400 })
    patch.break_start = now
  } else if (type === 'break_end') {
    if (!existing?.break_start) return NextResponse.json({ error: 'no_break_started' }, { status: 400 })
    patch.break_end = now
    patch.break_minutes = calcMinutes(existing.break_start, now)
  } else if (type === 'clock_out') {
    if (!existing?.clock_in) return NextResponse.json({ error: 'not_clocked_in' }, { status: 400 })
    patch.clock_out = now

    // 実働時間を計算
    const totalMins  = calcMinutes(existing.clock_in, now)
    const breakMins  = existing.break_end
      ? calcMinutes(existing.break_start, existing.break_end)
      : (existing.break_start ? calcMinutes(existing.break_start, now) : 0)
    const workMins   = Math.max(0, totalMins - breakMins)
    const dailyPay   = Math.round((workMins / 60) * hourlyRate)

    patch.break_minutes = breakMins
    patch.work_minutes  = workMins
    patch.hourly_rate   = hourlyRate
    patch.daily_pay     = dailyPay
  }

  let data: any
  let error: any

  if (!existing) {
    // 新規作成（clock_inのみ）
    const res = await admin.from('attendance_records').insert({
      worker_id:  user.id,
      company_id: companyId,
      work_date:  today,
      hourly_rate: hourlyRate,
      ...patch,
    }).select().single()
    data  = res.data
    error = res.error
  } else {
    const res = await (supabase as any)
      .from('attendance_records')
      .update(patch)
      .eq('id', existing.id)
      .select()
      .single()
    data  = res.data
    error = res.error
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
