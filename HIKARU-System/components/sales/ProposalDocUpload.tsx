'use client'

import * as React from 'react'
import { X, FileText, ImageIcon, Plus } from 'lucide-react'

export type DocType = 'exterior' | 'work_area' | 'brochure' | 'contract'
export interface UploadedDoc {
  doc_type: DocType
  name: string
  url: string
  storage_path: string
  spot_name?: string
}

const DOC_LABELS: Record<DocType, string> = {
  exterior:  '外観写真',
  work_area: '作業箇所写真',
  brochure:  'パンフレット',
  contract:  '契約書',
}

// 画像を Canvas でリサイズ圧縮。失敗したら元ファイルを返す
async function compressImage(file: File, maxPx = 1280, quality = 0.75): Promise<File> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(file), 8000)
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onerror = () => { URL.revokeObjectURL(url); clearTimeout(timer); resolve(file) }
    img.onload = () => {
      URL.revokeObjectURL(url)
      try {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width  = Math.round(img.width  * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(blob => {
          clearTimeout(timer)
          if (!blob) { resolve(file); return }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
        }, 'image/jpeg', quality)
      } catch { clearTimeout(timer); resolve(file) }
    }
    img.src = url
  })
}

// XHR でアップロード → 本物の進捗%を取得
function uploadWithProgress(
  file: File,
  path: string,
  onProgress: (pct: number) => void,
): Promise<{ publicUrl: string; path: string }> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('file', file)
    form.append('path', path)

    const xhr = new XMLHttpRequest()

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)) }
        catch { reject(new Error('レスポンス解析エラー')) }
      } else {
        try {
          const body = JSON.parse(xhr.responseText)
          reject(new Error(body.error ?? `HTTP ${xhr.status}`))
        } catch { reject(new Error(`HTTP ${xhr.status}`)) }
      }
    }
    xhr.onerror   = () => reject(new Error('ネットワークエラー'))
    xhr.ontimeout = () => reject(new Error('タイムアウト'))
    xhr.timeout   = 120_000 // 2分

    xhr.open('POST', '/api/upload')
    xhr.send(form)
  })
}

interface Props {
  value: UploadedDoc[]
  onChange: (docs: UploadedDoc[]) => void
}

export function ProposalDocUpload({ value, onChange }: Props) {
  const [progress, setProgress] = React.useState<{ type: DocType; pct: number; label: string } | null>(null)
  const [areaLabel, setAreaLabel] = React.useState('')
  const refs = {
    exterior:  React.useRef<HTMLInputElement>(null),
    work_area: React.useRef<HTMLInputElement>(null),
    brochure:  React.useRef<HTMLInputElement>(null),
    contract:  React.useRef<HTMLInputElement>(null),
  }

  async function upload(file: File, docType: DocType, spotName?: string) {
    setProgress({ type: docType, pct: 0, label: '準備中...' })

    // 画像なら圧縮
    let uploadFile = file
    if (file.type.startsWith('image/')) {
      setProgress({ type: docType, pct: 5, label: '圧縮中...' })
      uploadFile = await compressImage(file)
    }

    const ext  = uploadFile.name.split('.').pop()?.toLowerCase() ?? 'bin'
    const path = `proposals/${Date.now()}_${docType}.${ext}`

    try {
      const { publicUrl } = await uploadWithProgress(uploadFile, path, (pct) => {
        setProgress({ type: docType, pct: Math.round(10 + pct * 0.9), label: 'アップロード中...' })
      })

      setProgress({ type: docType, pct: 100, label: '完了！' })
      onChange([...value, { doc_type: docType, name: file.name, url: publicUrl, storage_path: path, spot_name: spotName }])
      setTimeout(() => setProgress(null), 600)
    } catch (e: unknown) {
      setProgress(null)
      alert('アップロード失敗: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  function remove(idx: number) { onChange(value.filter((_, i) => i !== idx)) }

  return (
    <div className="space-y-4">
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((d, i) => (
            <div key={i} className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-2">
              {d.doc_type === 'exterior' || d.doc_type === 'work_area'
                ? <ImageIcon className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />
                : <FileText  className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{d.name}</p>
                <p className="text-[10px] text-[var(--color-muted-foreground)]">
                  {DOC_LABELS[d.doc_type]}{d.spot_name ? ` (${d.spot_name})` : ''}
                </p>
              </div>
              <button type="button" onClick={() => remove(i)} className="p-1 hover:opacity-70 shrink-0">
                <X className="h-3.5 w-3.5 text-[var(--color-muted-foreground)]" />
              </button>
            </div>
          ))}
        </div>
      )}

      <UploadBtn label="外観写真を追加"        accept="image/*"                    progress={progress?.type === 'exterior'  ? progress : null} inputRef={refs.exterior}  onSelect={f => upload(f, 'exterior')} />

      <div className="space-y-2">
        <label className="text-xs font-medium text-[var(--color-foreground)]">作業箇所写真（複数可）</label>
        <input value={areaLabel} onChange={e => setAreaLabel(e.target.value)}
          placeholder="箇所名（例：浴室、トイレ）"
          className="w-full h-9 rounded-[var(--radius)] px-3 text-xs border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-[var(--color-foreground)] outline-none focus:ring-1 focus:ring-[var(--color-primary)]" />
        <UploadBtn label={`作業箇所写真を追加${areaLabel ? ` (${areaLabel})` : ''}`} accept="image/*" progress={progress?.type === 'work_area' ? progress : null} inputRef={refs.work_area} onSelect={f => upload(f, 'work_area', areaLabel || undefined)} small />
      </div>

      <UploadBtn label="パンフレット (PDF/画像)" accept="application/pdf,image/*"   progress={progress?.type === 'brochure'  ? progress : null} inputRef={refs.brochure}  onSelect={f => upload(f, 'brochure')} />
      <UploadBtn label="契約書 (PDF)"            accept="application/pdf"           progress={progress?.type === 'contract'  ? progress : null} inputRef={refs.contract}  onSelect={f => upload(f, 'contract')} />
    </div>
  )
}

function UploadBtn({ label, accept, progress, inputRef, onSelect, small }: {
  label: string
  accept: string
  progress: { pct: number; label: string } | null
  inputRef: React.RefObject<HTMLInputElement>
  onSelect: (f: File) => void
  small?: boolean
}) {
  const loading = progress !== null
  const GOLD = 'oklch(0.73 0.12 78)'

  return (
    <div>
      <input ref={inputRef} type="file" accept={accept} className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onSelect(f); e.target.value = '' }} />
      <button type="button" onClick={() => !loading && inputRef.current?.click()} disabled={loading}
        className={`w-full rounded-[var(--radius-lg)] border-dashed transition-all disabled:opacity-60 overflow-hidden relative ${small ? 'py-2' : 'py-3'}`}
        style={{ border: '1.5px dashed var(--color-border)', color: 'var(--color-muted-foreground)' }}
      >
        {/* 本物の進捗バー */}
        {loading && (
          <div className="absolute inset-0 transition-all duration-150"
            style={{ width: `${progress!.pct}%`, background: `${GOLD}18`, borderRight: `1px solid ${GOLD}40` }} />
        )}
        <span className="relative flex items-center justify-center gap-2 text-xs">
          {loading ? (
            <>
              <span style={{ color: GOLD }}>{progress!.label}</span>
              <span className="font-bold tabular-nums" style={{ color: GOLD }}>{progress!.pct}%</span>
            </>
          ) : (
            <><Plus className="h-4 w-4" />{label}</>
          )}
        </span>
      </button>
    </div>
  )
}
