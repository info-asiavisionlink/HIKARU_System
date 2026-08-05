'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth.store'
import type { AppUser, UserRole } from '@/types'

// ============================================================
// 認証状態プロバイダー
// app/layout.tsx に配置し、クライアントサイドの認証状態を管理する
// ============================================================

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading, reset } = useAuthStore()
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const supabase = createClient()

    // 初期セッション取得
    const initAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, email, name, role, company_id, phone, avatar_url, last_login_at, created_at')
        .eq('id', user.id)
        .single()

      if (profile) {
        setUser(toAppUser(user.id, user.email!, profile))
      } else {
        setLoading(false)
      }
    }

    initAuth()

    // 認証状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, email, name, role, company_id, phone, avatar_url, last_login_at, created_at')
            .eq('id', session.user.id)
            .single()

          if (profile) {
            setUser(toAppUser(session.user.id, session.user.email!, profile))
          }
        }

        if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
          if (event === 'SIGNED_OUT') {
            reset()
          }
        }

        if (event === 'PASSWORD_RECOVERY') {
          // パスワードリセット後の処理はリセット画面で行う
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [setUser, setLoading, reset])

  return <>{children}</>
}

// Supabase プロフィールデータを AppUser 型に変換
function toAppUser(id: string, email: string, profile: Record<string, unknown>): AppUser {
  return {
    id,
    email,
    name: profile.name as string,
    role: profile.role as UserRole,
    companyId: profile.company_id as string | null,
    phone: profile.phone as string | null,
    avatarUrl: profile.avatar_url as string | null,
    lastLoginAt: profile.last_login_at as string | null,
    createdAt: profile.created_at as string,
  }
}
