import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getJSTDateString } from '@/lib/date'

type PunchType = 'clock_in' | 'break_start' | 'break_end' | 'clock_out'

function calcMinutes(a: string | null, b: string | null): number {
  if (!a || !b) return 0
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)
}

export async function POST(req: NextRequest) {
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { type }: { type: PunchType } = await req.json()
  const now   = new Date().toISOString()
  const today = getJSTDateString()  // JST日付（UTC splitではなくAsia/Tokyo基準）

  const admin = createAdminClient()

  // プロフィールから時給・company_idをサーバー側で取得
  const { data: profile } = await admin
    .from('profiles')
    .select('hourly_rate, company_id')
    .eq('id', uid)
    .single()

  const hourlyRate = (profile as any)?.hourly_rate ?? 0
  const companyId  = (profile as any)?.company_id

  // 今日の記録を取得（worker_id + work_dateで本人確認）
  const { data: existing } = await admin
    .from('attendance_records')
    .select('*')
    .eq('worker_id', uid)
    .eq('work_date', today)
    .single()

  const patch: Record<string, unknown> = {
    updated_at: now,
  }

  if (type === 'clock_in') {
    if ((existing as any)?.clock_in) return NextResponse.json({ error: 'already_clocked_in' }, { status: 400 })
    patch.clock_in = now
  } else if (type === 'break_start') {
    if (!(existing as any)?.clock_in) return NextResponse.json({ error: 'not_clocked_in' }, { status: 400 })
    patch.break_start = now
  } else if (type === 'break_end') {
    if (!(existing as any)?.break_start) return NextResponse.json({ error: 'no_break_started' }, { status: 400 })
    patch.break_end = now
    patch.break_minutes = calcMinutes((existing as any).break_start, now)
  } else if (type === 'clock_out') {
    if (!(existing as any)?.clock_in) return NextResponse.json({ error: 'not_clocked_in' }, { status: 400 })
    patch.clock_out = now

    const totalMins = calcMinutes((existing as any).clock_in, now)
    const breakMins = (existing as any).break_end
      ? calcMinutes((existing as any).break_start, (existing as any).break_end)
      : ((existing as any).break_start ? calcMinutes((existing as any).break_start, now) : 0)
    const workMins  = Math.max(0, totalMins - breakMins)
    const dailyPay  = Math.round((workMins / 60) * hourlyRate)

    patch.break_minutes = breakMins
    patch.work_minutes  = workMins
    patch.hourly_rate   = hourlyRate
    patch.daily_pay     = dailyPay
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let error: any

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any

  if (!existing) {
    // 新規作成（clock_inのみ）
    const res = await db
      .from('attendance_records')
      .insert({
        worker_id:   uid,
        company_id:  companyId,
        work_date:   today,
        hourly_rate: hourlyRate,
        ...patch,
      })
      .select()
      .single()
    data  = res.data
    error = res.error
  } else {
    // 更新: adminClientのRLSバイパスを補うため worker_id も条件に追加
    const res = await db
      .from('attendance_records')
      .update(patch)
      .eq('id', (existing as any).id)
      .eq('worker_id', uid)
      .select()
      .single()
    data  = res.data
    error = res.error
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
