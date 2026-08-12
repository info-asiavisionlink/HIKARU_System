import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

type PunchType = 'clock_in' | 'break_start' | 'break_end' | 'clock_out'

function calcMinutes(a: string | null, b: string | null): number {
  if (!a || !b) return 0
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)
}

export async function POST(req: NextRequest) {
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { type }: { type: PunchType } = await req.json()
  if (!['clock_in', 'break_start', 'break_end', 'clock_out'].includes(type)) {
    return NextResponse.json({ error: '無効な打刻タイプです' }, { status: 400 })
  }

  // サーバー時刻を使用（クライアント時刻は使用しない）
  const now   = new Date().toISOString()
  const today = now.split('T')[0]

  const admin = createAdminClient()

  // プロフィール取得（company_id・時給 をサーバー側で決定）
  const { data: profileData } = await admin
    .from('profiles')
    .select('hourly_rate, company_id')
    .eq('id', uid)
    .single()

  const profile = profileData as { hourly_rate: number | null; company_id: string | null } | null
  if (!profile?.company_id) {
    return NextResponse.json({ error: 'プロフィール情報が見つかりません' }, { status: 400 })
  }

  const hourlyRate = profile.hourly_rate ?? 0
  const companyId  = profile.company_id

  // 本日の勤怠レコードを取得（worker_id で所有権確認）
  const { data: existing } = await admin
    .from('attendance_records')
    .select('*')
    .eq('worker_id', uid)
    .eq('company_id', companyId)
    .eq('work_date', today)
    .maybeSingle()

  const record = existing as Record<string, unknown> | null

  // 二重打刻防止
  if (type === 'clock_in') {
    if (record?.clock_in) return NextResponse.json({ error: 'already_clocked_in' }, { status: 400 })
  } else if (type === 'break_start') {
    if (!record?.clock_in)    return NextResponse.json({ error: 'not_clocked_in' }, { status: 400 })
    if (record?.break_start)  return NextResponse.json({ error: 'already_on_break' }, { status: 400 })
    if (record?.clock_out)    return NextResponse.json({ error: 'already_clocked_out' }, { status: 400 })
  } else if (type === 'break_end') {
    if (!record?.break_start) return NextResponse.json({ error: 'no_break_started' }, { status: 400 })
    if (record?.break_end)    return NextResponse.json({ error: 'break_already_ended' }, { status: 400 })
  } else if (type === 'clock_out') {
    if (!record?.clock_in)    return NextResponse.json({ error: 'not_clocked_in' }, { status: 400 })
    if (record?.clock_out)    return NextResponse.json({ error: 'already_clocked_out' }, { status: 400 })
    if (record?.break_start && !record?.break_end) {
      return NextResponse.json({ error: 'break_not_ended' }, { status: 400 })
    }
  }

  const patch: Record<string, unknown> = { updated_at: now }

  if (type === 'clock_in') {
    patch.clock_in = now
  } else if (type === 'break_start') {
    patch.break_start = now
  } else if (type === 'break_end') {
    patch.break_end     = now
    patch.break_minutes = calcMinutes(record!.break_start as string, now)
  } else if (type === 'clock_out') {
    patch.clock_out = now

    const clockInStr  = record!.clock_in as string
    const totalMins   = calcMinutes(clockInStr, now)
    const breakMins   = record?.break_end
      ? calcMinutes(record.break_start as string, record.break_end as string)
      : (record?.break_start ? calcMinutes(record.break_start as string, now) : 0)
    const workMins    = Math.max(0, totalMins - breakMins)
    const dailyPay    = Math.round((workMins / 60) * hourlyRate)

    patch.break_minutes = breakMins
    patch.work_minutes  = workMins
    patch.hourly_rate   = hourlyRate
    patch.daily_pay     = dailyPay
  }

  let data: unknown
  let error: unknown

  if (!record) {
    // 新規作成（clock_in のみ許可）
    if (type !== 'clock_in') {
      return NextResponse.json({ error: 'not_clocked_in' }, { status: 400 })
    }
    const res = await admin
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
    // 既存レコード更新（admin で RLS をバイパス、owner 確認はアプリ層で完了済み）
    const res = await admin
      .from('attendance_records')
      .update(patch)
      .eq('id', (record as any).id)
      .eq('worker_id', uid)
      .eq('company_id', companyId)
      .select()
      .single()
    data  = res.data
    error = res.error
  }

  if (error) return NextResponse.json({ error: (error as any).message }, { status: 500 })
  return NextResponse.json({ data })
}
