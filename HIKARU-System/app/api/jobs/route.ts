import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getJSTDateString } from '@/lib/date'

// GET /api/jobs - 担当案件一覧（project_assignments 経由でフィルタリング）
export async function GET(req: NextRequest) {
  const uid  = req.cookies.get('hk_s_uid')?.value
  const role = req.cookies.get('hk_s_role')?.value

  if (!uid || !role) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createClient()
    const today = getJSTDateString()

    // entity_type / entity_id を取得
    const { data: profile } = await supabase
      .from('profiles')
      .select('entity_type, entity_id')
      .eq('id', uid)
      .single()

    const entityType = profile?.entity_type
    const entityId   = profile?.entity_id

    // 担当プロジェクトID一覧
    let assignedProjectIds: string[] = []
    if (entityType && entityId) {
      const { data: assignments } = await supabase
        .from('project_assignments')
        .select('project_id')
        .eq('assignee_type', entityType)
        .eq('assignee_id', entityId)

      assignedProjectIds = (assignments ?? []).map((a: any) => a.project_id)
    }

    if (assignedProjectIds.length === 0) {
      return NextResponse.json({ data: [], count: 0 })
    }

    // 担当案件一覧（アクティブのみ）
    const { data: projects, count } = await supabase
      .from('projects')
      .select('id, name, code, status, location_name, phone, emergency_contact, business_hours, notes', { count: 'exact' })
      .in('id', assignedProjectIds)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    // 今日の jobs
    const { data: jobs } = await supabase
      .from('jobs')
      .select('id, project_id, status, started_at, completed_at')
      .eq('worker_id', uid)
      .eq('work_date', today)
      .in('project_id', assignedProjectIds)

    const todayJobMap: Record<string, any> = {}
    for (const job of jobs ?? []) {
      todayJobMap[job.project_id] = job
    }

    const projectsWithStatus = (projects ?? []).map((p) => ({
      ...p,
      todayJob: todayJobMap[p.id] ?? null,
    }))

    return NextResponse.json({ data: projectsWithStatus, count: count ?? 0 })
  } catch (e) {
    console.error('[jobs] error:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
