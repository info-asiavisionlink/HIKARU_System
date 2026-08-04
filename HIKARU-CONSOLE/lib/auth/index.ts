import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { AppUser, UserRole } from '@/types'

// ============================================================
// HIKARU-CONSOLE サーバーサイド認証ユーティリティ
// ============================================================

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

export async function requireAuth(): Promise<AppUser> {
  const user = await getServerUser()
  if (!user) redirect('/login')
  return user
}

export async function requireAdmin(): Promise<AppUser> {
  const user = await requireAuth()
  if (user.role !== 'admin') redirect('/')
  return user
}

export async function requireRole(allowed: UserRole | UserRole[]): Promise<AppUser> {
  const user = await requireAuth()
  const roles = Array.isArray(allowed) ? allowed : [allowed]
  if (!roles.includes(user.role)) redirect('/')
  return user
}

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

/**
 * 管理者が他のユーザーのロールを変更する（管理者のみ）
 */
export async function updateUserRole(
  targetUserId: string,
  newRole: UserRole
): Promise<{ error: string | null }> {
  const currentUser = await requireAdmin()
  const supabase = await createClient()

  // 同一会社のユーザーのみ変更可能
  const { data: target } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', targetUserId)
    .single()

  if (!target || target.company_id !== currentUser.companyId) {
    return { error: '権限がありません。' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ role: newRole })
    .eq('id', targetUserId)

  return { error: error?.message ?? null }
}
