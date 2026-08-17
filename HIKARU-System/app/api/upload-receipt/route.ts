import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

const admin = createSupabaseAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// POST /api/upload-receipt
// ファイルを receipts バケットへアップロードし expense_receipts に記録
export async function POST(req: NextRequest) {
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const form = await req.formData()
  const file       = form.get('file')       as File | null
  const expenseId  = form.get('expense_id') as string | null

  if (!file || !expenseId) {
    return NextResponse.json({ error: 'file と expense_id が必要です' }, { status: 400 })
  }

  // 経費の所有者確認 + company_id 取得
  const { data: expense } = await admin
    .from('expenses')
    .select('worker_id, company_id, status')
    .eq('id', expenseId)
    .single()

  if (!expense) return NextResponse.json({ error: '経費が見つかりません' }, { status: 404 })
  if (expense.worker_id !== uid) return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  if (!['draft', 'submitted'].includes(expense.status)) {
    return NextResponse.json({ error: '承認済みの経費には領収書を追加できません' }, { status: 400 })
  }

  const bytes  = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const ext    = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const fileName = `receipt-${Date.now()}.${ext}`
  const storagePath = `${expense.company_id}/${uid}/${expenseId}/${fileName}`

  const { error: uploadError } = await admin.storage
    .from('receipts')
    .upload(storagePath, buffer, {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  // expense_receipts に記録
  const { data: receipt, error: dbError } = await admin
    .from('expense_receipts')
    .insert({
      expense_id:   expenseId,
      company_id:   expense.company_id,
      storage_path: storagePath,
      file_name:    file.name,
      mime_type:    file.type || 'image/jpeg',
      file_size:    file.size,
    })
    .select()
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ receipt }, { status: 201 })
}
