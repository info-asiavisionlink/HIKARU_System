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
  const client   = auth.adminClient

  let query = client
    .from('projects')
    .select(`*, recurring_project_details(*), clients(id, name)`, { count: 'exact' })
    .eq('company_id', auth.companyId)
    .eq('project_type', 'recurring')
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

  const { recurring_details, monthly_schedules, assignments, ...projectFields } = await req.json()
  const client = auth.adminClient

  const { data: project, error: pErr } = await client
    .from('projects')
    .insert({ ...projectFields, company_id: auth.companyId, project_type: 'recurring' })
    .select().single()

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

  if (recurring_details) {
    await client.from('recurring_project_details').insert({ project_id: project.id, ...recurring_details })
  }

  if (monthly_schedules?.length) {
    await client.from('recurring_monthly_schedules').insert(
      monthly_schedules.map((s: any) => ({ project_id: project.id, ...s }))
    )
  }

  if (assignments?.length) {
    await client.from('project_assignments').insert(
      assignments.map((a: any) => ({ project_id: project.id, ...a }))
    )
  }

  return NextResponse.json({ data: project }, { status: 201 })
}
