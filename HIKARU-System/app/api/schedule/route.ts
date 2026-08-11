import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const year  = parseInt(req.nextUrl.searchParams.get('year')  ?? String(new Date().getFullYear()), 10)
  const month = parseInt(req.nextUrl.searchParams.get('month') ?? String(new Date().getMonth() + 1), 10)

  const firstStr = new Date(year, month - 1, 1).toISOString().slice(0, 10)
  const lastStr  = new Date(year, month, 0).toISOString().slice(0, 10)

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('entity_type, entity_id')
    .eq('id', uid)
    .single()

  if (!profile?.entity_type || !profile?.entity_id) {
    return NextResponse.json({ data: [] })
  }

  const { data: assignments } = await admin
    .from('project_assignments')
    .select('project_id')
    .eq('assignee_type', profile.entity_type)
    .eq('assignee_id', profile.entity_id)

  const projectIds = (assignments ?? []).map((a: any) => a.project_id)
  if (projectIds.length === 0) return NextResponse.json({ data: [] })

  const { data: projects } = await admin
    .from('projects')
    .select('id, name, code, project_type, status, start_date, end_date, work_start_time, work_end_time, location_name')
    .in('id', projectIds)
    .lte('start_date', lastStr)
    .gte('end_date', firstStr)
    .order('start_date', { ascending: true })

  return NextResponse.json({ data: projects ?? [] })
}
