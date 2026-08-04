import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

export async function GET(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search   = searchParams.get('search') ?? ''
  const status   = searchParams.get('status') ?? ''
  const page     = parseInt(searchParams.get('page') ?? '1')
  const pageSize = parseInt(searchParams.get('pageSize') ?? '20')

  let query = auth.adminClient
    .from('projects')
    .select(`*, hotel_project_details(*), clients(id, name)`, { count: 'exact' })
    .eq('company_id', auth.companyId)
    .eq('project_type', 'hotel')
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (search) query = query.ilike('name', `%${search}%`)
  if (status) query = query.eq('status', status)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { hotel_details, floors, staffing_rules, work_areas, assignments, ...projectFields } = await req.json()
  const client = auth.adminClient

  const { data: project, error: pErr } = await client
    .from('projects')
    .insert({ ...projectFields, company_id: auth.companyId, project_type: 'hotel' })
    .select().single()

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

  if (hotel_details) {
    await client.from('hotel_project_details').insert({ project_id: project.id, ...hotel_details })
  }

  if (floors?.length) {
    await client.from('hotel_floors').insert(
      floors.map((f: any, i: number) => ({ hotel_detail_id: project.id, order_num: i, ...f }))
    )
  }

  if (staffing_rules?.length) {
    await client.from('hotel_staffing_rules').insert(
      staffing_rules.map((s: any, i: number) => ({ hotel_detail_id: project.id, order_num: i, ...s }))
    )
  }

  if (work_areas?.length) {
    await client.from('hotel_work_areas').insert(
      work_areas.map((w: any, i: number) => ({ hotel_detail_id: project.id, order_num: i, ...w }))
    )
  }

  if (assignments?.length) {
    await client.from('project_assignments').insert(
      assignments.map((a: any) => ({ project_id: project.id, ...a }))
    )
  }

  return NextResponse.json({ data: project }, { status: 201 })
}
