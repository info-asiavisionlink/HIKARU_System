import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

function getAdmin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  ) as any
}

// GET: 自分の提案一覧
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data } = await (supabase as any)
    .from('worker_proposals')
    .select('*, project_documents(id, doc_type, name, url, spot_name)')
    .eq('worker_id', user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ data: data ?? [] })
}

// POST: 案件提案を作成
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    project_name, project_type, client_name, client_phone, client_email,
    location_name, location_address, work_description, estimated_amount,
    start_date, end_date, notes, documents,
  } = body

  if (!project_name) return NextResponse.json({ error: 'project_name is required' }, { status: 400 })

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) return NextResponse.json({ error: 'no company' }, { status: 400 })

  const admin = getAdmin()

  // 提案を作成
  const { data: proposal, error } = await admin
    .from('worker_proposals')
    .insert({
      worker_id: user.id,
      company_id: profile.company_id,
      project_name, project_type: project_type ?? 'spot',
      client_name: client_name ?? null,
      client_phone: client_phone ?? null,
      client_email: client_email ?? null,
      location_name: location_name ?? null,
      location_address: location_address ?? null,
      work_description: work_description ?? null,
      estimated_amount: estimated_amount ? Number(estimated_amount) : null,
      start_date: start_date ?? null,
      end_date: end_date ?? null,
      notes: notes ?? null,
      status: 'pending',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 管理者へSystem通知（fire-and-forget・提案処理を失敗させない）
  void notifyAdminsOfProposalSubmitted(admin, {
    proposalId:  proposal.id,
    companyId:   profile.company_id,
    workerId:    user.id,
    projectName: proposal.project_name,
    projectType: proposal.project_type ?? 'spot',
  })

  // ドキュメントを紐付け
  if (documents && documents.length > 0) {
    await admin.from('project_documents').insert(
      documents.map((d: any) => ({
        company_id:   profile.company_id,
        proposal_id:  proposal.id,
        doc_type:     d.doc_type,
        name:         d.name ?? null,
        url:          d.url,
        storage_path: d.storage_path ?? null,
        spot_name:    d.spot_name ?? null,
        order_num:    d.order_num ?? 0,
      }))
    )
  }

  return NextResponse.json({ data: proposal }, { status: 201 })
}

// ============================================================
// 管理者System通知: 新案件提案（fire-and-forget）
// ============================================================

const PROPOSAL_TYPE_LABELS: Record<string, string> = {
  spot: '単発', recurring: '定期', hotel: 'ホテル', other: 'その他',
}

async function notifyAdminsOfProposalSubmitted(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: any,
  { proposalId, companyId, workerId, projectName, projectType }: {
    proposalId: string; companyId: string; workerId: string
    projectName: string; projectType: string
  }
): Promise<void> {
  try {
    // Worker名はサーバー側DBから取得（クライアント入力を信用しない）
    const { data: workerProfile } = await adminClient
      .from('profiles')
      .select('name')
      .eq('id', workerId)
      .single()
    const workerName = (workerProfile?.name as string | null) ?? 'Worker'

    const typeLabel = PROPOSAL_TYPE_LABELS[projectType] ?? projectType

    const { data: admins } = await adminClient
      .from('profiles')
      .select('id')
      .eq('company_id', companyId)
      .eq('role', 'admin')

    if (!admins || admins.length === 0) return

    const rows = admins.map((a: { id: string }) => ({
      company_id:           companyId,
      recipient_profile_id: a.id,
      title:                '新しい案件提案が届きました',
      body:                 `${workerName}さんから「${projectName}」（${typeLabel}）の案件提案が届きました。`,
      type:                 'project_proposal_submitted',
      target_app:           'console',
      is_read:              false,
      target_url:           '/project-requests',
    }))

    const { error } = await adminClient.from('notifications').insert(rows)
    if (error) console.error('[Admin通知] 提案通知挿入失敗:', error.message)
  } catch (e) {
    console.error('[Admin通知] 提案通知 予期しないエラー:', e)
  }
}
