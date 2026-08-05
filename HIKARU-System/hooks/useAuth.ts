'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { signOut } from '@/services/auth.service'

// ============================================================
// 認証フック
// クライアントコンポーネントで認証状態を利用する
// ============================================================

export function useAuth() {
  const { user, isLoading, isAuthenticated } = useAuthStore()
  const router = useRouter()

  const logout = useCallback(async () => {
    await signOut()
    router.push('/login')
  }, [router])

  return {
    user,
    isLoading,
    isAuthenticated,
    logout,
    isWorker: user?.role === 'worker',
    isClient: user?.role === 'client',
  }
}

/**
 * 現在のユーザーを取得する（認証チェックなし）
 */
export function useCurrentUser() {
  return useAuthStore((s) => s.user)
}
