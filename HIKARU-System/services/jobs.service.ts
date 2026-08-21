import { createClient } from '@/lib/supabase/client'
import { getJSTDateString } from '@/lib/date'

export interface JobRow {
  id: string
  project_id: string
  worker_id: string
  company_id: string
  status: 'in_progress' | 'completed' | 'cancelled'
  work_date: string
  started_at: string
  completed_at: string | null
  notes: string | null
  created_at: string
}

export async function getOrCreateTodayJob(projectId: string): Promise<JobRow | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) return null

  const today = getJSTDateString()

  // Existing job for today
  const { data: existing } = await supabase
    .from('jobs')
    .select('*')
    .eq('project_id', projectId)
    .eq('worker_id', user.id)
    .eq('work_date', today)
    .neq('status', 'cancelled')
    .maybeSingle()

  if (existing) return existing as JobRow

  // Create new job
  const { data: created, error } = await supabase
    .from('jobs')
    .insert({
      project_id: projectId,
      worker_id:  user.id,
      company_id: profile.company_id,
      status:     'in_progress',
      work_date:  today,
      started_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('[jobs] create error:', error.message)
    return null
  }
  return created as JobRow
}

export async function getTodayJob(projectId: string): Promise<JobRow | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const today = getJSTDateString()
  const { data } = await supabase
    .from('jobs')
    .select('*')
    .eq('project_id', projectId)
    .eq('worker_id', user.id)
    .eq('work_date', today)
    .neq('status', 'cancelled')
    .maybeSingle()

  return data as JobRow | null
}

export async function completeJob(jobId: string): Promise<boolean> {
  try {
    const res = await fetch('/api/jobs/complete', {
      method:      'POST',
      headers:     { 'Content-Type': 'application/json' },
      credentials: 'include',
      body:        JSON.stringify({ jobId }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function getJobById(jobId: string): Promise<JobRow | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single()
  return data as JobRow | null
}
