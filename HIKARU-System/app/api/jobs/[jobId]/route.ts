import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/jobs/[jobId]
// 案件詳細・photo_spots・今日のjob・写真をサーバー側で安全に取得。
// 認証: hk_s_uid cookie（ミドルウェア検証済み）
// 所有権: profiles → entity_type/entity_id → project_assignments → projects の順で確認
// ブラウザSupabaseクライアントを一切使わないため refreshingDeferred ハングを起こさない。
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId: projectId } = await params

  // 1. Worker認証（hk_s_uid はミドルウェアが検証済み）
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  try {
    // 2. profiles からサーバー側で entity_type / entity_id / company_id を取得
    //    クライアントから受け取った値は一切信用しない
    const { data: profile } = await admin
      .from('profiles')
      .select('entity_type, entity_id, company_id')
      .eq('id', uid)
      .single()

    if (!profile?.entity_type || !profile?.entity_id || !profile?.company_id) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    // 3. project_assignments で担当確認（IDOR対策）
    //    Employee / Partner 双方に対応（assignee_type で区別）
    const { data: assignment } = await admin
      .from('project_assignments')
      .select('project_id')
      .eq('assignee_type', profile.entity_type)
      .eq('assignee_id', profile.entity_id)
      .eq('project_id', projectId)
      .maybeSingle()

    if (!assignment) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }

    // 4. 案件取得（company_id 一致で他社案件へのアクセスを防止）
    const { data: project } = await admin
      .from('projects')
      .select('id, name, code, status, location_name, phone, emergency_contact, business_hours, notes')
      .eq('id', projectId)
      .eq('company_id', profile.company_id)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }

    // 5. photo_spots 取得
    const { data: photoSpots } = await admin
      .from('photo_spots')
      .select('id, name, order_num, is_required')
      .eq('project_id', projectId)
      .order('order_num', { ascending: true })

    // 6. 今日の job 取得（worker_id = uid で所有権確認）
    const today = new Date().toISOString().split('T')[0]
    const { data: todayJob } = await admin
      .from('jobs')
      .select('id, status, started_at, completed_at')
      .eq('project_id', projectId)
      .eq('worker_id', uid)
      .eq('work_date', today)
      .neq('status', 'cancelled')
      .maybeSingle()

    // 7. 写真取得（todayJob がある場合のみ）
    let photos: { id: string; job_id: string; spot_id: string; photo_type: string; url: string | null; created_at: string }[] = []
    if (todayJob?.id) {
      const { data: photoData } = await admin
        .from('photos')
        .select('id, job_id, spot_id, photo_type, url, created_at')
        .eq('job_id', todayJob.id)
        .order('created_at', { ascending: true })
      photos = photoData ?? []
    }

    return NextResponse.json({
      project,
      photoSpots: photoSpots ?? [],
      todayJob:   todayJob ?? null,
      photos,
    })
  } catch (e) {
    console.error('[api/jobs/[jobId]] error:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
