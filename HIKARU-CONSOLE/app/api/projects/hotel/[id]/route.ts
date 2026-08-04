import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const [projectRes, floorsRes, staffingRes, areasRes, assignmentsRes] = await Promise.all([
    auth.adminClient.from('projects')
      .select(`*, hotel_project_details(*), clients(id, name)`)
      .eq('id', id).eq('company_id', auth.companyId).single(),
    auth.adminClient.from('hotel_floors').select('*').eq('hotel_detail_id', id).order('order_num'),
    auth.adminClient.from('hotel_staffing_rules').select('*').eq('hotel_detail_id', id).order('order_num'),
    auth.adminClient.from('hotel_work_areas').select('*').eq('hotel_detail_id', id).order('order_num'),
    auth.adminClient.from('project_assignments').select('*').eq('project_id', id),
  ])

  if (projectRes.error) return NextResponse.json({ error: projectRes.error.message }, { status: 404 })

  return NextResponse.json({
    data: {
      ...projectRes.data,
      floors:         floorsRes.data ?? [],
      staffing_rules: staffingRes.data ?? [],
      work_areas:     areasRes.data ?? [],
      assignments:    assignmentsRes.data ?? [],
    },
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { hotel_details, floors, staffing_rules, work_areas, assignments, ...projectFields } = await req.json()
  const client = auth.adminClient

  const { data, error } = await client
    .from('projects')
    .update({ ...projectFields, updated_at: new Date().toISOString() })
    .eq('id', id).eq('company_id', auth.companyId)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (hotel_details) {
    await client.from('hotel_project_details')
      .upsert({ project_id: id, ...hotel_details }, { onConflict: 'project_id' })
  }

  if (floors !== undefined) {
    await client.from('hotel_floors').delete().eq('hotel_detail_id', id)
    if (floors.length) {
      await client.from('hotel_floors').insert(
        floors.map((f: any, i: number) => ({ hotel_detail_id: id, order_num: i, ...f }))
      )
    }
  }

  if (staffing_rules !== undefined) {
    await client.from('hotel_staffing_rules').delete().eq('hotel_detail_id', id)
    if (staffing_rules.length) {
      await client.from('hotel_staffing_rules').insert(
        staffing_rules.map((s: any, i: number) => ({ hotel_detail_id: id, order_num: i, ...s }))
      )
    }
  }

  if (work_areas !== undefined) {
    await client.from('hotel_work_areas').delete().eq('hotel_detail_id', id)
    if (work_areas.length) {
      await client.from('hotel_work_areas').insert(
        work_areas.map((w: any, i: number) => ({ hotel_detail_id: id, order_num: i, ...w }))
      )
    }
  }

  if (assignments !== undefined) {
    await client.from('project_assignments').delete().eq('project_id', id)
    if (assignments.length) {
      await client.from('project_assignments').insert(
        assignments.map((a: any) => ({ project_id: id, ...a }))
      )
    }
  }

  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const client = auth.adminClient

  // project_assignments は polymorphic FK のため手動削除
  await client.from('project_assignments').delete().eq('project_id', id)

  // projects を物理削除（CASCADE で関連テーブルも自動削除）
  const { error } = await client
    .from('projects')
    .delete()
    .eq('id', id).eq('company_id', auth.companyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
