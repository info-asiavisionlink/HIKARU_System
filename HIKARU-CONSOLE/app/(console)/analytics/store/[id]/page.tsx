'use client'

import * as React from 'react'
import { use } from 'react'
import Link from 'next/link'
import { getStoreAnalyticsDetail } from '@/services/analytics.service'
import type { StoreAnalyticsDetail } from '@/services/analytics.service'
import {
  Card, CardContent, CardHeader, CardTitle, Skeleton, PageHeader, Badge,
} from '@hikaru/ui'
import { LineChart, HBarChart, ScoreRing, scoreColor } from '@/components/analytics/Charts'
import {
  ChevronLeft, MapPin, FileText, Sparkles, RefreshCw,
  CheckCircle2, AlertTriangle, XCircle, TrendingUp, TrendingDown, Minus,
} from 'lucide-react'
import { cn } from '@hikaru/ui'

interface AIStoreResult {
  trend: 'improving' | 'declining' | 'stable'
  issues: string[]
  suggestions: string[]
  summary: string
}

export default function StoreAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [detail,    setDetail]    = React.useState<StoreAnalyticsDetail | null>(null)
  const [loading,   setLoading]   = React.useState(true)
  const [aiResult,  setAiResult]  = React.useState<AIStoreResult | null>(null)
  const [aiLoading, setAiLoading] = React.useState(false)

  React.useEffect(() => {
    getStoreAnalyticsDetail(id).then((d) => {
      setDetail(d)
      setLoading(false)
    })
  }, [id])

  async function fetchAI() {
    setAiLoading(true)
    try {
      const res  = await fetch(`/api/ai/analyze?type=store&id=${id}`)
      const json = await res.json()
      if (json.success) setAiResult(json.data)
    } finally {
      setAiLoading(false)
    }
  }

  const lineData = (detail?.monthlyTrends ?? []).map((t) => ({ label: t.label, value: t.avgScore }))
  const barData  = (detail?.spotRankings ?? []).map((s) => ({ label: s.spotName, value: s.avgScore }))

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Link
          href="/analytics?tab=rankings"
          className="flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> 分析一覧
        </Link>
      </div>

      <PageHeader
        title={loading ? '読み込み中...' : (detail?.storeName ?? '店舗詳細')}
        description={detail?.clientName ?? undefined}
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 mb-6">
          {[1,2,3,4].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : detail ? (
        <>
          {/* KPIカード */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
            {[
              { label: '総作業回数', value: `${detail.totalJobs}回`, icon: '🗓️' },
              { label: '平均品質スコア', value: detail.avgScore != null ? `${detail.avgScore}点` : '—', icon: '⭐' },
              { label: '住所', value: detail.address ?? '未設定', icon: '📍' },
              { label: '最終作業日', value: detail.lastJobDate
                ? new Date(detail.lastJobDate).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
                : '—', icon: '📅' },
            ].map((c) => (
              <Card key={c.label}>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-[var(--color-muted-foreground)]">{c.label}</p>
                  <p className={cn('mt-1 text-base font-bold text-[var(--color-foreground)] leading-tight')}>
                    {c.value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* 品質スコアサマリー */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">品質スコア</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-3">
                <ScoreRing score={detail.avgScore} size={100} />
                <p className={cn('text-sm font-semibold', scoreColor(detail.avgScore))}>
                  {detail.avgScore != null
                    ? detail.avgScore >= 75 ? '良好な品質です'
                      : detail.avgScore >= 60 ? '改善の余地あり'
                      : '要改善'
                    : 'データなし'}
                </p>
              </CardContent>
            </Card>

            {/* 月別品質推移 */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">月別品質スコア推移（過去6ヶ月）</CardTitle>
              </CardHeader>
              <CardContent>
                <LineChart data={lineData} height={100} />
              </CardContent>
            </Card>

            {/* 箇所別品質（要改善順） */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">撮影箇所別 平均品質スコア（要改善順）</CardTitle>
              </CardHeader>
              <CardContent>
                {detail.spotRankings.length === 0 ? (
                  <p className="text-sm text-center text-[var(--color-muted-foreground)] py-6">データなし</p>
                ) : (
                  <HBarChart data={barData} maxValue={100} />
                )}
              </CardContent>
            </Card>

            {/* 最近の報告書 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">最近の報告書</CardTitle>
              </CardHeader>
              <CardContent>
                {detail.recentReports.length === 0 ? (
                  <p className="text-sm text-center text-[var(--color-muted-foreground)] py-6">報告書なし</p>
                ) : (
                  <div className="space-y-2">
                    {detail.recentReports.map((r: any) => (
                      <Link
                        key={r.id}
                        href={`/reports/${r.id}`}
                        className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-muted)]/30 px-3 py-2 hover:bg-[var(--color-muted)] transition-colors"
                      >
                        <div>
                          <p className="text-xs font-medium">Ver.{r.version}</p>
                          <p className="text-[10px] text-[var(--color-muted-foreground)]">
                            {new Date(r.created_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                        {r.overall_score != null && (
                          <span className={cn('text-sm font-bold tabular-nums', scoreColor(r.overall_score))}>
                            {r.overall_score}点
                          </span>
                        )}
                      </Link>
                    ))}
                    <Link
                      href="/reports"
                      className="block text-xs text-center text-[var(--color-primary)] hover:underline mt-1"
                    >
                      すべての報告書 →
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI分析 */}
            <Card className="lg:col-span-3">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-[var(--color-primary)]" />
                  <CardTitle className="text-sm">AI分析・改善提案</CardTitle>
                </div>
                {aiResult && (
                  <button
                    onClick={fetchAI}
                    disabled={aiLoading}
                    className="flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors"
                  >
                    <RefreshCw className={cn('h-3.5 w-3.5', aiLoading && 'animate-spin')} /> 再分析
                  </button>
                )}
              </CardHeader>
              <CardContent>
                {!aiResult && !aiLoading ? (
                  <div className="flex flex-col items-center py-8 text-center">
                    <p className="text-sm text-[var(--color-muted-foreground)] mb-4">
                      AIがこの店舗の品質データを分析し、改善提案を生成します
                    </p>
                    <button
                      onClick={fetchAI}
                      className="flex items-center gap-2 rounded-[var(--radius-lg)] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] transition-colors"
                    >
                      <Sparkles className="h-4 w-4" /> AI分析を実行
                    </button>
                  </div>
                ) : aiLoading ? (
                  <div className="flex flex-col items-center py-8">
                    <div className="h-8 w-8 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin mb-3" />
                    <p className="text-sm text-[var(--color-muted-foreground)]">AI分析中...</p>
                  </div>
                ) : aiResult && (
                  <div className="space-y-4">
                    <div className="rounded-[var(--radius-xl)] bg-[var(--color-primary-muted)] border border-[var(--color-primary)]/20 px-4 py-3">
                      <p className="text-sm leading-relaxed text-[var(--color-foreground)]">{aiResult.summary}</p>
                    </div>
                    {aiResult.issues.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-[var(--color-warning-foreground)] mb-2 flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5" /> 課題
                        </p>
                        <ul className="space-y-1">
                          {aiResult.issues.map((issue, i) => (
                            <li key={i} className="text-sm text-[var(--color-foreground)] flex items-start gap-1.5">
                              <span className="text-[var(--color-warning)] mt-0.5">!</span> {issue}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {aiResult.suggestions.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-[var(--color-primary)] mb-2 flex items-center gap-1">
                          改善提案
                        </p>
                        <ul className="space-y-1.5">
                          {aiResult.suggestions.map((s, i) => (
                            <li key={i} className="text-sm text-[var(--color-foreground)] flex items-start gap-1.5">
                              <span className="text-[var(--color-primary)] mt-0.5">→</span> {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-[var(--color-muted-foreground)]">店舗が見つかりませんでした</p>
          <Link href="/analytics" className="mt-2 text-sm text-[var(--color-primary)] hover:underline">← 戻る</Link>
        </div>
      )}
    </div>
  )
}
