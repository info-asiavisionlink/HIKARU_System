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
  const cid      = auth.companyId

  let query = client
    .from('projects')
    .select(`
      *,
      spot_project_details(*),
      clients(id, name),
      project_assignments(assignee_type, assignee_id)
    `, { count: 'exact' })
    .eq('company_id', cid)
    .eq('project_type', 'spot')
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

  const body = await req.json()
  const { spot_details, assignments, ...projectFields } = body
  const client = auth.adminClient
  const cid    = auth.companyId

  const { data: project, error: pErr } = await client
    .from('projects')
    .insert({ ...projectFields, company_id: cid, project_type: 'spot' })
    .select()
    .single()

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

  if (spot_details) {
    await client.from('spot_project_details').insert({ project_id: project.id, ...spot_details })
  }

  if (assignments?.length) {
    await client.from('project_assignments').insert(
      assignments.map((a: any) => ({ project_id: project.id, ...a }))
    )
  }

  return NextResponse.json({ data: project }, { status: 201 })
}
