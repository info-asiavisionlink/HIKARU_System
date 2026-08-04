'use client'

import * as React from 'react'

export default function MigrationPage() {
  const [status, setStatus] = React.useState<'idle' | 'running' | 'success' | 'error'>('idle')
  const [message, setMessage] = React.useState('')

  async function runMigration() {
    setStatus('running')
    setMessage('')
    try {
      const res = await fetch('/api/migration/apply', {
        method: 'POST',
        credentials: 'include',
      })
      const json = await res.json()
      if (res.ok) {
        setStatus('success')
        setMessage(json.message ?? '成功')
      } else {
        setStatus('error')
        setMessage(json.error + (json.hint ? '\n\n' + json.hint : '') + (json.detail ? '\n\n詳細: ' + json.detail : ''))
      }
    } catch (e) {
      setStatus('error')
      setMessage('通信エラーが発生しました')
    }
  }

  return (
    <div className="p-8 max-w-xl mx-auto space-y-6">
      <div style={{ color: 'oklch(0.82 0.13 78)', fontSize: 22, fontWeight: 'bold' }}>
        マイグレーション実行
      </div>
      <p style={{ color: 'oklch(0.55 0.007 75)', fontSize: 14 }}>
        従業員・協力業者テーブルの作成とテストデータの投入を行います。<br />
        事前に <code style={{ background: 'oklch(0.12 0.005 260)', padding: '2px 6px', borderRadius: 4 }}>SUPABASE_ACCESS_TOKEN</code> を <code>.env.local</code> に設定してください。
      </p>

      <div style={{
        background: 'oklch(0.09 0.005 255)',
        border: '1px solid oklch(0.73 0.12 78 / 0.25)',
        borderRadius: 12,
        padding: 16,
        fontSize: 13,
        color: 'oklch(0.65 0.008 75)',
        lineHeight: 1.8,
      }}>
        <strong style={{ color: 'oklch(0.73 0.12 78)' }}>事前準備:</strong><br />
        1. <a
          href="https://supabase.com/dashboard/account/tokens"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'oklch(0.73 0.12 78)' }}
        >
          https://supabase.com/dashboard/account/tokens
        </a> でアクセストークンを発行<br />
        2. <code>HIKARU-CONSOLE/.env.local</code> に追記:<br />
        <code style={{ background: 'oklch(0.12 0.005 260)', display: 'block', padding: '6px 10px', borderRadius: 6, marginTop: 4 }}>
          SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxx
        </code>
        3. <strong>開発サーバーを再起動</strong>してから「実行」を押す
      </div>

      <button
        onClick={runMigration}
        disabled={status === 'running'}
        style={{
          width: '100%',
          padding: '12px 0',
          borderRadius: 10,
          fontWeight: 'bold',
          fontSize: 15,
          cursor: status === 'running' ? 'not-allowed' : 'pointer',
          background: status === 'running'
            ? 'oklch(0.25 0.005 260)'
            : 'linear-gradient(135deg, oklch(0.52 0.10 75), oklch(0.73 0.12 78))',
          color: status === 'running' ? 'oklch(0.50 0.007 75)' : 'oklch(0.06 0.003 260)',
          border: 'none',
          boxShadow: status === 'running' ? 'none' : '0 0 20px oklch(0.73 0.12 78 / 0.4)',
        }}
      >
        {status === 'running' ? '実行中...' : 'マイグレーションを実行'}
      </button>

      {status === 'success' && (
        <div style={{
          background: 'oklch(0.72 0.18 150 / 0.10)',
          border: '1px solid oklch(0.72 0.18 150 / 0.40)',
          borderRadius: 10,
          padding: 16,
          color: 'oklch(0.72 0.18 150)',
          fontSize: 14,
        }}>
          ✅ {message}
        </div>
      )}

      {status === 'error' && (
        <div style={{
          background: 'oklch(0.65 0.18 30 / 0.10)',
          border: '1px solid oklch(0.65 0.18 30 / 0.40)',
          borderRadius: 10,
          padding: 16,
          color: 'oklch(0.75 0.18 30)',
          fontSize: 13,
          whiteSpace: 'pre-wrap',
        }}>
          ❌ {message}
        </div>
      )}
    </div>
  )
}
