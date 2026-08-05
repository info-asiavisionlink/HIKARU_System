import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { AppUser, UserRole } from '@/types'

// ============================================================
// サーバーサイド認証ユーティリティ
// Server Components / API Routes から使用する
// ============================================================

/**
 * 現在のサーバーサイドユーザーを取得する
 * 認証されていない場合は null を返す
 */
export async function getServerUser(): Promise<AppUser | null> {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, name, role, company_id, phone, avatar_url, last_login_at, created_at')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role as UserRole,
    companyId: profile.company_id,
    phone: profile.phone,
    avatarUrl: profile.avatar_url,
    lastLoginAt: profile.last_login_at,
    createdAt: profile.created_at,
  }
}

/**
 * 認証必須。未認証なら /login へリダイレクト
 */
export async function requireAuth(): Promise<AppUser> {
  const user = await getServerUser()
  if (!user) {
    redirect('/login')
  }
  return user
}

/**
 * 指定ロール必須。ロール不一致なら /login へリダイレクト
 * 将来的に roles 配列でもロール指定できるようにしている
 */
export async function requireRole(allowed: UserRole | UserRole[]): Promise<AppUser> {
  const user = await requireAuth()
  const allowedRoles = Array.isArray(allowed) ? allowed : [allowed]

  if (!allowedRoles.includes(user.role)) {
    redirect('/')
  }

  return user
}

/**
 * HIKARU-System 用: worker ロール必須
 */
export async function requireWorker(): Promise<AppUser> {
  return requireRole('worker')
}

/**
 * HIKARU-System 用: client ロール必須
 */
export async function requireClient(): Promise<AppUser> {
  return requireRole('client')
}

/**
 * ユーザーのプロフィールを更新する（サーバーサイド）
 */
export async function updateProfile(
  userId: string,
  data: { name?: string; phone?: string; avatarUrl?: string }
): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('profiles')
    .update({
      ...(data.name && { name: data.name }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.avatarUrl !== undefined && { avatar_url: data.avatarUrl }),
    })
    .eq('id', userId)

  return { error: error?.message ?? null }
}
