import { NextRequest } from 'next/server'

// ミドルウェアが既に hk_s_uid / hk_s_role で認証済みであることを前提に
// Cookie から直接ユーザーIDを取得する（Supabase auth.getUser() は呼ばない）
export async function GET(req: NextRequest) {
  const uid  = req.cookies.get('hk_s_uid')?.value
  const role = req.cookies.get('hk_s_role')?.value

  if (!uid || !role) {
    return Response.json({ user: null }, { status: 401 })
  }

  return Response.json({ user: { id: uid, role } })
}
