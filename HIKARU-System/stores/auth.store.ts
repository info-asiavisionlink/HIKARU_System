import { create } from 'zustand'
import type { AppUser } from '@/types'

// ============================================================
// 認証状態グローバルストア
// ============================================================

interface AuthStore {
  user: AppUser | null
  isLoading: boolean
  isAuthenticated: boolean
  setUser: (user: AppUser | null) => void
  setLoading: (loading: boolean) => void
  reset: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) =>
    set({
      user,
      isAuthenticated: user !== null,
      isLoading: false,
    }),

  setLoading: (isLoading) => set({ isLoading }),

  reset: () =>
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    }),
}))
