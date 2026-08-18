'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from '@/services/auth.service'
import { WorkerHeader } from '@/components/layouts/WorkerHeader'
import { cn } from '@hikaru/ui'
import { Mail, Phone, LogOut, Shield } from 'lucide-react'

const roleLabel: Record<string, string> = {
  admin:  '管理者',
  worker: '作業者',
  client: 'オーナー',
}

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function load() {
      try {
        // Server API経由でプロフィール取得（Browser Supabase auth.getUser() hang回避）
        const res = await fetch('/api/profile', {
          credentials: 'include',
          cache:       'no-store',
        })
        if (!res.ok) {
          router.replace('/login')
          return
        }
        const { profile } = await res.json()
        setProfile(profile)
      } catch {
        router.replace('/login')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  async function handleLogout() {
    await signOut()
    router.replace('/login')
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100dvh_-_var(--header-height))] bg-[var(--color-background)]">
        <WorkerHeader title="プロフィール" />
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100dvh_-_var(--header-height))] bg-[var(--color-background)]">
      <WorkerHeader title="プロフィール" />

      {/* アバター */}
      <div className="bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 py-6 flex flex-col items-center gap-3">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-primary-muted)] text-2xl font-bold text-[var(--color-primary)]">
          {profile?.name?.slice(0, 2) ?? 'HI'}
        </span>
        <div className="text-center">
          <p className="text-lg font-bold text-[var(--color-foreground)]">{profile?.name}</p>
          <span className={cn(
            'inline-block mt-1 rounded-[var(--radius-full)] px-2.5 py-0.5 text-xs font-medium',
            'bg-[var(--color-primary-muted)] text-[var(--color-primary)]'
          )}>
            {roleLabel[profile?.role] ?? profile?.role}
          </span>
        </div>
      </div>

      {/* 情報リスト */}
      <div className="mt-4 bg-[var(--color-surface)] border-y border-[var(--color-border)] divide-y divide-[var(--color-border)]">
        {[
          { icon: Mail,   label: 'メールアドレス', value: profile?.email },
          { icon: Phone,  label: '電話番号',        value: profile?.phone ?? '未登録' },
          { icon: Shield, label: '権限',            value: roleLabel[profile?.role] ?? profile?.role },
        ].map((row) => (
          <div key={row.label} className="flex items-center gap-3 px-4 py-3.5">
            <row.icon className="h-4.5 w-4.5 text-[var(--color-muted-foreground)] shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-[var(--color-muted-foreground)]">{row.label}</p>
              <p className="text-sm text-[var(--color-foreground)] mt-0.5">{row.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ログアウト */}
      <div className="mt-6 px-4">
        <button
          onClick={handleLogout}
          className={cn(
            'w-full flex items-center justify-center gap-2',
            'rounded-[var(--radius-xl)] py-4',
            'bg-[var(--color-error-muted)] text-[var(--color-error-foreground)]',
            'text-base font-semibold',
            'active:bg-[var(--color-error)]/20 transition-colors'
          )}
        >
          <LogOut className="h-5 w-5" />
          ログアウト
        </button>
      </div>
    </div>
  )
}
