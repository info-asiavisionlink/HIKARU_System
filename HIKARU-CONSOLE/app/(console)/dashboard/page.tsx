'use client'

import * as React from 'react'
import Link from 'next/link'
import { getDashboardStats, type DashboardStats } from '@/services/dashboard.service'
import { Skeleton, PageHeader, Badge } from '@hikaru/ui'
import {
  FolderOpen, Building2, UserCheck, Handshake, Activity,
  TrendingUp, CheckCircle2, Pause, XCircle,
  ArrowRight, Cpu, Zap,
} from 'lucide-react'

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   HUD Stat Card — Black × Gold
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function StatCard({
  title, value, sub, icon: Icon, href, loading,
  primary = false,
}: {
  title: string; value: number; sub?: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  href: string; loading: boolean
  primary?: boolean
}) {
  const [hovered, setHovered] = React.useState(false)

  return (
    <Link href={href} className="block h-full">
      <div
        className="relative h-full rounded-[var(--radius-lg)] p-5 overflow-hidden transition-all duration-350 cursor-pointer"
        style={{
          background: hovered
            ? 'oklch(0.11 0.007 255 / 0.90)'
            : 'oklch(0.09 0.005 255 / 0.82)',
          backdropFilter: 'blur(24px) saturate(1.4)',
          border: hovered
            ? '1px solid oklch(0.73 0.12 78 / 0.45)'
            : '1px solid oklch(0.73 0.12 78 / 0.20)',
          boxShadow: hovered
            ? '0 0 40px oklch(0.73 0.12 78 / 0.15), 0 8px 30px oklch(0 0 0 / 0.5)'
            : '0 0 20px oklch(0.73 0.12 78 / 0.05)',
          transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Corner brackets (HUD装飾) */}
        <div className="absolute top-3 left-3 h-3 w-3"
          style={{ borderTop: '1px solid oklch(0.73 0.12 78 / 0.50)', borderLeft: '1px solid oklch(0.73 0.12 78 / 0.50)' }} />
        <div className="absolute top-3 right-3 h-3 w-3"
          style={{ borderTop: '1px solid oklch(0.73 0.12 78 / 0.50)', borderRight: '1px solid oklch(0.73 0.12 78 / 0.50)' }} />
        <div className="absolute bottom-3 left-3 h-3 w-3"
          style={{ borderBottom: '1px solid oklch(0.73 0.12 78 / 0.50)', borderLeft: '1px solid oklch(0.73 0.12 78 / 0.50)' }} />
        <div className="absolute bottom-3 right-3 h-3 w-3"
          style={{ borderBottom: '1px solid oklch(0.73 0.12 78 / 0.50)', borderRight: '1px solid oklch(0.73 0.12 78 / 0.50)' }} />

        {/* Background gold radial glow */}
        {hovered && (
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at top right, oklch(0.73 0.12 78 / 0.06) 0%, transparent 60%)' }} />
        )}

        <div className="flex items-start justify-between relative">
          <div className="flex flex-col gap-2">
            <p className="text-[9px] font-bold uppercase tracking-[0.25em]"
              style={{ color: 'oklch(0.73 0.12 78 / 0.65)' }}>
              {title}
            </p>
            {loading ? (
              <Skeleton className="h-10 w-20" />
            ) : (
              <p className="text-4xl font-black tabular-nums"
                style={{
                  background: 'linear-gradient(135deg, oklch(0.62 0.11 75), oklch(0.88 0.13 78), oklch(0.73 0.12 78))',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  filter: 'drop-shadow(0 0 8px oklch(0.73 0.12 78 / 0.5))',
                }}>
                {value.toLocaleString()}
              </p>
            )}
            {sub && !loading && (
              <p className="text-xs" style={{ color: 'oklch(0.50 0.007 75)' }}>{sub}</p>
            )}
          </div>
          <div className="rounded-[var(--radius-md)] p-2.5 shrink-0"
            style={{
              background: 'oklch(0.73 0.12 78 / 0.10)',
              border: '1px solid oklch(0.73 0.12 78 / 0.25)',
            }}>
            <Icon className="h-5 w-5"
              style={{ color: 'oklch(0.73 0.12 78)', filter: 'drop-shadow(0 0 4px oklch(0.73 0.12 78 / 0.7))' }} />
          </div>
        </div>

        {/* Arrow */}
        <div
          className="absolute bottom-4 right-4 transition-all duration-200"
          style={{ opacity: hovered ? 1 : 0 }}>
          <ArrowRight className="h-3.5 w-3.5" style={{ color: 'oklch(0.73 0.12 78)' }} />
        </div>
      </div>
    </Link>
  )
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Status Row
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function StatusRow({ label, count, icon: Icon, color }: {
  label: string; count: number
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  color: string
}) {
  return (
    <div className="flex items-center justify-between py-2.5"
      style={{ borderBottom: '1px solid oklch(0.73 0.12 78 / 0.07)' }}>
      <div className="flex items-center gap-2.5">
        <Icon className="h-3.5 w-3.5" style={{ color, filter: `drop-shadow(0 0 4px ${color})` }} />
        <span className="text-sm" style={{ color: 'oklch(0.80 0.008 75)' }}>{label}</span>
      </div>
      <span className="text-sm font-bold tabular-nums" style={{ color: 'oklch(0.95 0.008 75)' }}>
        {count}
      </span>
    </div>
  )
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Panel (共通カードパネル)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function Panel({ title, accentColor, href, hrefLabel, children }: {
  title: string; accentColor: string; href?: string; hrefLabel?: string; children: React.ReactNode
}) {
  return (
    <div className="rounded-[var(--radius-lg)] p-5"
      style={{
        background: 'oklch(0.09 0.005 255 / 0.82)',
        backdropFilter: 'blur(24px) saturate(1.4)',
        border: '1px solid oklch(0.73 0.12 78 / 0.18)',
      }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="h-4 w-0.5 rounded-full"
            style={{ background: accentColor, boxShadow: `0 0 8px ${accentColor}` }} />
          <h3 className="text-xs font-bold uppercase tracking-[0.2em]"
            style={{ color: 'oklch(0.73 0.12 78 / 0.90)' }}>
            {title}
          </h3>
        </div>
        {href && (
          <Link href={href}
            className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider transition-all duration-150 hover:gap-2"
            style={{ color: 'oklch(0.73 0.12 78 / 0.65)' }}>
            {hrefLabel} <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      {children}
    </div>
  )
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Dashboard Page
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function DashboardPage() {
  const [stats, setStats] = React.useState<DashboardStats | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    getDashboardStats().then((s) => { setStats(s); setLoading(false) })
  }, [])

  return (
    <div className="animate-[fade-in_0.5s_ease-out]">
      <PageHeader
        title="ダッシュボード"
        description="HIKARU AI Quality Management Platform"
      />

      {/* System Status Bar */}
      <div className="mb-6 flex items-center gap-5 px-4 py-2.5 rounded-[var(--radius-lg)]"
        style={{
          background: 'oklch(0.08 0.004 260 / 0.70)',
          backdropFilter: 'blur(16px)',
          border: '1px solid oklch(0.73 0.12 78 / 0.12)',
        }}>
        <div className="flex items-center gap-2">
          <Cpu className="h-3.5 w-3.5" style={{ color: 'oklch(0.85 0.18 198 / 0.8)' }} />
          <span className="text-[9px] font-bold uppercase tracking-[0.25em]"
            style={{ color: 'oklch(0.55 0.007 75)' }}>
            System Status
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full animate-[pulse-soft_2s_ease-in-out_infinite]"
            style={{ background: 'oklch(0.72 0.18 150)', boxShadow: '0 0 6px oklch(0.72 0.18 150)' }} />
          <span className="text-[10px] font-semibold" style={{ color: 'oklch(0.72 0.18 150)' }}>
            全システム正常稼働
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Zap className="h-3 w-3" style={{ color: 'oklch(0.73 0.12 78 / 0.60)' }} />
          <span className="text-[9px] font-mono tracking-widest"
            style={{ color: 'oklch(0.73 0.12 78 / 0.50)' }}>
            AI ENGINE ACTIVE
          </span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="総案件数"   value={stats?.projects.total    ?? 0} sub={`稼働中: ${stats?.projects.active ?? 0}件`}   icon={FolderOpen} href="/projects"  loading={loading} />
        <StatCard title="従業員数"   value={stats?.employees.total   ?? 0} sub={`在籍中: ${stats?.employees.active ?? 0}名`}  icon={UserCheck}  href="/employees" loading={loading} />
        <StatCard title="協力業者数" value={stats?.partners.total    ?? 0} sub={`契約中: ${stats?.partners.active ?? 0}社`}   icon={Handshake}  href="/partners"  loading={loading} />
        <StatCard title="稼働案件"   value={stats?.projects.active   ?? 0} sub="リアルタイム集計"                             icon={Activity}   href="/projects"  loading={loading} primary />
      </div>

      {/* Details */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="案件ステータス" accentColor="oklch(0.73 0.12 78)" href="/projects" hrefLabel="すべて表示">
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ) : (
            <div>
              <StatusRow label="稼働中"     count={stats?.projects.active    ?? 0} icon={TrendingUp}  color="oklch(0.72 0.18 150)" />
              <StatusRow label="停止中"     count={stats?.projects.paused    ?? 0} icon={Pause}       color="oklch(0.82 0.13 78)" />
              <StatusRow label="完了"       count={stats?.projects.completed ?? 0} icon={CheckCircle2} color="oklch(0.50 0.007 75)" />
              <StatusRow label="キャンセル" count={stats?.projects.cancelled ?? 0} icon={XCircle}     color="oklch(0.65 0.25 27)" />
            </div>
          )}
        </Panel>

        <Panel title="人員内訳" accentColor="oklch(0.85 0.18 198)" href="/employees" hrefLabel="すべて表示">
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ) : (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] mb-2"
                style={{ color: 'oklch(0.73 0.12 78 / 0.55)' }}>従業員</p>
              {[
                { label: '在籍中',   count: stats?.employees.active   ?? 0, variant: 'success'     as const },
                { label: '休職中',   count: stats?.employees.on_leave ?? 0, variant: 'warning'     as const },
                { label: '退職',     count: stats?.employees.resigned ?? 0, variant: 'secondary'   as const },
              ].map((row) => (
                <div key={row.label}
                  className="flex items-center justify-between py-2"
                  style={{ borderBottom: '1px solid oklch(0.73 0.12 78 / 0.07)' }}>
                  <Badge variant={row.variant}>{row.label}</Badge>
                  <span className="text-sm font-bold tabular-nums" style={{ color: 'oklch(0.95 0.008 75)' }}>
                    {row.count}名
                  </span>
                </div>
              ))}
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] mt-4 mb-2"
                style={{ color: 'oklch(0.73 0.12 78 / 0.55)' }}>協力業者</p>
              {[
                { label: '契約中',   count: stats?.partners.active     ?? 0, variant: 'success'   as const },
                { label: '一時停止', count: stats?.partners.suspended  ?? 0, variant: 'warning'   as const },
                { label: '契約終了', count: stats?.partners.terminated ?? 0, variant: 'secondary' as const },
              ].map((row) => (
                <div key={row.label}
                  className="flex items-center justify-between py-2"
                  style={{ borderBottom: '1px solid oklch(0.73 0.12 78 / 0.07)' }}>
                  <Badge variant={row.variant}>{row.label}</Badge>
                  <span className="text-sm font-bold tabular-nums" style={{ color: 'oklch(0.95 0.008 75)' }}>
                    {row.count}社
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* 売上サマリー */}
      <div className="mt-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 max-w-[20px]" style={{ background: 'oklch(0.73 0.12 78 / 0.50)' }} />
          <h2 className="text-[9px] font-bold uppercase tracking-[0.3em]" style={{ color: 'oklch(0.73 0.12 78 / 0.55)' }}>Revenue</h2>
          <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, oklch(0.73 0.12 78 / 0.25), transparent)' }} />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: '今月売上',   value: stats?.revenue.this_month ?? 0, accent: 'oklch(0.72 0.18 150)' },
            { label: '年間売上',   value: stats?.revenue.this_year  ?? 0, accent: 'oklch(0.73 0.12 78)' },
            { label: '未請求',     value: stats?.revenue.unbilled   ?? 0, accent: 'oklch(0.82 0.16 60)' },
            { label: '未入金',     value: stats?.revenue.unpaid     ?? 0, accent: 'oklch(0.65 0.18 30)' },
          ].map((item) => (
            <div key={item.label} className="rounded-[var(--radius-lg)] p-4"
              style={{ background: 'oklch(0.09 0.005 255 / 0.82)', border: '1px solid oklch(0.73 0.12 78 / 0.15)' }}>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: `${item.accent}99` }}>{item.label}</p>
              {loading ? <div className="h-7 w-24 rounded animate-pulse" style={{ background: 'oklch(0.15 0.005 260)' }} /> : (
                <p className="text-xl font-black tabular-nums" style={{ color: item.accent, filter: `drop-shadow(0 0 6px ${item.accent}66)` }}>
                  {item.value > 0 ? '¥' + item.value.toLocaleString('ja-JP') : '—'}
                </p>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-4">
          {[
            { label: '単発売上',   value: stats?.revenue.by_type.spot      ?? 0 },
            { label: '定期売上',   value: stats?.revenue.by_type.recurring ?? 0 },
            { label: 'ホテル売上', value: stats?.revenue.by_type.hotel     ?? 0 },
          ].map((item) => (
            <div key={item.label} className="rounded-[var(--radius-lg)] p-3 flex items-center justify-between"
              style={{ background: 'oklch(0.07 0.004 260 / 0.70)', border: '1px solid oklch(0.73 0.12 78 / 0.10)' }}>
              <span className="text-xs" style={{ color: 'oklch(0.55 0.008 75)' }}>{item.label}</span>
              <span className="text-sm font-bold tabular-nums" style={{ color: 'oklch(0.85 0.008 75)' }}>
                {item.value > 0 ? '¥' + item.value.toLocaleString('ja-JP') : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 max-w-[20px]"
            style={{ background: 'oklch(0.73 0.12 78 / 0.50)' }} />
          <h2 className="text-[9px] font-bold uppercase tracking-[0.3em]"
            style={{ color: 'oklch(0.73 0.12 78 / 0.55)' }}>
            Quick Actions
          </h2>
          <div className="h-px flex-1"
            style={{ background: 'linear-gradient(90deg, oklch(0.73 0.12 78 / 0.25), transparent)' }} />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: '案件を追加',   href: '/projects/new', icon: FolderOpen },
            { label: '顧客を追加',   href: '/clients/new',  icon: Building2 },
            { label: '従業員管理',   href: '/employees',    icon: UserCheck },
            { label: 'AI分析',       href: '/analytics',    icon: Activity },
          ].map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center gap-2.5 rounded-[var(--radius-lg)] px-4 py-3 text-sm font-medium transition-all duration-250"
                style={{
                  background: 'oklch(0.08 0.004 260 / 0.70)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid oklch(0.73 0.12 78 / 0.15)',
                  color: 'oklch(0.75 0.008 75)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'oklch(0.73 0.12 78 / 0.45)'
                  e.currentTarget.style.background = 'oklch(0.73 0.12 78 / 0.07)'
                  e.currentTarget.style.color = 'oklch(0.82 0.13 78)'
                  e.currentTarget.style.boxShadow = '0 0 20px oklch(0.73 0.12 78 / 0.10)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'oklch(0.73 0.12 78 / 0.15)'
                  e.currentTarget.style.background = 'oklch(0.08 0.004 260 / 0.70)'
                  e.currentTarget.style.color = 'oklch(0.75 0.008 75)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
