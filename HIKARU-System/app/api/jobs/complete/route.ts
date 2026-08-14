import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/jobs/complete
// ブラウザSupabase経由の completeJob() ハングリスクを回避するサーバー版。
// hk_s_uid cookie で Worker確認 → worker_id / company_id 二重所有権確認 →
// 二重完了防止 → jobs UPDATE
export async function POST(req: NextRequest) {
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { jobId } = body as { jobId?: string }
  if (!jobId) return Response.json({ error: 'jobId is required' }, { status: 400 })

  try {
    const supabase = await createClient()

    // profiles から company_id をサーバー側で決定（クライアント値を信用しない）
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', uid)
      .single()

    if (!profile?.company_id) {
      return Response.json({ error: 'forbidden' }, { status: 403 })
    }

    // 所有権確認: worker_id = uid かつ company_id 一致（担当外・他社ジョブは404）
    const { data: job } = await supabase
      .from('jobs')
      .select('id, status, worker_id, company_id')
      .eq('id', jobId)
      .eq('worker_id', uid)
      .eq('company_id', profile.company_id)
      .single()

    if (!job) {
      return Response.json({ error: 'not found' }, { status: 404 })
    }

    // 二重完了防止: 既に completed なら成功として返す（冪等）
    if (job.status === 'completed') {
      return Response.json({ job, already_completed: true })
    }

    // in_progress 以外は完了不可
    if (job.status !== 'in_progress') {
      return Response.json({ error: 'job is not in progress' }, { status: 400 })
    }

    const { data: updated, error: updateError } = await supabase
      .from('jobs')
      .update({
        status:       'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .eq('worker_id', uid)
      .select('id, project_id, worker_id, company_id, status, work_date, started_at, completed_at, notes, created_at')
      .single()

    if (updateError) {
      console.error('[api/jobs/complete]', updateError.message)
      return Response.json({ error: updateError.message }, { status: 500 })
    }

    return Response.json({ job: updated })
  } catch (e) {
    console.error('[api/jobs/complete] error:', e)
    return Response.json({ error: 'server_error' }, { status: 500 })
  }
}
