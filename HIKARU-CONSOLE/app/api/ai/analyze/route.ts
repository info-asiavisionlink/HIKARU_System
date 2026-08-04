import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  analyzeStoreData,
  analyzeOverview,
  analyzeTrends,
  analyzeWorkerPerformance,
} from '@/modules/analyze-ai'
import type { ApiResponse } from '@hikaru/types'

// ============================================================
// GET /api/ai/analyze
// ?type=overview | store&id=xxx | worker&id=xxx | trends
// ============================================================

export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<unknown>>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '認証が必要です' } },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const id   = searchParams.get('id')

  try {
    // ---- 全体サマリー分析 ----
    if (type === 'overview') {
      const [jobsRes, evalsRes, reportsRes] = await Promise.all([
        supabase.from('jobs').select('id, status, work_date'),
        supabase.from('ai_evaluations').select('score, recommendation'),
        supabase.from('reports').select('overall_score, created_at'),
      ])

      const evals  = evalsRes.data ?? []
      const scores = evals.map((e) => e.score).filter((s) => s != null) as number[]
      const avgScore = scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null

      const analysisData = {
        totalJobs:      jobsRes.data?.length ?? 0,
        completedJobs:  jobsRes.data?.filter((j) => j.status === 'completed').length ?? 0,
        avgQualityScore: avgScore,
        totalEvaluations: evals.length,
        passCount:      evals.filter((e) => e.recommendation === 'pass').length,
        checkCount:     evals.filter((e) => e.recommendation === 'check').length,
        redoCount:      evals.filter((e) => e.recommendation === 'redo').length,
        totalReports:   reportsRes.data?.length ?? 0,
        avgReportScore: reportsRes.data?.length
          ? Math.round(reportsRes.data.reduce((a, r) => a + (r.overall_score ?? 0), 0) / reportsRes.data.length)
          : null,
      }

      const { data: result, error } = await analyzeOverview(analysisData)
      if (error) throw error
      return NextResponse.json({ success: true, data: result })
    }

    // ---- 店舗分析 ----
    if (type === 'store' && id) {
      const [storeRes, projectsRes] = await Promise.all([
        supabase.from('stores').select('name').eq('id', id).single(),
        supabase.from('projects').select('id').eq('store_id', id),
      ])

      const projectIds = (projectsRes.data ?? []).map((p) => p.id)
      const jobsRes    = projectIds.length > 0
        ? await supabase.from('jobs').select('id, work_date').in('project_id', projectIds)
        : { data: [] }

      const jobIds  = (jobsRes.data ?? []).map((j) => j.id)
      const evalsRes = jobIds.length > 0
        ? await supabase.from('ai_evaluations')
            .select('job_id, score, recommendation, photo_spots(name)')
            .in('job_id', jobIds)
        : { data: [] }

      const evals  = evalsRes.data ?? []
      const scores = evals.map((e) => e.score).filter((s) => s != null) as number[]

      // spot別集計
      const spotMap: Record<string, number[]> = {}
      for (const ev of evals) {
        const name = (ev as any).photo_spots?.name as string | null
        if (name && ev.score != null) {
          if (!spotMap[name]) spotMap[name] = []
          spotMap[name].push(ev.score)
        }
      }

      const analysisData = {
        storeName:    storeRes.data?.name ?? '',
        totalJobs:    jobIds.length,
        avgScore:     scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
        passRate:     evals.length > 0
          ? Math.round((evals.filter((e) => e.recommendation === 'pass').length / evals.length) * 100)
          : 0,
        redoRate:     evals.length > 0
          ? Math.round((evals.filter((e) => e.recommendation === 'redo').length / evals.length) * 100)
          : 0,
        spotAverages: Object.fromEntries(
          Object.entries(spotMap).map(([name, sc]) => [
            name,
            Math.round(sc.reduce((a, b) => a + b, 0) / sc.length),
          ])
        ),
      }

      const { data: result, error } = await analyzeStoreData(storeRes.data?.name ?? '', analysisData)
      if (error) throw error
      return NextResponse.json({ success: true, data: result })
    }

    // ---- 作業者分析 ----
    if (type === 'worker' && id) {
      const [profileRes, jobsRes] = await Promise.all([
        supabase.from('profiles').select('name').eq('id', id).single(),
        supabase.from('jobs').select('id, work_date').eq('worker_id', id),
      ])

      const jobIds   = (jobsRes.data ?? []).map((j) => j.id)
      const evalsRes = jobIds.length > 0
        ? await supabase.from('ai_evaluations').select('score, recommendation').in('job_id', jobIds)
        : { data: [] }

      const evals  = evalsRes.data ?? []
      const scores = evals.map((e) => e.score).filter((s) => s != null) as number[]
      const avgScore = scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null

      const analysisData = {
        workerName:  profileRes.data?.name ?? '',
        totalJobs:   jobIds.length,
        avgScore,
        passCount:   evals.filter((e) => e.recommendation === 'pass').length,
        checkCount:  evals.filter((e) => e.recommendation === 'check').length,
        redoCount:   evals.filter((e) => e.recommendation === 'redo').length,
        passRate:    evals.length > 0
          ? Math.round((evals.filter((e) => e.recommendation === 'pass').length / evals.length) * 100)
          : 0,
      }

      const { data: result, error } = await analyzeWorkerPerformance(profileRes.data?.name ?? '', analysisData)
      if (error) throw error
      return NextResponse.json({ success: true, data: result })
    }

    // ---- 時系列トレンド分析 ----
    if (type === 'trends') {
      const now    = new Date()
      const months: string[] = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
      }
      const startDate = months[0] + '-01'

      const [jobsRes, evalsRes] = await Promise.all([
        supabase.from('jobs').select('id, work_date').gte('work_date', startDate),
        supabase.from('ai_evaluations')
          .select('job_id, score, recommendation, photo_spots(name)')
          .gte('created_at', startDate + 'T00:00:00Z'),
      ])

      const jobMonthMap: Record<string, string> = {}
      for (const job of (jobsRes.data ?? [])) {
        jobMonthMap[job.id] = job.work_date.substring(0, 7)
      }

      const monthData: Record<string, { scores: number[]; recs: string[] }> = {}
      const spotMonthData: Record<string, Record<string, number[]>> = {}

      for (const ev of (evalsRes.data ?? [])) {
        const month = jobMonthMap[ev.job_id]
        if (!month) continue
        if (!monthData[month]) monthData[month] = { scores: [], recs: [] }
        if (ev.score != null) monthData[month].scores.push(ev.score)
        if (ev.recommendation) monthData[month].recs.push(ev.recommendation)

        const spotName = (ev as any).photo_spots?.name as string | null
        if (spotName && ev.score != null) {
          if (!spotMonthData[spotName]) spotMonthData[spotName] = {}
          if (!spotMonthData[spotName][month]) spotMonthData[spotName][month] = []
          spotMonthData[spotName][month].push(ev.score)
        }
      }

      const monthlyTrends = months.map((m) => {
        const d = monthData[m]
        return {
          month: m,
          avgScore: d?.scores.length
            ? Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length)
            : null,
          redoRate: d?.recs.length
            ? Math.round((d.recs.filter((r) => r === 'redo').length / d.recs.length) * 100)
            : 0,
        }
      })

      const spotTrends = Object.fromEntries(
        Object.entries(spotMonthData).map(([spot, data]) => [
          spot,
          months.map((m) => {
            const sc = data[m] ?? []
            return { month: m, avgScore: sc.length ? Math.round(sc.reduce((a, b) => a + b, 0) / sc.length) : null }
          }),
        ])
      )

      const { data: result, error } = await analyzeTrends({ monthlyTrends, spotTrends })
      if (error) throw error
      return NextResponse.json({ success: true, data: result })
    }

    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'typeパラメーターが不正です' } },
      { status: 400 }
    )
  } catch (err) {
    console.error('[analyze] error:', (err as Error).message)
    return NextResponse.json(
      { success: false, error: { code: 'AI_ERROR', message: (err as Error).message } },
      { status: 500 }
    )
  }
}
