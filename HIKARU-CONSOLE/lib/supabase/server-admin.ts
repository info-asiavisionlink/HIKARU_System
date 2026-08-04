/**
 * API Route 用の認証付きクエリヘルパー
 *
 * 優先順位:
 * 1. @supabase/ssr の Session Cookie（新フォーマット）
 * 2. hk_c_at Cookie（旧フォーマット AT）
 * 3. hk_c_uid + service_role（最終フォールバック）
 *
 * どれかが使えれば company_id を返す。
 * middleware が hk_c_role + hk_c_uid を検証済みなので
 * hk_c_uid がある = 認証済みユーザーとみなせる。
 */
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export interface AuthContext {
  companyId: string
  userId: string
  /** RLS有効クライアント（使える場合）。null の場合は admin + company_id フィルタで代替 */
  rlsClient: ReturnType<typeof createServerClient> | null
  /** service_role クライアント（常に使用可能） */
  adminClient: ReturnType<typeof createSupabaseClient>
}

function getAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const cookieStore = await cookies()
  const admin = getAdminClient()

  // ——— 試行 1: @supabase/ssr Session Cookie ———
  const rlsSupabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )

  const { data: { user: rlsUser } } = await rlsSupabase.auth.getUser()
  if (rlsUser) {
    const { data: profile } = await admin
      .from('profiles')
      .select('company_id')
      .eq('id', rlsUser.id)
      .single()

    if (profile?.company_id) {
      return { companyId: profile.company_id, userId: rlsUser.id, rlsClient: rlsSupabase, adminClient: admin }
    }
  }

  // ——— 試行 2: hk_c_at (旧フォーマット AT Cookie) ———
  const at = cookieStore.get('hk_c_at')?.value
  if (at) {
    const atClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${at}` } },
        auth: { autoRefreshToken: false, persistSession: false },
      }
    )
    const { data: { user: atUser } } = await atClient.auth.getUser()
    if (atUser) {
      const { data: profile } = await admin
        .from('profiles')
        .select('company_id')
        .eq('id', atUser.id)
        .single()

      if (profile?.company_id) {
        return { companyId: profile.company_id, userId: atUser.id, rlsClient: null, adminClient: admin }
      }
    }
  }

  // ——— 試行 3: hk_c_uid (middleware が検証済み) ———
  const uid = cookieStore.get('hk_c_uid')?.value
  const role = cookieStore.get('hk_c_role')?.value

  if (uid && role === 'admin') {
    const { data: profile } = await admin
      .from('profiles')
      .select('company_id, role')
      .eq('id', uid)
      .eq('role', 'admin')
      .single()

    if (profile?.company_id) {
      // service_role + company_id フィルタで RLS を手動再現
      return { companyId: profile.company_id, userId: uid, rlsClient: null, adminClient: admin }
    }
  }

  return null
}
