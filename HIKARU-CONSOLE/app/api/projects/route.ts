import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// GET /api/projects
export async function GET(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized', projects: [], count: 0 }, { status: 401 })
  }

  const url    = new URL(req.url)
  const search = url.searchParams.get('search') ?? ''
  const status = url.searchParams.get('status') ?? ''
  const page   = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'))
  const size   = Math.min(100, parseInt(url.searchParams.get('pageSize') ?? '20'))

  // service_role + company_id フィルタ（RLS 無限再帰を完全回避）
  let query = auth.adminClient
    .from('projects')
    .select('*, stores(id, name, clients(id, name))', { count: 'exact' })
    .eq('company_id', auth.companyId)
    .order('created_at', { ascending: false })
    .range((page - 1) * size, page * size - 1)

  if (search) {
    query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%,location_name.ilike.%${search}%`)
  }
  if (status) {
    query = query.eq('status', status)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message, projects: [], count: 0 }, { status: 500 })
  }

  return NextResponse.json({
    projects: data ?? [],
    count: count ?? 0,
    debug: process.env.NODE_ENV === 'development'
      ? { auth_method: 'service_role_with_company_filter', company_id: auth.companyId }
      : undefined,
  })
}

// POST /api/projects
export async function POST(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { data, error } = await auth.adminClient
    .from('projects')
    .insert({ company_id: auth.companyId, status: 'active', ...body })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ project: data }, { status: 201 })
}
