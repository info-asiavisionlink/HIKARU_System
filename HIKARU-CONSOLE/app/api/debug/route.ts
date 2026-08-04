/**
 * 診断用エンドポイント（一時的）
 * GET /api/debug
 * 実際のデータフローを証明するための診断情報を返す
 */
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function GET() {
  const result: Record<string, unknown> = {}

  // ① Cookie 確認
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  result.cookies = {
    names: allCookies.map((c) => c.name),
    hk_c_role: cookieStore.get('hk_c_role')?.value ?? null,
    hk_c_uid:  cookieStore.get('hk_c_uid')?.value ?? null,
    supabase_cookie_exists: allCookies.some((c) => c.name.startsWith('sb-')),
    supabase_cookie_names: allCookies.filter((c) => c.name.startsWith('sb-')).map((c) => c.name),
  }

  // ② createServerClient でセッション確認（RLS有効）
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  result.auth = {
    user_id:    user?.id ?? null,
    user_email: user?.email ?? null,
    user_role:  user?.role ?? null,
    error:      userError?.message ?? null,
    is_authenticated: !!user,
  }

  // ③ プロフィール確認（認証済みの場合）
  if (user) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, role, company_id')
      .eq('id', user.id)
      .single()

    result.profile = {
      data:    profile,
      error:   profileError?.message ?? null,
      company_id: profile?.company_id ?? null,
    }

    // ④ clients 取得テスト（RLS有効）
    const { data: clients, count: clientCount, error: clientError } = await supabase
      .from('clients')
      .select('id, name, company_id', { count: 'exact' })
      .limit(5)

    result.clients_with_rls = {
      count:  clientCount,
      data:   clients?.map((c) => ({ id: c.id, name: c.name, company_id: c.company_id })),
      error:  clientError?.message ?? null,
    }

    // ⑤ projects 取得テスト（RLS有効）
    const { data: projects, count: projectCount, error: projectError } = await supabase
      .from('projects')
      .select('id, name, status, company_id', { count: 'exact' })
      .limit(5)

    result.projects_with_rls = {
      count:  projectCount,
      data:   projects?.map((p) => ({ id: p.id, name: p.name, status: p.status, company_id: p.company_id })),
      error:  projectError?.message ?? null,
    }
  }

  // ⑥ service_role（RLS完全バイパス）でのクロスチェック
  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { count: clientTotal } = await admin
    .from('clients')
    .select('*', { count: 'exact', head: true })

  const { count: projectTotal } = await admin
    .from('projects')
    .select('*', { count: 'exact', head: true })

  result.service_role_counts = {
    clients_total:  clientTotal,
    projects_total: projectTotal,
  }

  // ⑦ 診断サマリー
  const authOk     = !!user
  const profileOk  = !!(result.profile as any)?.data
  const companyId  = (result.profile as any)?.company_id
  const clientsOk  = ((result.clients_with_rls as any)?.count ?? 0) > 0
  const projectsOk = ((result.projects_with_rls as any)?.count ?? 0) > 0

  result.diagnosis = {
    step1_cookie:          result.cookies,
    step2_auth:            authOk ? '✅ 認証OK' : '❌ 未認証（セッションCookieが読めていない）',
    step3_profile:         profileOk ? `✅ プロフィールOK (company_id: ${companyId})` : '❌ プロフィール取得失敗',
    step4_clients_rls:     clientsOk ? `✅ clients ${(result.clients_with_rls as any)?.count}件取得OK` : `❌ clients 0件（RLSブロック or データなし）`,
    step5_projects_rls:    projectsOk ? `✅ projects ${(result.projects_with_rls as any)?.count}件取得OK` : `❌ projects 0件（RLSブロック or データなし）`,
    step6_service_total:   `DB合計: clients=${clientTotal}件 / projects=${projectTotal}件`,
    bottleneck: !authOk
      ? '🔴 ボトルネック: セッションCookieが createServerClient で読めていない → 再ログイン必須'
      : !profileOk
      ? '🔴 ボトルネック: プロフィール取得失敗'
      : !clientsOk
      ? `🔴 ボトルネック: RLSがブロック（ユーザーcompany_id=${companyId}）`
      : '🟢 サーバーサイドは正常。Reactレンダリングを確認'
  }

  return NextResponse.json(result, {
    headers: { 'Content-Type': 'application/json' },
  })
}
