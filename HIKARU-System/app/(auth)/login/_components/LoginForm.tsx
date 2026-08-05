'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { Button, Input, Alert, cn } from '@hikaru/ui'
import { loginAction } from '../actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" loading={pending} className="w-full">
      {!pending && <LogIn className="h-4 w-4" />}
      ログイン
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
        name="loginId"
        type="text"
        label="社員番号"
        placeholder="EMP-0001"
        autoComplete="username"
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
              'rounded-sm p-0.5',
              'text-[var(--color-muted-foreground)] transition-colors',
              'hover:text-[var(--color-foreground)]',
              'focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]'
            )}
            aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
          >
            {showPassword
              ? <EyeOff className="h-4 w-4" />
              : <Eye className="h-4 w-4" />
            }
          </button>
        }
      />

      <SubmitButton />

      <p className="text-center text-xs text-[var(--color-muted-foreground)]">
        パスワードをお忘れの場合は管理者へご連絡ください。
      </p>
    </form>
  )
}
