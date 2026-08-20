import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/shifts?date_from=2026-08-01&date_to=2026-08-31
// 自分に割り当てられたシフトのみ返す（entity_id フィルタ）
export async function GET(req: NextRequest) {
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const p        = req.nextUrl.searchParams
  const dateFrom = p.get('date_from')
  const dateTo   = p.get('date_to')

  // createClient()はhk_s_uidクッキーと互換性なし（Supabase sessionなし）
  // createAdminClientを使い、entity_idアプリ層フィルタで本人のみに限定
  const supabase = createAdminClient()

  // entity_type / entity_id を取得
  const { data: profile } = await supabase
    .from('profiles')
    .select('entity_type, entity_id')
    .eq('id', uid)
    .single()

  if (!profile?.entity_type || !profile?.entity_id) {
    return NextResponse.json({ shifts: [] })
  }

  // employee_id または partner_id でフィルタ
  const idColumn = profile.entity_type === 'employee' ? 'employee_id' : 'partner_id'

  let query = supabase
    .from('shifts')
    .select(`
      id, shift_date, start_time, end_time, status, notes,
      assignee_type,
      projects:project_id (id, name, location_name, address, project_type)
    `)
    .eq(idColumn, profile.entity_id)
    .neq('status', 'cancelled')
    .order('shift_date', { ascending: true })
    .order('start_time', { ascending: true })

  if (dateFrom) query = query.gte('shift_date', dateFrom)
  if (dateTo)   query = query.lte('shift_date', dateTo)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ shifts: data ?? [] })
}

// POST /api/shifts - シフト新規登録（status: 'scheduled'）
// UIの ShiftForm から呼ばれる。entity_id / company_id はサーバー側で決定。
export async function POST(req: NextRequest) {
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = createAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('entity_type, entity_id, company_id')
    .eq('id', uid)
    .single()

  if (!profile?.entity_type || !profile?.entity_id || !profile?.company_id) {
    return NextResponse.json({ error: 'プロフィール情報が取得できません' }, { status: 403 })
  }

  const body = await req.json()
  const { project_id, shift_date, start_time, end_time, notes } = body as {
    project_id?: string
    shift_date?: string
    start_time?: string
    end_time?: string
    notes?: string | null
  }

  if (!project_id) return NextResponse.json({ error: '案件を選択してください' },   { status: 400 })
  if (!shift_date) return NextResponse.json({ error: '日付を入力してください' },   { status: 400 })
  if (!start_time) return NextResponse.json({ error: '開始時刻を入力してください' }, { status: 400 })
  if (!end_time)   return NextResponse.json({ error: '終了時刻を入力してください' }, { status: 400 })
  if (start_time >= end_time) {
    return NextResponse.json({ error: '終了時刻は開始時刻より後にしてください' }, { status: 400 })
  }

  // 担当案件確認（IDOR対策）
  const { data: assignment } = await supabase
    .from('project_assignments')
    .select('project_id')
    .eq('assignee_type', profile.entity_type)
    .eq('assignee_id', profile.entity_id)
    .eq('project_id', project_id)
    .maybeSingle()

  if (!assignment) {
    return NextResponse.json({ error: '担当していない案件です' }, { status: 403 })
  }

  // 重複チェック（PUT側と同じRPCを使用）
  const empId = profile.entity_type === 'employee' ? profile.entity_id : null
  const ptrId = profile.entity_type === 'partner'  ? profile.entity_id : null

  const { data: overlaps } = await supabase.rpc('check_shift_overlap', {
    p_employee_id:   empId,
    p_partner_id:    ptrId,
    p_assignee_type: profile.entity_type,
    p_shift_date:    shift_date,
    p_start_time:    start_time,
    p_end_time:      end_time,
    p_exclude_id:    null,
  })

  if (overlaps && (overlaps as unknown[]).length > 0) {
    return NextResponse.json({ error: '同じ時間帯に別のシフトが存在します', overlaps }, { status: 409 })
  }

  // INSERT（サーバー側でentity_id・company_id・statusを決定）
  const insertData: Record<string, unknown> = {
    company_id:    profile.company_id,
    project_id,
    shift_date,
    start_time,
    end_time,
    notes:         notes ?? null,
    assignee_type: profile.entity_type,
    status:        'scheduled',
  }
  if (profile.entity_type === 'employee') {
    insertData.employee_id = profile.entity_id
  } else {
    insertData.partner_id = profile.entity_id
  }

  const { data: shift, error } = await supabase
    .from('shifts')
    .insert(insertData)
    .select(`
      id, shift_date, start_time, end_time, status, notes, assignee_type,
      projects:project_id (id, name, location_name, address, project_type)
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ shift }, { status: 201 })
}
