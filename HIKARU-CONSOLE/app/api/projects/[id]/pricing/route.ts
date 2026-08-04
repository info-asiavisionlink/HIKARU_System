import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

function calcTax(amountExTax: number, taxRate: number) {
  const taxAmount    = Math.floor(amountExTax * taxRate)
  const amountIncTax = amountExTax + taxAmount
  return { taxAmount, amountIncTax }
}

// GET /api/projects/[id]/pricing
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const [billingRes, pricesRes] = await Promise.all([
    auth.adminClient.from('project_billing').select('*').eq('project_id', id).maybeSingle(),
    auth.adminClient.from('project_prices').select('*').eq('project_id', id).order('period_month', { ascending: true, nullsFirst: true }),
  ])

  return NextResponse.json({
    billing: billingRes.data ?? null,
    prices:  pricesRes.data ?? [],
  })
}

// PUT /api/projects/[id]/pricing
// Body:
//   billing: { billing_status, quote_number, contract_date, billing_date, payment_due_date, actual_payment_date, notes }
//   prices:  Array<{ period_month?, amount_ex_tax, tax_rate, unit_price?, quantity? }>
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const { billing, prices } = body
  const client = auth.adminClient

  // ── billing upsert
  if (billing) {
    const { error } = await client
      .from('project_billing')
      .upsert({ project_id: id, ...billing }, { onConflict: 'project_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // ── prices upsert (計算して保存)
  if (prices) {
    // 既存を全削除して再登録（upsert だと NULL UNIQUE が複雑になるため）
    await client.from('project_prices').delete().eq('project_id', id)

    const rows = (prices as any[])
      .filter((p) => Number(p.amount_ex_tax) > 0 || Number(p.unit_price) > 0)
      .map((p) => {
        const exTax    = Number(p.amount_ex_tax) || 0
        const taxRate  = Number(p.tax_rate ?? 0.10)
        const { taxAmount, amountIncTax } = calcTax(exTax, taxRate)
        return {
          project_id:     id,
          period_month:   p.period_month   ?? null,
          amount_ex_tax:  exTax,
          tax_rate:       taxRate,
          tax_amount:     taxAmount,
          amount_inc_tax: amountIncTax,
          unit_price:     p.unit_price     ?? null,
          quantity:       p.quantity       ?? null,
        }
      })

    if (rows.length > 0) {
      const { error } = await client.from('project_prices').insert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
