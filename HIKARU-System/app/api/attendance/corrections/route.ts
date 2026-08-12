import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------
// GET /api/attendance/corrections
// Worker本人の修正申請一覧（worker_id = ログイン uid）
// ---------------------------------------------------------------
export async function GET(req: NextRequest) {
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('company_id')
    .eq('id', uid)
    .single()

  if (!profile?.company_id) {
    return NextResponse.json({ error: 'プロフィール情報が取得できません' }, { status: 403 })
  }

  const { data, error } = await admin
    .from('attendance_correction_requests')
    .select(`
      id,
      attendance_record_id,
      worker_id,
      original_clock_in,
      original_clock_out,
      original_break_start,
      original_break_end,
      requested_clock_in,
      requested_clock_out,
      requested_break_start,
      requested_break_end,
      reason,
      status,
      review_comment,
      reviewed_at,
      created_at,
      updated_at,
      attendance_records!attendance_record_id (
        id, work_date, clock_in, clock_out, break_start, break_end,
        work_minutes, daily_pay
      )
    `)
    .eq('worker_id', uid)
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ corrections: data ?? [] })
}

// ---------------------------------------------------------------
// POST /api/attendance/corrections
// 修正申請新規作成
// ---------------------------------------------------------------
export async function POST(req: NextRequest) {
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // company_id をサーバー側で取得（クライアントから受け取らない）
  const { data: profile } = await admin
    .from('profiles')
    .select('company_id')
    .eq('id', uid)
    .single()

  if (!profile?.company_id) {
    return NextResponse.json({ error: 'プロフィール情報が取得できません' }, { status: 403 })
  }

  // 許可するフィールドのみ取得（Mass Assignment防止）
  const body = await req.json()
  const {
    attendance_record_id,
    requested_clock_in,
    requested_clock_out,
    requested_break_start,
    requested_break_end,
    reason,
  } = body as {
    attendance_record_id?: string
    requested_clock_in?: string | null
    requested_clock_out?: string | null
    requested_break_start?: string | null
    requested_break_end?: string | null
    reason?: string
  }

  // --- バリデーション ---

  if (!attendance_record_id) {
    return NextResponse.json({ error: '勤怠記録IDは必須です' }, { status: 400 })
  }

  const trimmedReason = (reason ?? '').trim()
  if (!trimmedReason) {
    return NextResponse.json({ error: '申請理由は必須です' }, { status: 400 })
  }
  if (trimmedReason.length > 500) {
    return NextResponse.json({ error: '申請理由は500文字以内で入力してください' }, { status: 400 })
  }

  // 修正内容が少なくとも1つ
  const toNull = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null)
  const req_clock_in    = toNull(requested_clock_in)
  const req_clock_out   = toNull(requested_clock_out)
  const req_break_start = toNull(requested_break_start)
  const req_break_end   = toNull(requested_break_end)

  if (!req_clock_in && !req_clock_out && !req_break_start && !req_break_end) {
    return NextResponse.json({ error: '修正内容を1つ以上入力してください' }, { status: 400 })
  }

  // ISO datetime バリデーション
  function isValidISO(v: string | null): boolean {
    if (!v) return true
    const d = new Date(v)
    return !isNaN(d.getTime())
  }

  const fieldChecks: [string, string | null][] = [
    ['出勤時刻', req_clock_in],
    ['退勤時刻', req_clock_out],
    ['休憩開始', req_break_start],
    ['休憩終了', req_break_end],
  ]
  for (const [label, val] of fieldChecks) {
    if (!isValidISO(val)) {
      return NextResponse.json({ error: `${label} の日時形式が不正です` }, { status: 400 })
    }
  }

  // --- ownership確認（サーバー側でDB取得・クライアント値を信用しない） ---
  const { data: record, error: recErr } = await admin
    .from('attendance_records')
    .select('id, worker_id, company_id, clock_in, clock_out, break_start, break_end')
    .eq('id', attendance_record_id)
    .single()

  if (recErr || !record) {
    return NextResponse.json({ error: '勤怠記録が見つかりません' }, { status: 404 })
  }
  if (record.worker_id !== uid) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }
  if (record.company_id !== profile.company_id) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }

  // --- 二重申請チェック ---
  const { data: dup } = await admin
    .from('attendance_correction_requests')
    .select('id')
    .eq('attendance_record_id', attendance_record_id)
    .eq('status', 'submitted')
    .maybeSingle()

  if (dup) {
    return NextResponse.json(
      { error: 'この勤怠記録には既に申請中の修正申請があります' },
      { status: 409 }
    )
  }

  // --- 時刻整合性チェック（original + requested をマージした予定値で検証） ---
  const toDate = (v: string | null | undefined): Date | null => {
    if (!v) return null
    const d = new Date(v as string)
    return isNaN(d.getTime()) ? null : d
  }

  const eff_ci = toDate(req_clock_in)    ?? toDate(record.clock_in    as string | null)
  const eff_co = toDate(req_clock_out)   ?? toDate(record.clock_out   as string | null)
  const eff_bs = toDate(req_break_start) ?? toDate(record.break_start as string | null)
  const eff_be = toDate(req_break_end)   ?? toDate(record.break_end   as string | null)

  if (eff_ci && eff_co && eff_co <= eff_ci) {
    return NextResponse.json({ error: '退勤時刻は出勤時刻より後にしてください' }, { status: 400 })
  }
  if (eff_bs && eff_be && eff_be <= eff_bs) {
    return NextResponse.json({ error: '休憩終了時刻は休憩開始時刻より後にしてください' }, { status: 400 })
  }
  if (eff_ci && eff_bs && eff_bs < eff_ci) {
    return NextResponse.json({ error: '休憩開始時刻は出勤時刻より後にしてください' }, { status: 400 })
  }
  if (eff_co && eff_be && eff_be > eff_co) {
    return NextResponse.json({ error: '休憩終了時刻は退勤時刻より前にしてください' }, { status: 400 })
  }

  // --- INSERT（サーバー側で決定するフィールドのみ） ---
  const { data: inserted, error: insertErr } = await admin
    .from('attendance_correction_requests')
    .insert({
      company_id:           profile.company_id,
      attendance_record_id,
      worker_id:            uid,

      // original snapshot: DBから取得・クライアント値を使わない
      original_clock_in:    record.clock_in    ?? null,
      original_clock_out:   record.clock_out   ?? null,
      original_break_start: record.break_start ?? null,
      original_break_end:   record.break_end   ?? null,

      // 修正申請値
      requested_clock_in:    req_clock_in,
      requested_clock_out:   req_clock_out,
      requested_break_start: req_break_start,
      requested_break_end:   req_break_end,

      reason:      trimmedReason,
      status:      'submitted',
      reviewed_by: null,
      reviewed_at: null,
      review_comment: null,
    })
    .select()
    .single()

  if (insertErr) {
    if (insertErr.code === '23505') {
      return NextResponse.json(
        { error: 'この勤怠記録には既に申請中の修正申請があります' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({ correction: inserted }, { status: 201 })
}
