import type { Metadata } from 'next'
import { LoginForm } from './_components/LoginForm'

export const metadata: Metadata = {
  title: 'ログイン | HIKARU CONSOLE',
}

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center gap-8 w-full">
      {/* Brand */}
      <div className="flex flex-col items-center gap-5 text-center">
        {/* Gold Logo */}
        <div className="relative">
          <div className="absolute inset-0 rounded-[var(--radius-xl)] animate-[pulse-gold_3s_ease-in-out_infinite]" />
          <div
            className="relative flex h-18 w-18 items-center justify-center rounded-[var(--radius-xl)]"
            style={{
              background: 'linear-gradient(135deg, oklch(0.52 0.10 75) 0%, oklch(0.73 0.12 78) 50%, oklch(0.88 0.13 78) 100%)',
              boxShadow: '0 0 30px oklch(0.73 0.12 78 / 0.50), 0 0 80px oklch(0.73 0.12 78 / 0.15)',
              width: 72, height: 72,
            }}
          >
            <span className="text-3xl font-black"
              style={{ color: 'oklch(0.06 0.003 260)', letterSpacing: '-0.02em' }}>
              H
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-black tracking-[0.15em] uppercase"
            style={{
              background: 'linear-gradient(135deg, oklch(0.62 0.11 75), oklch(0.88 0.13 78), oklch(0.73 0.12 78))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
            HIKARU
          </h1>
          <p className="text-[9px] tracking-[0.4em] uppercase"
            style={{ color: 'oklch(0.73 0.12 78 / 0.55)' }}>
            AI Management Console
          </p>
        </div>
      </div>

      {/* Login Card */}
      <div
        className="w-full max-w-sm rounded-[var(--radius-xl)] p-7 relative overflow-hidden"
        style={{
          background: 'oklch(0.09 0.005 255 / 0.88)',
          backdropFilter: 'blur(40px) saturate(1.6)',
          border: '1px solid oklch(0.73 0.12 78 / 0.25)',
          boxShadow: '0 0 50px oklch(0.73 0.12 78 / 0.08), 0 30px 70px oklch(0 0 0 / 0.50)',
        }}
      >
        {/* Gold top glow */}
        <div className="absolute top-0 left-8 right-8 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, oklch(0.73 0.12 78 / 0.60), transparent)' }} />
        {/* Corner brackets */}
        <div className="absolute top-4 left-4 h-4 w-4"
          style={{ borderTop: '1px solid oklch(0.73 0.12 78 / 0.45)', borderLeft: '1px solid oklch(0.73 0.12 78 / 0.45)' }} />
        <div className="absolute top-4 right-4 h-4 w-4"
          style={{ borderTop: '1px solid oklch(0.73 0.12 78 / 0.45)', borderRight: '1px solid oklch(0.73 0.12 78 / 0.45)' }} />
        <div className="absolute bottom-4 left-4 h-4 w-4"
          style={{ borderBottom: '1px solid oklch(0.73 0.12 78 / 0.45)', borderLeft: '1px solid oklch(0.73 0.12 78 / 0.45)' }} />
        <div className="absolute bottom-4 right-4 h-4 w-4"
          style={{ borderBottom: '1px solid oklch(0.73 0.12 78 / 0.45)', borderRight: '1px solid oklch(0.73 0.12 78 / 0.45)' }} />

        <LoginForm />
      </div>

      <p className="text-[9px] text-center uppercase tracking-[0.2em]"
        style={{ color: 'oklch(0.35 0.005 75)' }}>
        管理者専用システム — 作業者は HIKARU System をご利用ください
      </p>
    </div>
  )
}
