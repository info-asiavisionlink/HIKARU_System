'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Briefcase, CheckCircle2, Clock, ChevronRight,
  Bell, PlayCircle, Activity,
} from 'lucide-react'

/* Gold mini stat card */
function StatCard({ label, value, icon: Icon, href }: {
  label: string; value: number; icon: React.ElementType; href?: string
}) {
  const content = (
    <div
      className="flex items-center gap-3 rounded-[var(--radius-xl)] p-4 transition-all duration-200 active:scale-[0.97]"
      style={{
        background: 'oklch(0.09 0.005 255 / 0.82)',
        backdropFilter: 'blur(20px)',
        border: '1px solid oklch(0.73 0.12 78 / 0.22)',
        boxShadow: '0 0 16px oklch(0.73 0.12 78 / 0.06)',
      }}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-lg)] shrink-0"
        style={{
          background: 'oklch(0.73 0.12 78 / 0.10)',
          border: '1px solid oklch(0.73 0.12 78 / 0.28)',
        }}>
        <Icon className="h-5 w-5"
          style={{ color: 'oklch(0.73 0.12 78)', filter: 'drop-shadow(0 0 4px oklch(0.73 0.12 78 / 0.7))' }} />
      </span>
      <div>
        <p className="text-2xl font-black tabular-nums"
          style={{
            background: 'linear-gradient(135deg, oklch(0.62 0.11 75), oklch(0.88 0.13 78))',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
          {value}
        </p>
        <p className="text-xs" style={{ color: 'oklch(0.50 0.007 75)' }}>{label}</p>
      </div>
    </div>
  )
  if (href) return <Link href={href}>{content}</Link>
  return content
}

