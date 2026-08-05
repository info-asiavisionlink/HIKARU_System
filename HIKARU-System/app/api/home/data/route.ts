import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ホームページ全データをサーバーサイドで取得
// ブラウザ側の createBrowserClient シングルトン問題を完全回避
export async function GET(req: NextRequest) {
  const uid  = req.cookies.get('hk_s_uid')?.value
  const role = req.cookies.get('hk_s_role')?.value

  if (!uid || !role) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createClient()
    const today = new Date().toISOString().split('T')[0]

    // プロフィール取得（entity_type / entity_id を含む）
    const [profileRes, jobsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('name, role, entity_type, entity_id')
        .eq('id', uid)
        .single(),

      supabase
        .from('jobs')
        .select('id, project_id, status, started_at, completed_at, projects(name, location_name)')
        .eq('worker_id', uid)
        .eq('work_date', today),
    ])

    // 担当案件の取得（project_assignments 経由）
    const entityType = profileRes.data?.entity_type
    const entityId   = profileRes.data?.entity_id

    let assignedProjectIds: string[] = []
    if (entityType && entityId) {
      const { data: assignments } = await supabase
        .from('project_assignments')
        .select('project_id')
        .eq('assignee_type', entityType)
        .eq('assignee_id', entityId)

      assignedProjectIds = (assignments ?? []).map((a: any) => a.project_id)
    }

    // 案件一覧（担当案件のみ）
    let projects: any[] = []
    if (assignedProjectIds.length > 0) {
      const { data } = await supabase
        .from('projects')
        .select('id, name, code, status, location_name, phone, emergency_contact, business_hours, notes')
        .in('id', assignedProjectIds)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(3)
      projects = data ?? []
    }

    // 今日の jobs を案件IDでマップ
    const jobs = jobsRes.data ?? []
    const todayJobMap: Record<string, any> = {}
    for (const job of jobs) {
      todayJobMap[job.project_id] = job
    }

    const projectsWithStatus = projects.map((p) => ({
      ...p,
      todayJob: todayJobMap[p.id] ?? null,
    }))

    return Response.json({
      user: { id: uid, role },
      profile: profileRes.data ?? null,
      summary: {
        inProgress: jobs.filter((j) => j.status === 'in_progress').length,
        completed:  jobs.filter((j) => j.status === 'completed').length,
        total: jobs.length,
        jobs,
      },
      projects: projectsWithStatus,
    })
  } catch (e) {
    console.error('[home/data] error:', e)
    return Response.json({ error: 'server_error' }, { status: 500 })
  }
}
