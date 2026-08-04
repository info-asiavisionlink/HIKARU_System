'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { Button, Input, Alert, cn } from '@hikaru/ui'
import { loginAction } from '../actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" loading={pending} className="w-full">
      {!pending && <LogIn className="h-4 w-4" />}
      管理者ログイン
    </Button>
  )
}

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, { error: null })
  const [showPassword, setShowPassword] = useState(false)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && (
        <Alert variant="error" title="ログインエラー">
          {state.error}
        </Alert>
      )}

      <Input
        name="email"
        type="email"
        label="メールアドレス"
        placeholder="admin@hikaru.com"
        autoComplete="email"
        required
      />

      <Input
        name="password"
        type={showPassword ? 'text' : 'password'}
        label="パスワード"
        placeholder="••••••••"
        autoComplete="current-password"
        required
        rightIcon={
          <button
            type="button"
            onClick={() => setShowPassword((p) => !p)}
            className={cn(
              'rounded-sm p-0.5 text-[var(--color-muted-foreground)]',
              'transition-colors hover:text-[var(--color-foreground)]',
              'focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]'
            )}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
      />

      <SubmitButton />

      <div className="text-center">
        <Link
          href="/forgot-password"
          className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)] underline underline-offset-4 transition-colors"
        >
          パスワードをお忘れの場合
        </Link>
      </div>
    </form>
  )
}