/* 作業中カード */
function InProgressCard({ job }: { job: any }) {
  return (
    <Link href={`/jobs/${job.project_id}`}>
      <div
        className="relative rounded-[var(--radius-xl)] p-5 overflow-hidden transition-all duration-200 active:scale-[0.98]"
        style={{
          background: 'oklch(0.09 0.005 255 / 0.85)',
          backdropFilter: 'blur(20px)',
          border: '1px solid oklch(0.73 0.12 78 / 0.40)',
          boxShadow: '0 0 30px oklch(0.73 0.12 78 / 0.12), inset 0 1px 0 oklch(0.85 0.13 78 / 0.08)',
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, oklch(0.73 0.12 78 / 0.60), transparent)' }} />
        <div className="absolute inset-0 overflow-hidden rounded-[inherit] pointer-events-none">
          <div className="absolute left-0 right-0 h-px"
            style={{
              background: 'linear-gradient(90deg, transparent, oklch(0.85 0.18 198 / 0.6), transparent)',
              animation: 'scan-move 4s ease-in-out infinite',
            }} />
        </div>

        <div className="flex items-center gap-2 mb-3">
          <span className="h-1.5 w-1.5 rounded-full animate-[pulse-soft_1s_ease-in-out_infinite]"
            style={{ background: 'oklch(0.73 0.12 78)', boxShadow: '0 0 6px oklch(0.73 0.12 78)' }} />
          <span className="text-[9px] font-bold uppercase tracking-[0.25em]"
            style={{ color: 'oklch(0.73 0.12 78 / 0.75)' }}>
            作業中
          </span>
        </div>
        <p className="font-bold text-base truncate" style={{ color: 'oklch(0.95 0.008 75)' }}>
          {job.projects?.name ?? '案件'}
        </p>
        <p className="text-sm mt-0.5 truncate" style={{ color: 'oklch(0.55 0.007 75)' }}>
          {job.projects?.location_name}
        </p>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs" style={{ color: 'oklch(0.40 0.005 75)' }}>
            開始: {new Date(job.started_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="flex items-center gap-1 text-sm font-semibold"
            style={{ color: 'oklch(0.73 0.12 78)' }}>
            続きを見る <ChevronRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  )
}

function TodayShiftCard({ shift }: { shift: any }) {
  const GOLD = 'oklch(0.73 0.12 78)'
  const statusColor = shift.status === 'confirmed' ? 'oklch(0.85 0.18 198)' : GOLD
  return (
    <div className="rounded-[var(--radius-xl)] p-4"
      style={{
        background: 'oklch(0.09 0.005 255 / 0.82)',
        border: `1px solid ${statusColor}30`,
      }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold tabular-nums" style={{ color: statusColor }}>
          {shift.start_time?.slice(0,5)} 〜 {shift.end_time?.slice(0,5)}
        </span>
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
          style={{ background: `${statusColor}18`, color: statusColor }}>
          {shift.status === 'confirmed' ? '確定' : '予定'}
        </span>
      </div>
      <p className="font-bold text-sm truncate" style={{ color: 'oklch(0.92 0.008 75)' }}>
        {shift.projects?.name ?? '—'}
      </p>
      {shift.projects?.location_name && (
        <p className="text-xs mt-0.5 truncate" style={{ color: 'oklch(0.55 0.007 75)' }}>
          {shift.projects.location_name}
        </p>
      )}
    </div>
  )
}

export default function HomePage() {
  const router = useRouter()
  const [profile, setProfile] = React.useState<any>(null)
  const [summary, setSummary] = React.useState({ inProgress: 0, completed: 0, total: 0, jobs: [] as any[] })
  const [recentProjects, setRecentProjects] = React.useState<any[]>([])
  const [todayShifts, setTodayShifts] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'おはようございます' : hour < 18 ? 'こんにちは' : 'お疲れ様です'
  const dateStr = now.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })

  React.useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/home/data', { credentials: 'include', cache: 'no-store' })
        if (res.status === 401) { router.replace('/login'); return }
        if (!res.ok) throw new Error('データの取得に失敗しました')
        const data = await res.json()
        setProfile(data.profile)
        setSummary(data.summary)
        setRecentProjects(data.projects)

        // 今日のシフト取得
        const today = new Date().toISOString().split('T')[0]
        fetch(`/api/shifts?date_from=${today}&date_to=${today}`, { credentials: 'include' })
          .then(r => r.ok ? r.json() : { shifts: [] })
          .then(d => setTodayShifts(d.shifts ?? []))
      } catch (e) {
        console.error('[home] load error:', e)
        setLoadError(e instanceof Error ? e.message : '読み込みに失敗しました')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router, reloadKey])

  const inProgressJob = summary.jobs.find((j) => j.status === 'in_progress')

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-[3px] border-t-transparent animate-spin"
            style={{ borderColor: 'oklch(0.73 0.12 78)', borderTopColor: 'transparent', filter: 'drop-shadow(0 0 6px oklch(0.73 0.12 78 / 0.7))' }} />
          <p className="text-[9px] uppercase tracking-[0.3em]" style={{ color: 'oklch(0.40 0.005 75)' }}>読み込み中</p>
        </div>
      </div>
    )
  }

  if (loadError && !profile) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-6">
        <div className="rounded-[var(--radius-xl)] p-6 text-center w-full max-w-sm"
          style={{ background: 'oklch(0.09 0.005 255 / 0.85)', border: '1px solid oklch(0.65 0.18 30 / 0.40)' }}>
          <p className="text-sm font-semibold mb-2" style={{ color: 'oklch(0.75 0.18 30)' }}>読み込みエラー</p>
          <p className="text-xs" style={{ color: 'oklch(0.55 0.007 75)' }}>{loadError}</p>
          <button
            onClick={() => { setLoadError(null); setLoading(true); setReloadKey(k => k + 1) }}
            className="mt-4 px-4 py-2 rounded-lg text-xs font-bold"
            style={{ background: 'oklch(0.73 0.12 78 / 0.15)', border: '1px solid oklch(0.73 0.12 78 / 0.35)', color: 'oklch(0.73 0.12 78)' }}
          >
            再読み込み
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh animate-[fade-in_0.35s_ease-out]">
      {/* Header */}
      <div className="px-4 pt-5 pb-4"
        style={{ borderBottom: '1px solid oklch(0.73 0.12 78 / 0.10)' }}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.3em]"
              style={{ color: 'oklch(0.73 0.12 78 / 0.55)' }}>
              {dateStr}
            </p>
            <h1 className="mt-1 text-xl font-bold" style={{ color: 'oklch(0.92 0.008 75)' }}>
              {greeting}
            </h1>
            {profile?.name && (
              <p className="text-sm mt-0.5" style={{ color: 'oklch(0.55 0.007 75)' }}>
                {profile.name}さん
              </p>
            )}
          </div>
          <Link href="/notifications"
            className="relative p-2 rounded-full transition-all duration-150"
            style={{ color: 'oklch(0.50 0.007 75)' }}>
            <Bell className="h-5 w-5" />
          </Link>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Activity className="h-3 w-3" style={{ color: 'oklch(0.72 0.18 150 / 0.8)' }} />
          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'oklch(0.40 0.005 75)' }}>
            システム正常
          </span>
          <span className="h-1 w-1 rounded-full animate-[pulse-soft_2s_ease-in-out_infinite]"
            style={{ background: 'oklch(0.72 0.18 150)', boxShadow: '0 0 4px oklch(0.72 0.18 150)' }} />
        </div>
      </div>

      <div className="px-4 py-5 space-y-6">
        {inProgressJob && <InProgressCard job={inProgressJob} />}

        {/* 今日のシフト */}
        {todayShifts.length > 0 && (
          <section>
            <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.25em]"
              style={{ color: 'oklch(0.73 0.12 78 / 0.50)' }}>
              今日の予定シフト
            </p>
            <div className="space-y-2">
              {todayShifts.map(s => <TodayShiftCard key={s.id} shift={s} />)}
            </div>
          </section>
        )}

        {/* 本日の作業 */}
        <section>
          <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.25em]"
            style={{ color: 'oklch(0.73 0.12 78 / 0.50)' }}>
            本日の作業
          </p>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="進行中" value={summary.inProgress} icon={Clock}       href="/jobs" />
            <StatCard label="完了"   value={summary.completed}  icon={CheckCircle2} href="/jobs" />
          </div>
        </section>

        {/* 案件一覧 */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[9px] font-bold uppercase tracking-[0.25em]"
              style={{ color: 'oklch(0.73 0.12 78 / 0.50)' }}>
              案件一覧
            </p>
            <Link href="/jobs" className="text-xs font-medium transition-all"
              style={{ color: 'oklch(0.73 0.12 78 / 0.75)' }}>
              すべて見る
            </Link>
          </div>

          <div className="space-y-2">
            {recentProjects.length === 0 ? (
              <div className="rounded-[var(--radius-xl)] p-6 text-center"
                style={{
                  border: '1px dashed oklch(0.73 0.12 78 / 0.18)',
                  background: 'oklch(0.08 0.004 260 / 0.50)',
                }}>
                <Briefcase className="mx-auto h-8 w-8 mb-2 opacity-30" style={{ color: 'oklch(0.73 0.12 78)' }} />
                <p className="text-sm" style={{ color: 'oklch(0.45 0.006 75)' }}>案件がありません</p>
              </div>
            ) : (
              recentProjects.map((project) => (
                <Link key={project.id} href={`/jobs/${project.id}`}
                  className="flex items-center gap-3 rounded-[var(--radius-xl)] p-4 transition-all duration-150 active:scale-[0.98]"
                  style={{
                    background: 'oklch(0.09 0.005 255 / 0.80)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid oklch(0.73 0.12 78 / 0.15)',
                  }}>
                  <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-lg)] shrink-0"
                    style={
                      project.todayJob?.status === 'completed' ? {
                        background: 'oklch(0.72 0.18 150 / 0.10)', border: '1px solid oklch(0.72 0.18 150 / 0.35)',
                      } : project.todayJob?.status === 'in_progress' ? {
                        background: 'oklch(0.73 0.12 78 / 0.10)', border: '1px solid oklch(0.73 0.12 78 / 0.35)',
                      } : {
                        background: 'oklch(0.12 0.007 255 / 0.70)', border: '1px solid oklch(0.73 0.12 78 / 0.12)',
                      }
                    }>
                    {project.todayJob?.status === 'completed'
                      ? <CheckCircle2 className="h-5 w-5" style={{ color: 'oklch(0.72 0.18 150)' }} />
                      : project.todayJob?.status === 'in_progress'
                      ? <PlayCircle className="h-5 w-5" style={{ color: 'oklch(0.73 0.12 78)' }} />
                      : <Briefcase className="h-5 w-5" style={{ color: 'oklch(0.45 0.006 75)' }} />
                    }
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate" style={{ color: 'oklch(0.90 0.008 75)' }}>
                      {project.name}
                    </p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'oklch(0.48 0.006 75)' }}>
                      {project.location_name}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0" style={{ color: 'oklch(0.73 0.12 78 / 0.45)' }} />
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
