import { createClient } from '@/lib/supabase/client'
import type { AppUser, UserRole } from '@/types'

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
}

export async function sendPasswordResetEmail(email: string) {
  const supabase = createClient()
  const redirectTo = `${process.env.NEXT_PUBLIC_CONSOLE_URL ?? window.location.origin}/reset-password`
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  return { error: error?.message ?? null }
}

export async function updatePassword(newPassword: string) {
  const supabase = createClient()
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  return { error: error?.message ?? null }
}

export async function getCurrentProfile(): Promise<AppUser | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

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
