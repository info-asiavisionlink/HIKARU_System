'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  getAnalyticsOverview, getMonthlyTrends, getStoreRankings,
  getWorkerRankings, getQualityDistribution, getSpotQualityRankings,
  type AnalyticsOverview, type MonthlyTrend, type StoreRanking,
  type WorkerRanking, type QualityDistribution, type SpotQualityRank,
} from '@/services/analytics.service'
import {
  Card, CardContent, CardHeader, CardTitle, Skeleton, PageHeader,
  Tabs, TabsList, TabsTrigger, TabsContent, Badge,
} from '@hikaru/ui'
import {
  LineChart, HBarChart, DonutChart, VBarChart, ScoreRing, scoreColor,
} from '@/components/analytics/Charts'
import {
  BarChart3, CheckCircle2, AlertTriangle, XCircle, Camera,
  Users, Store, FileText, MessageSquare, Sparkles,
  TrendingUp, TrendingDown, Minus, RefreshCw, ChevronRight,
} from 'lucide-react'
import { cn } from '@hikaru/ui'

// ============================================================
// AI分析の型
// ============================================================

interface AISuggestion {
  priority: 'high' | 'medium' | 'low'
  title: string
  detail: string
}

interface AIOverviewResult {
  overallAssessment: string
  strengths: string[]
  concerns: string[]
  suggestions: AISuggestion[]
  trend: 'improving' | 'declining' | 'stable'
}

// ============================================================
// サブコンポーネント
// ============================================================

