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
  const scrollRef = React.useRef<HTMLDivElement>(null)

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

  // ローディング完了後にスクロールを先頭にリセット（Chromeのscroll anchoring対策）
  React.useEffect(() => {
    if (!loading && scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [loading])

  async function handleLogout() {
    await signOut()
    router.replace('/login')
  }

  return (
    <div className="bg-[var(--color-background)]" style={{ height: 'calc(100dvh - var(--header-height))' }}>
      <WorkerHeader title="プロフィール" />

      <div
        ref={scrollRef}
        className="overflow-y-auto"
        style={{
          height: 'calc(100dvh - calc(var(--header-height) * 2))',
          overflowAnchor: 'none',
        }}
      >
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col" style={{ minHeight: '100%' }}>
            {/* アバター */}
            <div className="px-4 pt-10 pb-6 flex flex-col items-center gap-3">
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-primary-muted)] text-2xl font-bold text-[var(--color-primary)]"
                style={{ boxShadow: '0 0 24px oklch(0.73 0.12 78 / 0.20)' }}>
                {profile?.name?.slice(0, 2) ?? 'HI'}
              </span>
              <div className="text-center">
                <p className="text-lg font-bold text-[var(--color-foreground)]">{profile?.name}</p>
                <span className={cn(
                  'inline-block mt-1 rounded-[var(--radius-full)] px-3 py-0.5 text-xs font-semibold',
                  'bg-[var(--color-primary-muted)] text-[var(--color-primary)]'
                )}>
                  {roleLabel[profile?.role] ?? profile?.role}
                </span>
              </div>
            </div>

            {/* 情報リスト */}
            <div className="mx-4 rounded-[var(--radius-xl)] overflow-hidden border border-[var(--color-border)] divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
              {[
                { icon: Mail,   label: 'メールアドレス', value: profile?.email },
                { icon: Phone,  label: '電話番号',        value: profile?.phone ?? '未登録' },
                { icon: Shield, label: '権限',            value: roleLabel[profile?.role] ?? profile?.role },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3 px-4 py-4">
                  <row.icon className="h-4 w-4 text-[var(--color-muted-foreground)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-medium text-[var(--color-subtle)] uppercase tracking-wide">{row.label}</p>
                    <p className="text-sm text-[var(--color-foreground)] mt-0.5 truncate">{row.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* スペーサー: ログアウトを下に押し下げる */}
            <div className="flex-1" />

            {/* ログアウト */}
            <div className="px-4 pb-8 pt-4">
              <button
                onClick={handleLogout}
                className={cn(
                  'w-full flex items-center justify-center gap-2',
                  'rounded-[var(--radius-xl)] py-3.5',
                  'bg-[var(--color-error-muted)] text-[var(--color-error-foreground)]',
                  'text-sm font-semibold',
                  'active:bg-[var(--color-error)]/20 transition-colors'
                )}
              >
                <LogOut className="h-4 w-4" />
                ログアウト
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
