'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { signOut } from '@/services/auth.service'

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
    isAdmin: user?.role === 'admin',
  }
}

export function useCurrentUser() {
  return useAuthStore((s) => s.user)
}
