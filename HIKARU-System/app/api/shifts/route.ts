import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

type Profile = { entity_type: string | null; entity_id: string | null; company_id: string | null }

async function resolveWorkerProfile(uid: string): Promise<Profile | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('profiles')
    .select('entity_type, entity_id, company_id')
    .eq('id', uid)
    .single()
  return (data as Profile | null)
}

// GET /api/shifts?date_from=2026-08-01&date_to=2026-08-31
// 自分に割り当てられたシフトのみ返す（entity_id フィルタ）
export async function GET(req: NextRequest) {
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const p        = req.nextUrl.searchParams
  const dateFrom = p.get('date_from')
  const dateTo   = p.get('date_to')

  const supabase = createAdminClient()

  const profile = await resolveWorkerProfile(uid)
  if (!profile?.entity_type || !profile?.entity_id) {
    return NextResponse.json({ shifts: [] })
  }

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

// POST /api/shifts
// Worker本人のシフトを登録する。assignee_id / company_id はサーバー側で決定。
export async function POST(req: NextRequest) {
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const profile  = await resolveWorkerProfile(uid)

  if (!profile?.entity_type || !profile?.entity_id || !profile?.company_id) {
    return NextResponse.json({ error: 'profile が見つかりません' }, { status: 400 })
  }

  const body = await req.json()
  const { project_id, shift_date, start_time, end_time, notes } = body

  if (!project_id || !shift_date || !start_time || !end_time) {
    return NextResponse.json({ error: '必須項目が不足しています（案件・日付・開始時刻・終了時刻）' }, { status: 400 })
  }

  // 担当案件であることを確認（project_assignments ownership チェック）
  const { data: assignment } = await supabase
    .from('project_assignments')
    .select('project_id')
    .eq('assignee_type', profile.entity_type)
    .eq('assignee_id', profile.entity_id)
    .eq('project_id', project_id)
    .maybeSingle()

  if (!assignment) {
    return NextResponse.json({ error: '担当していない案件へのシフト登録はできません' }, { status: 403 })
  }

  // 案件が同一 company_id に属することも確認（cross-tenant 防止）
  const { data: proj } = await supabase
    .from('projects')
    .select('id')
    .eq('id', project_id)
    .eq('company_id', profile.company_id)
    .single()

  if (!proj) {
    return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 })
  }

  // 重複チェック（既存 check_shift_overlap RPC を再利用）
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

  // INSERT: assignee 情報はサーバー側で決定（クライアント値を信用しない）
  const { data: shift, error } = await supabase
    .from('shifts')
    .insert({
      company_id:    profile.company_id,
      project_id,
      assignee_type: profile.entity_type,
      employee_id:   empId,
      partner_id:    ptrId,
      shift_date,
      start_time,
      end_time,
      notes:         notes ?? null,
      status:        'scheduled',
      created_by:    uid,
    })
    .select(`
      id, shift_date, start_time, end_time, status, notes, assignee_type,
      projects:project_id (id, name, location_name, address, project_type)
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ shift }, { status: 201 })
}
