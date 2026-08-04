import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const [projectRes, schedulesRes, assignmentsRes] = await Promise.all([
    auth.adminClient.from('projects')
      .select(`*, recurring_project_details(*), clients(id, name)`)
      .eq('id', id).eq('company_id', auth.companyId).single(),
    auth.adminClient.from('recurring_monthly_schedules')
      .select('*').eq('project_id', id).order('month'),
    auth.adminClient.from('project_assignments').select('*').eq('project_id', id),
  ])

  if (projectRes.error) return NextResponse.json({ error: projectRes.error.message }, { status: 404 })

  return NextResponse.json({
    data: {
      ...projectRes.data,
      monthly_schedules: schedulesRes.data ?? [],
      assignments: assignmentsRes.data ?? [],
    },
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { recurring_details, monthly_schedules, assignments, ...projectFields } = await req.json()
  const client = auth.adminClient

  const { data, error } = await client
    .from('projects')
    .update({ ...projectFields, updated_at: new Date().toISOString() })
    .eq('id', id).eq('company_id', auth.companyId)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (recurring_details) {
    await client.from('recurring_project_details')
      .upsert({ project_id: id, ...recurring_details }, { onConflict: 'project_id' })
  }

  if (monthly_schedules !== undefined) {
    await client.from('recurring_monthly_schedules').delete().eq('project_id', id)
    if (monthly_schedules.length) {
      await client.from('recurring_monthly_schedules').insert(
        monthly_schedules.map((s: any) => ({ project_id: id, ...s }))
      )
    }
  }

  if (assignments !== undefined) {
    await client.from('project_assignments').delete().eq('project_id', id)
    if (assignments.length) {
      await client.from('project_assignments').insert(
        assignments.map((a: any) => ({ project_id: id, ...a }))
      )
    }
  }

  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const client = auth.adminClient

  // project_assignments は polymorphic FK のため手動削除
  await client.from('project_assignments').delete().eq('project_id', id)

  // projects を物理削除（CASCADE で関連テーブルも自動削除）
  const { error } = await client
    .from('projects')
    .delete()
    .eq('id', id).eq('company_id', auth.companyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
