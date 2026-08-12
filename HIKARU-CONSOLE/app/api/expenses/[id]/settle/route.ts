import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// POST /api/expenses/[id]/settle - approved → settled
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const settledAmount = typeof body.settled_amount === 'number' ? body.settled_amount : undefined

  const { data: existing } = await auth.adminClient
    .from('expenses')
    .select('status, company_id, amount')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: '経費が見つかりません' }, { status: 404 })
  if (existing.company_id !== auth.companyId) return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  if (existing.status !== 'approved') {
    return NextResponse.json({ error: '承認済みの経費のみ精算できます' }, { status: 400 })
  }

  const { data, error } = await auth.adminClient
    .from('expenses')
    .update({
      status:         'settled',
      settled_by:     auth.userId,
      settled_at:     new Date().toISOString(),
      settled_amount: settledAmount ?? existing.amount,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ expense: data })
}
