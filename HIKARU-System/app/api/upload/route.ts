import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service Role Key でアップロード（RLS バイパス） — 案件提案書専用
// セキュリティ: hk_s_uid Cookie で認証済みユーザーのみアクセス可能
const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ALLOWED_PATH_PREFIX = 'proposals/'

export async function POST(req: NextRequest) {
  // 認証チェック（middleware でも確認されるが API レベルでも保証）
  const uid  = req.cookies.get('hk_s_uid')?.value
  const role = req.cookies.get('hk_s_role')?.value
  if (!uid || role !== 'worker') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    const path = form.get('path') as string | null

    if (!file || !path) {
      return NextResponse.json({ error: 'file と path が必要です' }, { status: 400 })
    }

    // パスが許可されたプレフィックスで始まることを検証
    if (!path.startsWith(ALLOWED_PATH_PREFIX)) {
      return NextResponse.json({ error: '無効なアップロードパスです' }, { status: 400 })
    }

    const bytes  = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const { error } = await adminClient.storage
      .from('documents')
      .upload(path, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: true,
      })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data: { publicUrl } } = adminClient.storage
      .from('documents')
      .getPublicUrl(path)

    return NextResponse.json({ publicUrl, path })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export const config = {
  api: { bodyParser: false },
}
