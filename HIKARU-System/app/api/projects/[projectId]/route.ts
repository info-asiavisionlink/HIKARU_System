import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/projects/[projectId]
// 案件詳細の初期表示データをサーバーサイドで取得
// ブラウザ側の createBrowserClient / initializePromise 依存を完全回避
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const uid  = req.cookies.get('hk_s_uid')?.value
  const role = req.cookies.get('hk_s_role')?.value

  if (!uid || !role) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { projectId } = await params

  try {
    const supabase = await createClient()
    const today = new Date().toISOString().split('T')[0]

    // ownership: プロフィールから entity_type / entity_id を取得
    const { data: profile } = await supabase
      .from('profiles')
      .select('entity_type, entity_id')
      .eq('id', uid)
      .single()

    if (!profile?.entity_type || !profile?.entity_id) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    // ownership: この案件が当該ユーザーに担当割り当てされているか確認
    const { data: assignment } = await supabase
      .from('project_assignments')
      .select('project_id')
      .eq('assignee_type', profile.entity_type)
      .eq('assignee_id', profile.entity_id)
      .eq('project_id', projectId)
      .maybeSingle()

    if (!assignment) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    // 案件・撮影箇所・今日のjobを並列取得
    const [projectRes, spotsRes, jobRes] = await Promise.all([
      supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single(),
      supabase
        .from('photo_spots')
        .select('*')
        .eq('project_id', projectId)
        .order('order_num', { ascending: true }),
      supabase
        .from('jobs')
        .select('id, status, started_at, completed_at')
        .eq('project_id', projectId)
        .eq('worker_id', uid)
        .eq('work_date', today)
        .maybeSingle(),
    ])

    if (!projectRes.data) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    // 今日のjobがあれば写真も取得
    let photos: any[] = []
    if (jobRes.data?.id) {
      const { data: photoData } = await supabase
        .from('photos')
        .select('*')
        .eq('job_id', jobRes.data.id)
        .order('created_at', { ascending: true })
      photos = photoData ?? []
    }

    return NextResponse.json({
      project:  projectRes.data,
      spots:    spotsRes.data ?? [],
      todayJob: jobRes.data ?? null,
      photos,
    })
  } catch (e) {
    console.error('[api/projects/[projectId]] error:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
