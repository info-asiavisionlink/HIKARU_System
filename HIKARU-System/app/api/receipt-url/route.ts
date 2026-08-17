import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

const admin = createSupabaseAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// GET /api/receipt-url?path=xxx
// 認証済みユーザーのみが領収書の Signed URL を取得可能
export async function GET(req: NextRequest) {
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const storagePath = req.nextUrl.searchParams.get('path')
  if (!storagePath) return NextResponse.json({ error: 'path is required' }, { status: 400 })

  // このパスが自分の経費に紐づくか確認
  const { data: receipt } = await admin
    .from('expense_receipts')
    .select('expense_id, expenses!inner(worker_id)')
    .eq('storage_path', storagePath)
    .single()

  // 型アサーション
  const expenseData = receipt?.expenses as any
  if (!receipt || expenseData?.worker_id !== uid) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }

  const { data, error } = await admin.storage
    .from('receipts')
    .createSignedUrl(storagePath, 300) // 5分間有効

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ url: data.signedUrl })
}
