import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/jobs/[jobId]/manuals
// hk_s_uid cookie で Worker確認 → createClient (RLS維持) で manuals 取得
// /api/ai/manual が同じ createClient で manuals を取得できている実績から RLS維持方式を採用
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId: projectId } = await params
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const supabase = await createClient()

    // profiles から entity_type / entity_id をサーバー側で取得
    const { data: profile } = await supabase
      .from('profiles')
      .select('entity_type, entity_id')
      .eq('id', uid)
      .single()

    if (!profile?.entity_type || !profile?.entity_id) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    // project_assignments で担当確認（IDOR対策）
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

    // manuals 取得
    const { data: manuals } = await supabase
      .from('manuals')
      .select('id, type, title, content, file_url, order_num')
      .eq('project_id', projectId)
      .order('order_num', { ascending: true })

    return NextResponse.json({ manuals: manuals ?? [] })
  } catch (e) {
    console.error('[api/jobs/[jobId]/manuals] error:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
