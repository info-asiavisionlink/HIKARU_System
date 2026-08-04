'use client'

import * as React from 'react'
import { use } from 'react'
import Link from 'next/link'
import { getWorkerAnalyticsDetail } from '@/services/analytics.service'
import type { WorkerAnalyticsDetail } from '@/services/analytics.service'
import {
  Card, CardContent, CardHeader, CardTitle, Skeleton, PageHeader,
} from '@hikaru/ui'
import { LineChart, HBarChart, ScoreRing, scoreColor } from '@/components/analytics/Charts'
import {
  ChevronLeft, Sparkles, RefreshCw, CheckCircle2, AlertTriangle, MessageSquare,
} from 'lucide-react'
import { cn } from '@hikaru/ui'

interface AIWorkerResult {
  overallFeedback: string
  strengths: string[]
  improvements: string[]
  trainingAdvice: string
}

export default function WorkerAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [detail,    setDetail]    = React.useState<WorkerAnalyticsDetail | null>(null)
  const [loading,   setLoading]   = React.useState(true)
  const [aiResult,  setAiResult]  = React.useState<AIWorkerResult | null>(null)
  const [aiLoading, setAiLoading] = React.useState(false)

  React.useEffect(() => {
    getWorkerAnalyticsDetail(id).then((d) => {
      setDetail(d)
      setLoading(false)
    })
  }, [id])

  async function fetchAI() {
    setAiLoading(true)
    try {
      const res  = await fetch(`/api/ai/analyze?type=worker&id=${id}`)
      const json = await res.json()
      if (json.success) setAiResult(json.data)
    } finally {
      setAiLoading(false)
    }
  }

  const lineData = (detail?.monthlyTrends ?? []).map((t) => ({ label: t.label, value: t.avgScore }))
  const spotData = (detail?.spotScores ?? []).map((s) => ({ label: s.spotName, value: s.avgScore }))

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Link
          href="/analytics"
          className="flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> 分析一覧
        </Link>
      </div>

      <PageHeader
        title={loading ? '読み込み中...' : (detail?.workerName ?? '作業者詳細')}
        description="作業者パフォーマンス分析"
      />

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
          {[1,2,3,4].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : detail ? (
        <>
          {/* KPIカード */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-[var(--color-muted-foreground)]">総作業回数</p>
                <p className="mt-1 text-2xl font-bold text-[var(--color-foreground)]">{detail.totalJobs}回</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-[var(--color-muted-foreground)]">合格率</p>
                <p className={cn('mt-1 text-2xl font-bold', detail.passRate >= 70 ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]')}>
                  {detail.passRate}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-[var(--color-muted-foreground)]">再清掃回数</p>
                <p className={cn('mt-1 text-2xl font-bold', detail.redoCount === 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]')}>
                  {detail.redoCount}件
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-[var(--color-muted-foreground)]">AIチャット利用</p>
                <p className="mt-1 text-2xl font-bold text-[var(--color-foreground)]">{detail.chatCount}件</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* スコアリング */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">平均品質スコア</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-3 pt-2">
                <ScoreRing score={detail.avgScore} size={104} />
                <div className="w-full space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-[var(--color-success)]">
                      <CheckCircle2 className="h-3.5 w-3.5" /> 合格
                    </span>
                    <span className="font-semibold text-[var(--color-foreground)]">{detail.passRate}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--color-muted)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--color-success)] transition-all duration-700"
                      style={{ width: `${detail.passRate}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 月別スコア推移 */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">月別品質スコア推移（過去6ヶ月）</CardTitle>
              </CardHeader>
              <CardContent>
                <LineChart data={lineData} height={100} />
              </CardContent>
            </Card>

            {/* 箇所別スコア（要改善順） */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">撮影箇所別スコア（要改善順）</CardTitle>
              </CardHeader>
              <CardContent>
                {spotData.length === 0 ? (
                  <p className="text-sm text-center text-[var(--color-muted-foreground)] py-6">データなし</p>
                ) : (
                  <HBarChart data={spotData} maxValue={100} />
                )}
              </CardContent>
            </Card>

            {/* AIチャット活用 */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-[var(--color-primary)]" />
                  <CardTitle className="text-sm">AIチャット活用状況</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center gap-2 py-4">
                  <span className="text-4xl font-bold text-[var(--color-primary)]">{detail.chatCount}</span>
                  <span className="text-sm text-[var(--color-muted-foreground)]">件の質問履歴</span>
                  <p className="text-xs text-center text-[var(--color-muted-foreground)] mt-2">
                    {detail.chatCount >= 10
                      ? 'AIを積極的に活用しています'
                      : detail.chatCount >= 3
                      ? 'AIを適度に活用しています'
                      : 'AIチャットの活用を促進しましょう'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* AI フィードバック */}
            <Card className="lg:col-span-3">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-[var(--color-primary)]" />
                  <CardTitle className="text-sm">AIフィードバック</CardTitle>
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
                      AIがこの作業者のパフォーマンスを分析し、フィードバックを生成します
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
                      <p className="text-sm leading-relaxed text-[var(--color-foreground)]">{aiResult.overallFeedback}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      <div className="rounded-[var(--radius-xl)] bg-[var(--color-warning-muted)] border border-[var(--color-warning)]/20 px-4 py-3">
                        <p className="text-xs font-semibold text-[var(--color-warning-foreground)] mb-2 flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5" /> 改善点
                        </p>
                        <ul className="space-y-1">
                          {aiResult.improvements.map((imp, i) => (
                            <li key={i} className="text-sm text-[var(--color-foreground)] flex items-start gap-1.5">
                              <span className="text-[var(--color-warning)] mt-0.5">!</span> {imp}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    {aiResult.trainingAdvice && (
                      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-muted)]/40 px-4 py-3">
                        <p className="text-xs font-semibold text-[var(--color-muted-foreground)] mb-1">研修・教育アドバイス</p>
                        <p className="text-sm text-[var(--color-foreground)]">{aiResult.trainingAdvice}</p>
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
          <p className="text-[var(--color-muted-foreground)]">作業者が見つかりませんでした</p>
          <Link href="/analytics" className="mt-2 text-sm text-[var(--color-primary)] hover:underline">← 戻る</Link>
        </div>
      )}
    </div>
  )
}
