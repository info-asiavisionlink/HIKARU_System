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

// PUT /api/shifts/[id]
// Worker本人が登録した 'scheduled' 状態のシフトを編集する
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createAdminClient()
  const profile  = await resolveWorkerProfile(uid)

  if (!profile?.entity_type || !profile?.entity_id || !profile?.company_id) {
    return NextResponse.json({ error: 'profile が見つかりません' }, { status: 400 })
  }

  // 所有権確認: 自分のシフトかどうか
  const empCol = profile.entity_type === 'employee' ? 'employee_id' : 'partner_id'
  const { data: existing } = await supabase
    .from('shifts')
    .select('id, status, employee_id, partner_id')
    .eq('id', id)
    .eq('company_id', profile.company_id)
    .eq(empCol, profile.entity_id)
    .single()

  if (!existing) return NextResponse.json({ error: 'シフトが見つかりません' }, { status: 404 })

  // 編集可能なのは 'scheduled' 状態のみ（確定・完了済みは変更不可）
  if (existing.status !== 'scheduled') {
    return NextResponse.json({ error: '確定済みまたは完了したシフトは変更できません' }, { status: 400 })
  }

  const body = await req.json()
  const { project_id, shift_date, start_time, end_time, notes } = body

  if (!shift_date || !start_time || !end_time) {
    return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
  }

  // 案件変更がある場合は担当確認
  if (project_id) {
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
  }

  // 重複チェック（自分自身のシフトを除外）
  const empId = profile.entity_type === 'employee' ? profile.entity_id : null
  const ptrId = profile.entity_type === 'partner'  ? profile.entity_id : null

  const { data: overlaps } = await supabase.rpc('check_shift_overlap', {
    p_employee_id:   empId,
    p_partner_id:    ptrId,
    p_assignee_type: profile.entity_type,
    p_shift_date:    shift_date,
    p_start_time:    start_time,
    p_end_time:      end_time,
    p_exclude_id:    id,
  })

  if (overlaps && (overlaps as unknown[]).length > 0) {
    return NextResponse.json({ error: '同じ時間帯に別のシフトが存在します', overlaps }, { status: 409 })
  }

  // 更新フィールドを明示（Mass Assignment 防止）
  const update: Record<string, unknown> = {
    shift_date,
    start_time,
    end_time,
    notes: notes ?? null,
  }
  if (project_id) update.project_id = project_id

  const { data: shift, error } = await supabase
    .from('shifts')
    .update(update)
    .eq('id', id)
    .eq('company_id', profile.company_id)
    .select(`
      id, shift_date, start_time, end_time, status, notes, assignee_type,
      projects:project_id (id, name, location_name, address, project_type)
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ shift })
}

// PATCH /api/shifts/[id]
// Worker本人が自分の 'scheduled' シフトを取消（status → 'cancelled'）
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createAdminClient()
  const profile  = await resolveWorkerProfile(uid)

  if (!profile?.entity_type || !profile?.entity_id || !profile?.company_id) {
    return NextResponse.json({ error: 'profile が見つかりません' }, { status: 400 })
  }

  const empCol = profile.entity_type === 'employee' ? 'employee_id' : 'partner_id'
  const { data: existing } = await supabase
    .from('shifts')
    .select('id, status')
    .eq('id', id)
    .eq('company_id', profile.company_id)
    .eq(empCol, profile.entity_id)
    .single()

  if (!existing) return NextResponse.json({ error: 'シフトが見つかりません' }, { status: 404 })

  // confirmed / completed は Worker から取消不可
  if (existing.status === 'confirmed' || existing.status === 'completed') {
    return NextResponse.json({ error: '確定済みのシフトは取消できません。管理者にお問い合わせください。' }, { status: 400 })
  }
  if (existing.status === 'cancelled') {
    return NextResponse.json({ error: 'すでに取消済みです' }, { status: 400 })
  }

  const { data: shift, error } = await supabase
    .from('shifts')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('company_id', profile.company_id)
    .select('id, status')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ shift })
}
