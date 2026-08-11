import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

const admin = () => createClient as unknown as ReturnType<typeof createAdmin>

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const systemUrl = process.env.NEXT_PUBLIC_SYSTEM_URL!

  if (!code) {
    return NextResponse.redirect(`${systemUrl}/google?error=no_code`)
  }

  // 1. code をトークンに交換
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  `${systemUrl}/api/auth/google/callback`,
      grant_type:    'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${systemUrl}/google?error=token_exchange`)
  }

  const tokens = await tokenRes.json()

  // 2. Googleアカウントのメールアドレスを取得
  const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const userInfo = userInfoRes.ok ? await userInfoRes.json() : {}

  // 3. 現在のSupabaseユーザーを取得
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${systemUrl}/login`)
  }

  // 4. トークンをDBに保存（UPSERT）
  const adminClient = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  await (adminClient as any)
    .from('google_tokens')
    .upsert({
      user_id:       user.id,
      google_email:  userInfo.email ?? null,
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      expiry_date:   tokens.expires_in
        ? Date.now() + tokens.expires_in * 1000
        : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  return NextResponse.redirect(`${systemUrl}/google?connected=1`)
}
