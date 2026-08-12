import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// POST /api/expenses/[id]/approve - submitted → approved
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: existing } = await auth.adminClient
    .from('expenses')
    .select('status, company_id')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: '経費が見つかりません' }, { status: 404 })
  if (existing.company_id !== auth.companyId) return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  if (existing.status !== 'submitted') {
    return NextResponse.json({ error: '申請中の経費のみ承認できます' }, { status: 400 })
  }

  const { data, error } = await auth.adminClient
    .from('expenses')
    .update({
      status:      'approved',
      approved_by: auth.userId,
      approved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ expense: data })
}
