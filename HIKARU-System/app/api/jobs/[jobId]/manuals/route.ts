import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/jobs/[jobId]/manuals
// Phase B: 3階層スコープ (project > company > global) で返す。
// admin client + 手動 ownership/company isolation (AI manual API と同方式)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId: projectId } = await params
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const admin = createAdminClient()

    // profiles から entity_type / entity_id / company_id を取得
    type WorkerProfile = { entity_type: string; entity_id: string; company_id: string }
    const { data: profileRaw } = await admin
      .from('profiles')
      .select('entity_type, entity_id, company_id')
      .eq('id', uid)
      .single()
    const profile = profileRaw as WorkerProfile | null

    if (!profile?.entity_type || !profile?.entity_id || !profile?.company_id) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    // project_assignments で担当確認（IDOR対策）
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

    // 3階層同時取得
    const [
      { data: projectManuals },
      { data: companyManuals },
      { data: globalManuals },
    ] = await Promise.all([
      admin.from('manuals')
        .select('id, type, title, content, file_url, order_num')
        .eq('project_id', projectId)
        .order('order_num', { ascending: true }),

      admin.from('manuals')
        .select('id, type, title, content, file_url, order_num')
        .eq('company_id', profile.company_id)
        .eq('is_template', true)
        .is('project_id', null)
        .order('order_num', { ascending: true }),

      admin.from('manuals')
        .select('id, type, title, content, file_url, order_num')
        .is('company_id', null)
        .is('project_id', null)
        .order('order_num', { ascending: true }),
    ])

    type ManualRow = { id: string; type: string; title: string; content: string | null; file_url: string | null; order_num: number }

    // scope付きで結合 (UI表示用)
    const manuals = [
      ...(projectManuals as ManualRow[] ?? []).map(m => ({ ...m, scope: 'project' as const })),
      ...(companyManuals as ManualRow[] ?? []).map(m => ({ ...m, scope: 'company' as const })),
      ...(globalManuals  as ManualRow[] ?? []).map(m => ({ ...m, scope: 'global'  as const })),
    ]

    return NextResponse.json({ manuals })
  } catch (e) {
    console.error('[api/jobs/[jobId]/manuals] error:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
