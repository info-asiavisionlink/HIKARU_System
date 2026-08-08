'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/server'

interface LoginState {
  error: string | null
}

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const loginId  = (formData.get('loginId')  as string)?.trim().toUpperCase()
  const password = formData.get('password')  as string

  if (!loginId || !password) {
    return { error: '社員番号とパスワードを入力してください。' }
  }

  // 社員番号を内部メールに変換: EMP-0001 → emp-0001@hikaru.internal
  const email = `${loginId.toLowerCase()}@hikaru.internal`

  const cookieStore = await cookies()

  // @supabase/ssr に Cookie 管理を委譲する正規クライアント
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  )

  // ① 標準サインイン（セッションCookieを正しい形式で自動設定）
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (authError || !authData.session) {
    return { error: translateAuthError(authError?.message ?? '') }
  }

  // ② ロール確認
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role, entity_type')
    .eq('id', authData.user.id)
    .single()

  if (!profile) {
    await supabase.auth.signOut()
    return { error: 'アカウントの権限が設定されていません。管理者へお問い合わせください。' }
  }

  // 純粋な管理者（従業員でないadmin）はSystemにログイン不可
  if (profile.role === 'admin' && profile.entity_type !== 'employee') {
    await supabase.auth.signOut()
    return { error: '管理者アカウントです。HIKARU CONSOLE をご利用ください。' }
  }

  // 従業員がadmin権限を持つ場合はSystemにもログイン可
  if (profile.role !== 'worker' && profile.role !== 'admin' && profile.role !== 'client') {
    await supabase.auth.signOut()
    return { error: 'アカウントの権限が設定されていません。管理者へお問い合わせください。' }
  }

  // ③ ミドルウェア用カスタム Cookie
  const isProduction = process.env.NODE_ENV === 'production'
  const maxAge = authData.session.expires_in ?? 3600
  const opts = { httpOnly: true, secure: isProduction, path: '/', maxAge, sameSite: 'lax' } as const

  // コンソールアクセス付き従業員も System では 'worker' として扱う
  const effectiveRole = profile.role === 'admin' ? 'worker' : profile.role
  cookieStore.set('hk_s_role', effectiveRole,    opts)
  cookieStore.set('hk_s_uid',  authData.user.id, opts)

  if (effectiveRole === 'worker') redirect('/home')
  if (effectiveRole === 'client') redirect('/client')

  return { error: 'アカウントの権限が設定されていません。管理者へお問い合わせください。' }
}

export async function forgotPasswordAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = (formData.get('email') as string)?.trim()
  if (!email) return { error: 'メールアドレスを入力してください。' }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  )

  const { error } = await supabase.auth.resetPasswordForEmail(email)
  if (error) return { error: 'メール送信に失敗しました。' }
  return { error: null }
}

export async function resetPasswordAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const password        = formData.get('password')        as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!password || password.length < 8) return { error: 'パスワードは8文字以上で入力してください。' }
  if (password !== confirmPassword)      return { error: 'パスワードが一致しません。' }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  )

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: 'パスワードの変更に失敗しました。' }
  redirect('/home')
}

export async function logoutAction() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  )

  await supabase.auth.signOut()
  cookieStore.delete('hk_s_role')
  cookieStore.delete('hk_s_uid')
  cookieStore.delete('hk_s_at')
  cookieStore.delete('hk_s_rt')
  redirect('/login')
}

function translateAuthError(message: string): string {
  if (message.includes('Invalid login credentials') || message.includes('invalid_credentials'))
    return '社員番号またはパスワードが正しくありません。'
  if (message.includes('Too many requests'))
    return 'ログイン試行回数が上限に達しました。しばらく待ってから再試行してください。'
  return 'エラーが発生しました。しばらく時間をおいて再試行してください。'
}
