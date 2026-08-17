'use client'

import * as React from 'react'
import { Camera, RotateCcw, Check, X } from 'lucide-react'
import { cn } from '@hikaru/ui'

interface PhotoCaptureProps {
  currentUrl?: string | null
  onCapture: (file: File) => Promise<void>
  onDelete?: () => void
  loading?: boolean
  label?: string
  required?: boolean
}

export function PhotoCapture({
  currentUrl,
  onCapture,
  onDelete,
  loading = false,
  label,
  required = false,
}: PhotoCaptureProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [preview, setPreview] = React.useState<string | null>(currentUrl ?? null)
  const [capturing, setCapturing] = React.useState(false)

  React.useEffect(() => {
    setPreview(currentUrl ?? null)
  }, [currentUrl])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Show local preview immediately
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    setCapturing(true)
    await onCapture(file)
    setCapturing(false)

    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  function handleRetake() {
    setPreview(null)
    onDelete?.()
    setTimeout(() => inputRef.current?.click(), 50)
  }

  const hasPhoto = !!preview
  const isLoading = loading || capturing

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <span className="text-sm font-medium text-[var(--color-foreground)]">
          {label}
          {required && <span className="ml-1 text-[var(--color-error)]">*</span>}
        </span>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        aria-label={`${label ?? '写真'}を撮影`}
      />

      {hasPhoto ? (
        <div className="relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-black aspect-[4/3]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview!}
            alt="撮影済み写真"
            className="w-full h-full object-cover"
          />
          {/* Overlay actions */}
          <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors" />
          <div className="absolute bottom-3 right-3 flex gap-2">
            <button
              type="button"
              onClick={handleRetake}
              disabled={isLoading}
              className={cn(
                'flex items-center gap-1.5 rounded-[var(--radius-full)]',
                'bg-black/60 backdrop-blur-sm text-white',
                'px-3 py-2 text-sm font-medium',
                'active:scale-95 transition-transform',
                'disabled:opacity-50'
              )}
            >
              <RotateCcw className="h-4 w-4" />
              撮り直す
            </button>
          </div>
          {/* Upload progress indicator */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <div className="h-8 w-8 rounded-full border-2 border-white border-t-transparent animate-spin" />
            </div>
          )}
          {/* Done check */}
          {!isLoading && (
            <div className="absolute top-3 right-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-success)] shadow">
                <Check className="h-4 w-4 text-white" />
              </span>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isLoading}
          className={cn(
            'flex flex-col items-center justify-center gap-3',
            'w-full aspect-video rounded-[var(--radius-xl)]',
            'border-2 border-dashed',
            'transition-all duration-150',
            'active:scale-[0.98]',
            'disabled:opacity-50',
            required
              ? 'border-[var(--color-primary)]/40 bg-[var(--color-primary-muted)]'
              : 'border-[var(--color-border)] bg-[var(--color-muted)]'
          )}
        >
          <span className={cn(
            'flex h-14 w-14 items-center justify-center rounded-full',
            required ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-border)] text-[var(--color-muted-foreground)]'
          )}>
            <Camera className="h-7 w-7" />
          </span>
          <span className={cn(
            'text-sm font-medium',
            required ? 'text-[var(--color-primary)]' : 'text-[var(--color-muted-foreground)]'
          )}>
            タップして撮影
          </span>
        </button>
      )}
    </div>
  )
}
