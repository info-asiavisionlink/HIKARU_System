'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { ArrowLeft, Mail } from 'lucide-react'
import type { Metadata } from 'next'
import { Button, Input, Alert } from '@hikaru/ui'
import { forgotPasswordAction } from '../login/actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" loading={pending} className="w-full">
      {!pending && <Mail className="h-4 w-4" />}
      リセットメールを送信
    </Button>
  )
}

export default function ForgotPasswordPage() {
  const [state, formAction] = useActionState(forgotPasswordAction, { error: null })
  const sent = state.error === null && state !== null

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
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">
          パスワードのリセット
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          登録済みのメールアドレスへリセットリンクを送信します
        </p>
      </div>

      <div
        className="w-full max-w-sm rounded-[var(--radius-xl)] border border-[var(--color-border)]
                   bg-[var(--color-surface)] p-7 shadow-[var(--shadow-md)]"
      >
        {/* 送信完了メッセージ */}
        {sent ? (
          <div className="flex flex-col gap-4 text-center">
            <Alert variant="success" title="メールを送信しました">
              入力したメールアドレスにリセットリンクを送信しました。
              メールをご確認ください。
            </Alert>
            <Link href="/login">
              <Button variant="outline" className="w-full">
                ログインに戻る
              </Button>
            </Link>
          </div>
        ) : (
          <form action={formAction} className="flex flex-col gap-4">
            {state.error && (
              <Alert variant="error">{state.error}</Alert>
            )}

            <Input
              name="email"
              type="email"
              label="メールアドレス"
              placeholder="your@email.com"
              autoComplete="email"
              required
            />

            <SubmitButton />
          </form>
        )}
      </div>

      <Link
        href="/login"
        className="flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)]
                   transition-colors hover:text-[var(--color-foreground)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        ログインに戻る
      </Link>
    </div>
  )
}
