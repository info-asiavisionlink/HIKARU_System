import { createClient } from '@/lib/supabase/client'
import { getJSTDateString } from '@/lib/date'

export interface WorkerProject {
  id: string
  name: string
  code: string | null
  status: string
  location_name: string | null
  phone: string | null
  emergency_contact: string | null
  business_hours: string | null
  notes: string | null
  todayJob?: {
    id: string
    status: string
    started_at: string
    completed_at: string | null
  } | null
}

// 呼び出し元から workerId を渡せる場合は getUser() を呼ばない
// (createBrowserClient singleton の refreshingDeferred ハングを回避)
async function resolveWorkerId(workerId?: string): Promise<string | null> {
  if (workerId) return workerId
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function getWorkerProjects(opts?: {
  search?: string
  page?: number
  pageSize?: number
  workerId?: string
}): Promise<{ data: WorkerProject[]; count: number }> {
  const supabase = createClient()
  const wid = await resolveWorkerId(opts?.workerId)
  if (!wid) return { data: [], count: 0 }

  const page = opts?.page ?? 1
  const pageSize = opts?.pageSize ?? 50

  let query = supabase
    .from('projects')
    .select('*', { count: 'exact' })
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (opts?.search) {
    query = query.or(`name.ilike.%${opts.search}%,code.ilike.%${opts.search}%`)
  }

  const { data, count, error } = await query
  if (error) console.error('[getWorkerProjects] projects error:', error.message, error.code)
  if (!data) return { data: [], count: 0 }

  const today = getJSTDateString()
  const projectIds = data.map((p) => p.id)

  let todayJobs: any[] = []
  if (projectIds.length > 0) {
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id, project_id, status, started_at, completed_at')
      .in('project_id', projectIds)
      .eq('worker_id', wid)
      .eq('work_date', today)
    if (jobsError) console.error('[getWorkerProjects] jobs error:', jobsError.message)
    todayJobs = jobs ?? []
  }

  const todayJobMap = new Map(todayJobs.map((j) => [j.project_id, j]))

  const projects: WorkerProject[] = data.map((p: any) => ({
    ...p,
    todayJob: todayJobMap.get(p.id) ?? null,
  }))

  return { data: projects, count: count ?? 0 }
}

export async function getWorkerProject(projectId: string, workerId?: string): Promise<WorkerProject | null> {
  const supabase = createClient()
  const wid = await resolveWorkerId(workerId)
  if (!wid) return null

  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (error) console.error('[getWorkerProject] error:', error.message)
  if (!project) return null

  const today = getJSTDateString()
  const { data: job } = await supabase
    .from('jobs')
    .select('id, status, started_at, completed_at')
    .eq('project_id', projectId)
    .eq('worker_id', wid)
    .eq('work_date', today)
    .maybeSingle()

  return { ...(project as any), todayJob: job ?? null }
}

export async function getWorkerTodaySummary(workerId?: string) {
  const supabase = createClient()
  const wid = await resolveWorkerId(workerId)
  if (!wid) return { inProgress: 0, completed: 0, total: 0, jobs: [] as any[] }

  const today = getJSTDateString()
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('id, project_id, status, started_at, completed_at, projects(name, location_name)')
    .eq('worker_id', wid)
    .eq('work_date', today)

  if (error) console.error('[getWorkerTodaySummary] error:', error.message, error.code)

  const all = jobs ?? []
  return {
    inProgress: all.filter((j) => j.status === 'in_progress').length,
    completed:  all.filter((j) => j.status === 'completed').length,
    total:      all.length,
    jobs:       all,
  }
}
