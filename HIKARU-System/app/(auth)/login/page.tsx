import type { Metadata } from 'next'
import { LoginForm } from './_components/LoginForm'

export const metadata: Metadata = {
  title: 'ログイン | HIKARU System',
}

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* Brand */}
      <div className="flex flex-col items-center gap-2 text-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-xl)]"
          style={{ background: 'var(--color-primary)' }}
        >
          <span className="text-xl font-bold text-white">H</span>
        </div>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)] tracking-tight">
          HIKARU System
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          清掃作業者向けシステムへようこそ
        </p>
      </div>

      {/* Login Card */}
      <div
        className="w-full max-w-sm rounded-[var(--radius-xl)] border border-[var(--color-border)]
                   bg-[var(--color-surface)] p-7 shadow-[var(--shadow-md)]"
      >
        <LoginForm />
      </div>

      <p className="text-xs text-[var(--color-subtle)] text-center max-w-xs">
        このシステムは作業者専用です。<br />
        管理者の方は HIKARU CONSOLE をご利用ください。
      </p>
    </div>
  )
}
