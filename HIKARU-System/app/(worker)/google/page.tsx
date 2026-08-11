'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import {
  CheckCircle2, XCircle, RefreshCw, Link2, Link2Off,
  CalendarDays, AlertCircle, Loader2,
} from 'lucide-react'

const GOLD = 'oklch(0.73 0.12 78)'

type Status = {
  connected: boolean
  google_email: string | null
  last_synced: string | null
}

function GooglePageInner() {
  const params = useSearchParams()
  const [status, setStatus]   = React.useState<Status | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [syncing, setSyncing] = React.useState(false)
  const [syncResult, setSyncResult] = React.useState<{ synced: number } | null>(null)
  const [disconnecting, setDisconnecting] = React.useState(false)

  const justConnected = params.get('connected') === '1'
  const error         = params.get('error')

  React.useEffect(() => {
    fetchStatus()
  }, [])

  async function fetchStatus() {
    setLoading(true)
    const res  = await fetch('/api/calendar/sync')
    const json = await res.json()
    setStatus(json)
    setLoading(false)
  }

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    const res  = await fetch('/api/calendar/sync', { method: 'POST' })
    const json = await res.json()
    if (json.success) {
      setSyncResult({ synced: json.synced })
      fetchStatus()
    }
    setSyncing(false)
  }

  async function handleDisconnect() {
    if (!confirm('Google連携を解除しますか？')) return
    setDisconnecting(true)
    await fetch('/api/calendar/sync', { method: 'DELETE' })
    setStatus({ connected: false, google_email: null, last_synced: null })
    setSyncResult(null)
    setDisconnecting(false)
  }

  return (
    <div className="max-w-lg mx-auto py-4 px-4 space-y-6">

      {/* ページヘッダー */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'oklch(0.92 0.008 75)' }}>Google連携</h1>
        <p className="text-xs mt-1" style={{ color: 'oklch(0.50 0.007 75)' }}>
          Googleカレンダーと連携して、案件スケジュールを自動同期します
        </p>
      </div>

      {/* 成功/エラーバナー */}
      {justConnected && (
        <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'oklch(0.72 0.18 150 / 0.12)', border: '1px solid oklch(0.72 0.18 150 / 0.3)', color: 'oklch(0.72 0.18 150)' }}>
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Googleアカウントの連携が完了しました！
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'oklch(0.65 0.22 25 / 0.12)', border: '1px solid oklch(0.65 0.22 25 / 0.3)', color: 'oklch(0.65 0.22 25)' }}>
          <AlertCircle className="h-4 w-4 shrink-0" />
          連携に失敗しました。もう一度お試しください。
        </div>
      )}

      {/* 接続状態カード */}
      <div className="rounded-2xl p-5 space-y-4"
        style={{ background: 'oklch(0.09 0.005 255 / 0.85)', border: `1px solid ${GOLD}20` }}>

        {loading ? (
          <div className="flex items-center gap-2" style={{ color: 'oklch(0.50 0.007 75)' }}>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">接続状態を確認中...</span>
          </div>
        ) : status?.connected ? (
          <>
            {/* 接続済み */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full shrink-0"
                style={{ background: 'oklch(0.72 0.18 150 / 0.15)', border: '1px solid oklch(0.72 0.18 150 / 0.3)' }}>
                <CheckCircle2 className="h-5 w-5" style={{ color: 'oklch(0.72 0.18 150)' }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'oklch(0.88 0.008 75)' }}>連携中</p>
                {status.google_email && (
                  <p className="text-xs mt-0.5" style={{ color: 'oklch(0.55 0.007 75)' }}>{status.google_email}</p>
                )}
              </div>
            </div>

            {status.last_synced && (
              <p className="text-xs flex items-center gap-1.5" style={{ color: 'oklch(0.45 0.006 75)' }}>
                <CalendarDays className="h-3.5 w-3.5" />
                最終同期: {new Date(status.last_synced).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}

            {/* 同期結果 */}
            {syncResult && (
              <div className="rounded-xl px-4 py-3 text-sm"
                style={{ background: 'oklch(0.72 0.18 150 / 0.10)', border: '1px solid oklch(0.72 0.18 150 / 0.25)', color: 'oklch(0.72 0.18 150)' }}>
                ✓ {syncResult.synced}件の案件をGoogleカレンダーに同期しました
              </div>
            )}

            {/* アクションボタン */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                style={{ background: GOLD, color: 'oklch(0.06 0.003 260)' }}
              >
                {syncing
                  ? <><Loader2 className="h-4 w-4 animate-spin" />同期中...</>
                  : <><RefreshCw className="h-4 w-4" />今すぐ同期</>
                }
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                style={{ background: 'oklch(0.12 0.007 255 / 0.70)', color: 'oklch(0.55 0.007 75)', border: `1px solid ${GOLD}18` }}
              >
                <Link2Off className="h-4 w-4" />
                連携解除
              </button>
            </div>
          </>
        ) : (
          <>
            {/* 未接続 */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full shrink-0"
                style={{ background: 'oklch(0.65 0.22 25 / 0.10)', border: '1px solid oklch(0.65 0.22 25 / 0.25)' }}>
                <XCircle className="h-5 w-5" style={{ color: 'oklch(0.65 0.22 25)' }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'oklch(0.88 0.008 75)' }}>未連携</p>
                <p className="text-xs mt-0.5" style={{ color: 'oklch(0.55 0.007 75)' }}>
                  Googleアカウントと連携していません
                </p>
              </div>
            </div>

            <a
              href="/api/auth/google"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold transition-all"
              style={{ background: GOLD, color: 'oklch(0.06 0.003 260)' }}
            >
              <Link2 className="h-4 w-4" />
              Googleアカウントと連携する
            </a>
          </>
        )}
      </div>

      {/* 機能説明 */}
      <div className="rounded-2xl p-4 space-y-3"
        style={{ background: 'oklch(0.07 0.004 255 / 0.60)', border: `1px solid ${GOLD}12` }}>
        <p className="text-xs font-semibold" style={{ color: `${GOLD}` }}>連携でできること</p>
        <ul className="space-y-2">
          {[
            '担当案件が自動的にGoogleカレンダーに追加されます',
            'スマートフォンのカレンダーアプリでも確認できます',
            '作業日1時間前にGoogleからリマインダーが届きます',
            '「今すぐ同期」で最新の案件情報を反映できます',
          ].map((text) => (
            <li key={text} className="flex items-start gap-2 text-xs" style={{ color: 'oklch(0.55 0.007 75)' }}>
              <span className="mt-0.5 shrink-0" style={{ color: GOLD }}>•</span>
              {text}
            </li>
          ))}
        </ul>
      </div>

      {/* 設定手順 */}
      {!status?.connected && !loading && (
        <div className="rounded-2xl p-4 space-y-3"
          style={{ background: 'oklch(0.07 0.004 255 / 0.60)', border: `1px solid ${GOLD}12` }}>
          <p className="text-xs font-semibold" style={{ color: `${GOLD}` }}>連携の手順</p>
          <ol className="space-y-2">
            {[
              '「Googleアカウントと連携する」ボタンをタップ',
              'Googleアカウントでログイン',
              'カレンダーへのアクセスを許可',
              '「今すぐ同期」で案件をカレンダーに追加',
            ].map((text, i) => (
              <li key={i} className="flex items-start gap-2 text-xs" style={{ color: 'oklch(0.55 0.007 75)' }}>
                <span className="font-bold shrink-0" style={{ color: GOLD }}>{i + 1}.</span>
                {text}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

export default function GooglePage() {
  return (
    <React.Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'oklch(0.73 0.12 78)' }} />
      </div>
    }>
      <GooglePageInner />
    </React.Suspense>
  )
}
