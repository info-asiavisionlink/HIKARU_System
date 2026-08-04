import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

async function getAdminCompanyId() {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const uid = cookieStore.get('hk_c_uid')?.value
  if (!uid) return null
  const { data } = await supabase.from('profiles').select('company_id, role').eq('id', uid).single()
  if (!data || data.role !== 'admin') return null
  return data.company_id as string
}

// GET /api/projects/[id]/assignments - 案件の担当者一覧
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const companyId = await getAdminCompanyId()
  if (!companyId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('project_assignments')
    .select('*')
    .eq('project_id', id)
    .order('assigned_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// PUT /api/projects/[id]/assignments - 担当者を一括更新
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const companyId = await getAdminCompanyId()
  if (!companyId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { assignments } = await req.json() as {
    assignments: { assignee_type: 'employee' | 'partner'; assignee_id: string }[]
  }

  const admin = createAdminClient()

  // 既存の割り当てを全削除して再登録
  await admin.from('project_assignments').delete().eq('project_id', id)

  if (assignments.length > 0) {
    const rows = assignments.map((a) => ({
      project_id: id,
      assignee_type: a.assignee_type,
      assignee_id: a.assignee_id,
    }))

    const { error } = await admin.from('project_assignments').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