function MetricCard({
  title, value, sub, icon: Icon, loading, colorClass, href,
}: {
  title: string
  value: string | number
  sub?: string
  icon: React.ElementType
  loading: boolean
  colorClass?: string
  href?: string
}) {
  const inner = (
    <Card className={cn('h-full transition-shadow', href && 'hover:shadow-[var(--shadow-md)] cursor-pointer')}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-[var(--color-muted-foreground)]">{title}</p>
            {loading ? (
              <Skeleton className="h-7 w-20 mt-1" />
            ) : (
              <p className={cn('mt-1 text-2xl font-bold truncate', colorClass ?? 'text-[var(--color-foreground)]')}>
                {value}
              </p>
            )}
            {sub && !loading && (
              <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">{sub}</p>
            )}
          </div>
          <div className="rounded-[var(--radius-lg)] bg-[var(--color-muted)] p-2 shrink-0">
            <Icon className="h-4 w-4 text-[var(--color-muted-foreground)]" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

function TrendIcon({ trend }: { trend: 'improving' | 'declining' | 'stable' }) {
  if (trend === 'improving') return <TrendingUp className="h-4 w-4 text-[var(--color-success)]" />
  if (trend === 'declining') return <TrendingDown className="h-4 w-4 text-[var(--color-error)]" />
  return <Minus className="h-4 w-4 text-[var(--color-muted-foreground)]" />
}

function PriorityBadge({ priority }: { priority: 'high' | 'medium' | 'low' }) {
  return (
    <span className={cn(
      'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
      priority === 'high'   && 'bg-[var(--color-error-muted)] text-[var(--color-error-foreground)]',
      priority === 'medium' && 'bg-[var(--color-warning-muted)] text-[var(--color-warning-foreground)]',
      priority === 'low'    && 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
    )}>
      {priority === 'high' ? '高' : priority === 'medium' ? '中' : '低'}
    </span>
  )
}

// ============================================================
// メインページ
// ============================================================

export default function AnalyticsPage() {
  const [overview,      setOverview]      = React.useState<AnalyticsOverview | null>(null)
  const [trends,        setTrends]        = React.useState<MonthlyTrend[]>([])
  const [storeRanks,    setStoreRanks]    = React.useState<StoreRanking[]>([])
  const [workerRanks,   setWorkerRanks]   = React.useState<WorkerRanking[]>([])
  const [distribution,  setDistribution]  = React.useState<QualityDistribution[]>([])
  const [spotRanks,     setSpotRanks]     = React.useState<SpotQualityRank[]>([])
  const [aiResult,      setAiResult]      = React.useState<AIOverviewResult | null>(null)
  const [loading,       setLoading]       = React.useState(true)
  const [aiLoading,     setAiLoading]     = React.useState(false)

  React.useEffect(() => {
    async function load() {
      const [ov, tr, sr, wr, dist, spot] = await Promise.all([
        getAnalyticsOverview(),
        getMonthlyTrends(),
        getStoreRankings(),
        getWorkerRankings(),
        getQualityDistribution(),
        getSpotQualityRankings(),
      ])
      setOverview(ov)
      setTrends(tr)
      setStoreRanks(sr)
      setWorkerRanks(wr)
      setDistribution(dist)
      setSpotRanks(spot)
      setLoading(false)
    }
    load()
  }, [])

  async function fetchAISuggestions() {
    setAiLoading(true)
    try {
      const res  = await fetch('/api/ai/analyze?type=overview')
      const json = await res.json()
      if (json.success) setAiResult(json.data)
    } finally {
      setAiLoading(false)
    }
  }

  // チャートデータ
  const lineData = trends.map((t) => ({ label: t.label, value: t.avgScore }))
  const barData  = trends.map((t) => ({ label: t.label, value: t.jobCount }))

  const donutSegments = overview ? [
    { value: overview.passCount,  color: 'var(--color-success)', label: '合格' },
    { value: overview.checkCount, color: 'var(--color-warning)', label: '要確認' },
    { value: overview.redoCount,  color: 'var(--color-error)',   label: '再清掃' },
  ] : []

  const totalEvals = overview ? overview.passCount + overview.checkCount + overview.redoCount : 0

  return (
    <div>
      <PageHeader
        title="AI分析ダッシュボード"
        description="清掃品質データの統合分析"
      />

      <Tabs defaultValue="overview">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">概要</TabsTrigger>
          <TabsTrigger value="quality">品質分析</TabsTrigger>
          <TabsTrigger value="rankings">ランキング</TabsTrigger>
          <TabsTrigger value="ai">AI提案</TabsTrigger>
        </TabsList>

        {/* ======================================== */}
        {/* 概要タブ                                  */}
        {/* ======================================== */}
        <TabsContent value="overview">
          {/* KPIカード */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5 mb-6">
            <MetricCard
              title="総作業回数"
              value={overview?.totalJobs ?? 0}
              sub={`今月: ${overview?.thisMonthJobs ?? 0}件`}
              icon={BarChart3}
              loading={loading}
            />
            <MetricCard
              title="AI平均品質スコア"
              value={overview?.avgQualityScore != null ? `${overview.avgQualityScore}点` : '—'}
              sub={`合格率: ${overview?.passRate ?? 0}%`}
              icon={CheckCircle2}
              loading={loading}
              colorClass={overview?.avgQualityScore != null ? scoreColor(overview.avgQualityScore) : undefined}
            />
            <MetricCard
              title="総評価数"
              value={overview?.totalEvaluations ?? 0}
              sub={`再清掃率: ${overview?.redoRate ?? 0}%`}
              icon={AlertTriangle}
              loading={loading}
            />
            <MetricCard
              title="写真枚数"
              value={overview?.totalPhotos ?? 0}
              icon={Camera}
              loading={loading}
            />
            <MetricCard
              title="報告書"
              value={overview?.totalReports ?? 0}
              sub="生成済み"
              icon={FileText}
              loading={loading}
              href="/reports"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* 月別品質スコア推移 */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">品質スコア月別推移</CardTitle>
                <p className="text-xs text-[var(--color-muted-foreground)]">過去12ヶ月の平均品質スコア</p>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-32 w-full" />
                ) : (
                  <LineChart data={lineData} height={120} />
                )}
              </CardContent>
            </Card>

            {/* 判定分布ドーナツ */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">判定分布</CardTitle>
                <p className="text-xs text-[var(--color-muted-foreground)]">全AI評価の判定内訳</p>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-32 w-full" />
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <DonutChart
                      segments={donutSegments}
                      size={110}
                      strokeWidth={18}
                      centerValue={overview?.passRate != null ? `${overview.passRate}%` : '—'}
                      centerLabel="合格率"
                    />
                    <div className="w-full space-y-1.5">
                      {[
                        { label: '合格',   count: overview?.passCount  ?? 0, color: 'var(--color-success)' },
                        { label: '要確認', count: overview?.checkCount ?? 0, color: 'var(--color-warning)' },
                        { label: '再清掃', count: overview?.redoCount  ?? 0, color: 'var(--color-error)' },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
                            <span className="text-[var(--color-muted-foreground)]">{item.label}</span>
                          </div>
                          <span className="font-semibold text-[var(--color-foreground)]">
                            {item.count}件
                            {totalEvals > 0 && (
                              <span className="text-[var(--color-muted-foreground)] font-normal ml-1">
                                ({Math.round((item.count / totalEvals) * 100)}%)
                              </span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 月別作業件数 */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">月別作業件数</CardTitle>
                <p className="text-xs text-[var(--color-muted-foreground)]">過去12ヶ月の作業回数推移</p>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-20 w-full" />
                ) : (
                  <VBarChart data={barData.map((d) => ({ label: d.label, value: d.value }))} height={72} />
                )}
              </CardContent>
            </Card>

            {/* その他KPI */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">業務指標</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading ? (
                  <Skeleton className="h-24 w-full" />
                ) : (
                  <>
                    {[
                      { label: 'AIチャット利用',   value: `${overview?.chatCount ?? 0}件` },
                      { label: '稼働中案件',       value: `${overview?.totalProjects ?? 0}件` },
                      { label: '登録店舗数',       value: `${overview?.totalStores ?? 0}店舗` },
                      { label: '進行中ジョブ',     value: `${overview?.activeJobs ?? 0}件` },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between text-sm border-b border-[var(--color-border)] pb-2 last:border-0 last:pb-0">
                        <span className="text-[var(--color-muted-foreground)]">{row.label}</span>
                        <span className="font-semibold text-[var(--color-foreground)]">{row.value}</span>
                      </div>
                    ))}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ======================================== */}
        {/* 品質分析タブ                              */}
        {/* ======================================== */}
        <TabsContent value="quality">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* スコア分布 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">品質スコア分布</CardTitle>
                <p className="text-xs text-[var(--color-muted-foreground)]">全評価のスコア帯別分布</p>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-40 w-full" />
                ) : distribution.length === 0 ? (
                  <p className="text-sm text-center text-[var(--color-muted-foreground)] py-8">データなし</p>
                ) : (
                  <div className="space-y-3">
                    {distribution.map((d) => (
                      <div key={d.range} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[var(--color-foreground)]">{d.label}</span>
                          <span className="text-[var(--color-muted-foreground)]">{d.count}件 ({d.pct}%)</span>
                        </div>
                        <div className="h-2 rounded-full bg-[var(--color-muted)] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${d.pct}%`,
                              background: d.range.startsWith('90') ? 'var(--color-success)' :
                                          d.range.startsWith('75') ? 'var(--color-success)' :
                                          d.range.startsWith('60') ? 'var(--color-warning)' :
                                          d.range.startsWith('45') ? 'var(--color-warning)' : 'var(--color-error)',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 撮影箇所別品質ランキング */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">撮影箇所別 品質スコア</CardTitle>
                <p className="text-xs text-[var(--color-muted-foreground)]">平均スコアの低い箇所（要改善順）</p>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-40 w-full" />
                ) : spotRanks.length === 0 ? (
                  <p className="text-sm text-center text-[var(--color-muted-foreground)] py-8">データなし</p>
                ) : (
                  <HBarChart
                    data={spotRanks.slice(0, 8).map((s) => ({
                      label: s.spotName,
                      value: s.avgScore,
                      sub:   `評価${s.evalCount}件`,
                    }))}
                    maxValue={100}
                  />
                )}
              </CardContent>
            </Card>

            {/* 再清掃率の高い箇所 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">再清掃率の高い箇所</CardTitle>
                <p className="text-xs text-[var(--color-muted-foreground)]">「再清掃」判定の多い撮影箇所</p>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-32 w-full" />
                ) : (
                  <div className="space-y-2.5">
                    {spotRanks.filter((s) => s.redoRate > 0)
                      .sort((a, b) => b.redoRate - a.redoRate)
                      .slice(0, 6)
                      .map((s) => (
                        <div key={s.spotName} className="flex items-center justify-between text-sm">
                          <span className="text-[var(--color-foreground)]">{s.spotName}</span>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 rounded-full bg-[var(--color-muted)] overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[var(--color-error)]"
                                style={{ width: `${s.redoRate}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-[var(--color-error)] w-10 text-right">
                              {s.redoRate}%
                            </span>
                          </div>
                        </div>
                      ))}
                    {spotRanks.filter((s) => s.redoRate > 0).length === 0 && (
                      <p className="text-sm text-center text-[var(--color-muted-foreground)] py-4">
                        再清掃なし — 品質良好
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 品質スコアサマリー（大きい表示） */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">品質スコアサマリー</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <ScoreRing score={overview?.avgQualityScore ?? null} size={96} />
                  <div className="space-y-2 flex-1">
                    <div className="text-sm text-[var(--color-muted-foreground)]">
                      総合平均スコア
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-[var(--color-success-muted)] p-2">
                        <p className="text-lg font-bold text-[var(--color-success)]">{overview?.passCount ?? 0}</p>
                        <p className="text-[10px] text-[var(--color-success-foreground)]">合格</p>
                      </div>
                      <div className="rounded-lg bg-[var(--color-warning-muted)] p-2">
                        <p className="text-lg font-bold text-[var(--color-warning)]">{overview?.checkCount ?? 0}</p>
                        <p className="text-[10px] text-[var(--color-warning-foreground)]">要確認</p>
                      </div>
                      <div className="rounded-lg bg-[var(--color-error-muted)] p-2">
                        <p className="text-lg font-bold text-[var(--color-error)]">{overview?.redoCount ?? 0}</p>
                        <p className="text-[10px] text-[var(--color-error-foreground)]">再清掃</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ======================================== */}
        {/* ランキングタブ                            */}
        {/* ======================================== */}
        <TabsContent value="rankings">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* 店舗品質ランキング */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-base">店舗品質ランキング</CardTitle>
                  <p className="text-xs text-[var(--color-muted-foreground)]">平均品質スコア順</p>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-48 w-full" />
                ) : storeRanks.length === 0 ? (
                  <p className="text-sm text-center text-[var(--color-muted-foreground)] py-8">データなし</p>
                ) : (
                  <div className="space-y-3">
                    {storeRanks.slice(0, 10).map((s, i) => (
                      <Link
                        key={s.storeId}
                        href={`/analytics/store/${s.storeId}`}
                        className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-transparent hover:border-[var(--color-border)] hover:bg-[var(--color-muted)]/40 px-2 py-1.5 transition-colors group"
                      >
                        <span className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                          i === 0 ? 'bg-yellow-100 text-yellow-700' :
                          i === 1 ? 'bg-gray-100 text-gray-600' :
                          i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'
                        )}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--color-foreground)] truncate">{s.storeName}</p>
                          <p className="text-[10px] text-[var(--color-muted-foreground)]">
                            作業{s.jobCount}回
                            {s.lastJobDate && ` · 最終: ${new Date(s.lastJobDate).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn('text-lg font-bold tabular-nums', scoreColor(s.avgScore))}>
                            {s.avgScore ?? '—'}
                          </span>
                          <span className="text-xs text-[var(--color-muted-foreground)]">点</span>
                          <ChevronRight className="h-3.5 w-3.5 text-[var(--color-muted-foreground)] opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 作業者ランキング */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-base">作業者ランキング</CardTitle>
                  <p className="text-xs text-[var(--color-muted-foreground)]">平均品質スコア順</p>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-48 w-full" />
                ) : workerRanks.length === 0 ? (
                  <p className="text-sm text-center text-[var(--color-muted-foreground)] py-8">データなし</p>
                ) : (
                  <div className="space-y-3">
                    {workerRanks.slice(0, 10).map((w, i) => (
                      <Link
                        key={w.workerId}
                        href={`/analytics/worker/${w.workerId}`}
                        className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-transparent hover:border-[var(--color-border)] hover:bg-[var(--color-muted)]/40 px-2 py-1.5 transition-colors group"
                      >
                        <span className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                          i === 0 ? 'bg-yellow-100 text-yellow-700' :
                          i === 1 ? 'bg-gray-100 text-gray-600' :
                          i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'
                        )}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--color-foreground)] truncate">{w.workerName}</p>
                          <p className="text-[10px] text-[var(--color-muted-foreground)]">
                            {w.jobCount}回作業 · 合格率 {w.passRate}%
                            {w.redoCount > 0 && ` · 再清掃 ${w.redoCount}件`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn('text-lg font-bold tabular-nums', scoreColor(w.avgScore))}>
                            {w.avgScore ?? '—'}
                          </span>
                          <span className="text-xs text-[var(--color-muted-foreground)]">点</span>
                          <ChevronRight className="h-3.5 w-3.5 text-[var(--color-muted-foreground)] opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ======================================== */}
        {/* AI提案タブ                               */}
        {/* ======================================== */}
        <TabsContent value="ai">
          {!aiResult && !aiLoading ? (
            <Card>
              <CardContent className="py-16 flex flex-col items-center text-center">
                <div className="h-14 w-14 rounded-full bg-[var(--color-primary-muted)] flex items-center justify-center mb-4">
                  <Sparkles className="h-7 w-7 text-[var(--color-primary)]" />
                </div>
                <p className="text-base font-semibold text-[var(--color-foreground)]">
                  AI改善提案を生成する
                </p>
                <p className="mt-1 text-sm text-[var(--color-muted-foreground)] max-w-sm">
                  蓄積されたデータをもとに、AIが品質改善・業務改善の提案を自動生成します
                </p>
                <button
                  onClick={fetchAISuggestions}
                  disabled={loading}
                  className="mt-6 flex items-center gap-2 rounded-[var(--radius-xl)] bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" /> AIに分析させる
                </button>
              </CardContent>
            </Card>
          ) : aiLoading ? (
            <Card>
              <CardContent className="py-16 flex flex-col items-center text-center">
                <div className="h-12 w-12 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin mb-4" />
                <p className="text-base font-semibold">AI分析中...</p>
                <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">データを解析し、提案を生成しています</p>
              </CardContent>
            </Card>
          ) : aiResult && (
            <div className="space-y-6">
              {/* 総合評価 */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-[var(--color-primary)]" />
                    <CardTitle className="text-base">AI総合評価</CardTitle>
                    <div className="ml-auto flex items-center gap-1.5">
                      <TrendIcon trend={aiResult.trend} />
                      <span className="text-xs text-[var(--color-muted-foreground)]">
                        {aiResult.trend === 'improving' ? '改善傾向' : aiResult.trend === 'declining' ? '悪化傾向' : '横ばい'}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-[var(--color-foreground)]">
                    {aiResult.overallAssessment}
                  </p>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* 強み */}
                    <div className="rounded-[var(--radius-xl)] bg-[var(--color-success-muted)] border border-[var(--color-success)]/20 px-4 py-3">
                      <p className="text-xs font-semibold text-[var(--color-success-foreground)] mb-2 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> 強み
                      </p>
                      <ul className="space-y-1">
                        {aiResult.strengths.map((s, i) => (
                          <li key={i} className="text-sm text-[var(--color-foreground)] flex items-start gap-1.5">
                            <span className="text-[var(--color-success)] mt-0.5">✓</span> {s}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* 課題 */}
                    <div className="rounded-[var(--radius-xl)] bg-[var(--color-warning-muted)] border border-[var(--color-warning)]/20 px-4 py-3">
                      <p className="text-xs font-semibold text-[var(--color-warning-foreground)] mb-2 flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> 課題
                      </p>
                      <ul className="space-y-1">
                        {aiResult.concerns.map((c, i) => (
                          <li key={i} className="text-sm text-[var(--color-foreground)] flex items-start gap-1.5">
                            <span className="text-[var(--color-warning)] mt-0.5">!</span> {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 改善提案リスト */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">優先改善提案</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {aiResult.suggestions.map((s, i) => (
                      <div
                        key={i}
                        className={cn(
                          'rounded-[var(--radius-xl)] border px-4 py-3',
                          s.priority === 'high'   && 'border-[var(--color-error)]/30 bg-[var(--color-error-muted)]',
                          s.priority === 'medium' && 'border-[var(--color-warning)]/30 bg-[var(--color-warning-muted)]',
                          s.priority === 'low'    && 'border-[var(--color-border)] bg-[var(--color-muted)]/30',
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <PriorityBadge priority={s.priority} />
                          <span className="text-sm font-semibold text-[var(--color-foreground)]">{s.title}</span>
                        </div>
                        <p className="text-sm text-[var(--color-foreground)] leading-relaxed">{s.detail}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 再生成ボタン */}
              <div className="flex justify-center">
                <button
                  onClick={fetchAISuggestions}
                  disabled={aiLoading}
                  className="flex items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] transition-colors disabled:opacity-50"
                >
                  <RefreshCw className="h-4 w-4" /> 再分析する
                </button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
