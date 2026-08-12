import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// GET /api/receipts/signed-url?path=xxx - 管理者用領収書 signed URL
export async function GET(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const storagePath = req.nextUrl.searchParams.get('path')
  if (!storagePath) return NextResponse.json({ error: 'path は必須です' }, { status: 400 })

  // 該当領収書が自社の経費に紐づくか確認
  const { data: receipt } = await auth.adminClient
    .from('expense_receipts')
    .select('company_id')
    .eq('storage_path', storagePath)
    .single()

  if (!receipt || receipt.company_id !== auth.companyId) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }

  const { data, error } = await auth.adminClient.storage
    .from('receipts')
    .createSignedUrl(storagePath, 600) // 10分間有効

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ url: data.signedUrl })
}
