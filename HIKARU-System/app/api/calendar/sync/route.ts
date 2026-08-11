import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

function getAdmin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  ) as any
}

// アクセストークンをリフレッシュ
async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type:    'refresh_token',
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.access_token ?? null
}

// 有効なアクセストークンを取得（期限切れなら自動リフレッシュ）
async function getValidToken(tokenRow: any, adminClient: any, userId: string): Promise<string | null> {
  const isExpired = tokenRow.expiry_date && tokenRow.expiry_date < Date.now() + 60_000

  if (!isExpired) return tokenRow.access_token

  if (!tokenRow.refresh_token) return null

  const newToken = await refreshAccessToken(tokenRow.refresh_token)
  if (!newToken) return null

  // 新トークンをDBに保存
  await adminClient
    .from('google_tokens')
    .update({ access_token: newToken, expiry_date: Date.now() + 3600 * 1000, updated_at: new Date().toISOString() })
    .eq('user_id', userId)

  return newToken
}

// ─── GET: 接続状態を返す ────────────────────────────────────────
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = getAdmin()
  const { data: tokenRow } = await admin
    .from('google_tokens')
    .select('google_email, expiry_date, updated_at')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({
    connected: !!tokenRow,
    google_email: tokenRow?.google_email ?? null,
    last_synced: tokenRow?.updated_at ?? null,
  })
}

// ─── POST: 案件をGoogleカレンダーに同期 ────────────────────────
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = getAdmin()

  // トークン取得
  const { data: tokenRow } = await admin
    .from('google_tokens')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!tokenRow) return NextResponse.json({ error: 'not_connected' }, { status: 400 })

  const accessToken = await getValidToken(tokenRow, admin, user.id)
  if (!accessToken) return NextResponse.json({ error: 'token_invalid' }, { status: 400 })

  // 過去30日〜未来すべての案件を同期対象にする
  const from = new Date()
  from.setDate(from.getDate() - 30)
  const fromStr = from.toISOString().split('T')[0]

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, work_date, status, projects(name, location_name)')
    .eq('worker_id', user.id)
    .gte('work_date', fromStr)
    .neq('status', 'cancelled')
    .order('work_date', { ascending: true })
    .limit(100)

  if (!jobs || jobs.length === 0) {
    return NextResponse.json({ success: true, synced: 0 })
  }

  // Googleカレンダーにイベントを作成/更新
  let synced = 0
  const errors: string[] = []

  for (const job of jobs) {
    const project = (job as any).projects
    const projectName = project?.name ?? '案件'
    const location = project?.location_name ?? ''

    const event = {
      summary:     `🧹 ${projectName}`,
      description: `HIKARU 清掃案件\n作業場所: ${location}\nステータス: ${job.status === 'completed' ? '完了' : '予定'}`,
      start:       { date: job.work_date },
      end:         { date: job.work_date },
      colorId:     '5', // banana
      reminders:   {
        useDefault: false,
        overrides:  [{ method: 'popup', minutes: 60 }],
      },
    }

    const res = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    )

    if (res.ok) {
      synced++
    } else {
      const err = await res.json()
      errors.push(err.error?.message ?? 'unknown error')
    }
  }

  // 最終同期時刻を更新
  await admin
    .from('google_tokens')
    .update({ updated_at: new Date().toISOString() })
    .eq('user_id', user.id)

  return NextResponse.json({ success: true, synced, errors })
}

// ─── DELETE: 連携解除 ────────────────────────────────────────────
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = getAdmin()
  await admin.from('google_tokens').delete().eq('user_id', user.id)

  return NextResponse.json({ success: true })
}
