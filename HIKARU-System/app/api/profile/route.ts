import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/profile
// ログインWorker本人のプロフィールをサーバーサイドで取得。
// hk_s_uid cookie（ミドルウェア検証済み）から uid を取得し、
// Browser Supabase / auth.getUser() を一切使わない。
export async function GET(req: NextRequest) {
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email, phone, role')
      .eq('id', uid)
      .single()

    if (error || !data) {
      return Response.json({ error: 'profile not found' }, { status: 404 })
    }

    return Response.json({ profile: data })
  } catch (e) {
    console.error('[api/profile]', e)
    return Response.json({ error: 'server error' }, { status: 500 })
  }
}
