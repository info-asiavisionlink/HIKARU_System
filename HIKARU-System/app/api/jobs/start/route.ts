import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/jobs/start
// ブラウザSupabase auth.getUser() ハングを回避するサーバー版 getOrCreateTodayJob
// hk_s_uid cookie で Worker確認 → createClient (RLS維持) でjobs INSERT
export async function POST(req: NextRequest) {
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { projectId } = body as { projectId?: string }
  if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })

  try {
    const supabase = await createClient()

    // profiles から company_id / entity_type / entity_id をサーバー側で取得
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id, entity_type, entity_id')
      .eq('id', uid)
      .single()

    if (!profile?.company_id || !profile?.entity_type || !profile?.entity_id) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    // project_assignments で担当確認（IDOR対策、Employee / Partner 双方対応）
    const { data: assignment } = await supabase
      .from('project_assignments')
      .select('project_id')
      .eq('assignee_type', profile.entity_type)
      .eq('assignee_id', profile.entity_id)
      .eq('project_id', projectId)
      .maybeSingle()

    if (!assignment) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }

    const today = new Date().toISOString().split('T')[0]

    // 二重作成防止: 同日の既存ジョブを確認
    const { data: existing } = await supabase
      .from('jobs')
      .select('id, project_id, worker_id, company_id, status, work_date, started_at, completed_at, notes, created_at')
      .eq('project_id', projectId)
      .eq('worker_id', uid)
      .eq('work_date', today)
      .neq('status', 'cancelled')
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ job: existing })
    }

    // 新規 job INSERT
    const { data: created, error } = await supabase
      .from('jobs')
      .insert({
        project_id: projectId,
        worker_id:  uid,
        company_id: profile.company_id,
        status:     'in_progress',
        work_date:  today,
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('[api/jobs/start] insert error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ job: created }, { status: 201 })
  } catch (e) {
    console.error('[api/jobs/start] error:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
