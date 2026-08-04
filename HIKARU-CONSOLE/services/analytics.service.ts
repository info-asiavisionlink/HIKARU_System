import { createClient } from '@/lib/supabase/client'

// ============================================================
// 型定義
// ============================================================

export interface AnalyticsOverview {
  totalJobs: number
  activeJobs: number
  completedJobs: number
  totalPhotos: number
  avgQualityScore: number | null
  totalReports: number
  totalEvaluations: number
  redoCount: number
  passCount: number
  checkCount: number
  passRate: number         // 0-100
  redoRate: number         // 0-100
  thisMonthJobs: number
  chatCount: number
  totalProjects: number
  totalStores: number
}

export interface MonthlyTrend {
  month: string   // "2026-08"
  label: string   // "8月"
  avgScore: number | null
  jobCount: number
}

export interface StoreRanking {
  storeId: string
  storeName: string
  avgScore: number | null
  jobCount: number
  lastJobDate: string | null
}

export interface WorkerRanking {
  workerId: string
  workerName: string
  avgScore: number | null
  jobCount: number
  redoCount: number
  passRate: number
}

export interface SpotQualityRank {
  spotName: string
  avgScore: number
  evalCount: number
  redoRate: number
}

export interface QualityDistribution {
  range: string
  label: string
  count: number
  pct: number
}

export interface StoreAnalyticsDetail {
  storeId: string
  storeName: string
  clientName: string | null
  address: string | null
  totalJobs: number
  avgScore: number | null
  lastJobDate: string | null
  monthlyTrends: MonthlyTrend[]
  spotRankings: SpotQualityRank[]
  recentReports: { id: string; created_at: string; overall_score: number | null; version: number }[]
}

export interface WorkerAnalyticsDetail {
  workerId: string
  workerName: string
  totalJobs: number
  avgScore: number | null
  redoCount: number
  passRate: number
  chatCount: number
  monthlyTrends: MonthlyTrend[]
  spotScores: SpotQualityRank[]
}

// ============================================================
// ヘルパー
// ============================================================

function monthLabel(ym: string): string {
  const [, m] = ym.split('-')
  return `${parseInt(m)}月`
}

function getLast12Months(): string[] {
  const months: string[] = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

function getLast6Months(): string[] {
  return getLast12Months().slice(-6)
}

// ============================================================
// 概要統計
// ============================================================

export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  const supabase = createClient()
  const now      = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [jobsRes, photosRes, evalsRes, reportsRes, chatsRes, projectsRes, storesRes, monthJobsRes] =
    await Promise.all([
      supabase.from('jobs').select('id, status'),
      supabase.from('photos').select('id', { count: 'exact', head: true }),
      supabase.from('ai_evaluations').select('score, recommendation'),
      supabase.from('reports').select('id', { count: 'exact', head: true }),
      supabase.from('chat_messages').select('id', { count: 'exact', head: true }),
      supabase.from('projects').select('id', { count: 'exact', head: true }),
      supabase.from('stores').select('id', { count: 'exact', head: true }),
      supabase.from('jobs').select('id', { count: 'exact', head: true }).gte('created_at', thisMonthStart),
    ])

  const jobs     = jobsRes.data ?? []
  const evals    = evalsRes.data ?? []
  const scored   = evals.filter((e) => e.score != null)
  const avgScore = scored.length > 0
    ? Math.round(scored.reduce((a, e) => a + (e.score ?? 0), 0) / scored.length)
    : null

  const passCount  = evals.filter((e) => e.recommendation === 'pass').length
  const checkCount = evals.filter((e) => e.recommendation === 'check').length
  const redoCount  = evals.filter((e) => e.recommendation === 'redo').length
  const total      = evals.length

  return {
    totalJobs:       jobs.length,
    activeJobs:      jobs.filter((j) => j.status === 'in_progress').length,
    completedJobs:   jobs.filter((j) => j.status === 'completed').length,
    totalPhotos:     photosRes.count  ?? 0,
    avgQualityScore: avgScore,
    totalReports:    reportsRes.count ?? 0,
    totalEvaluations: total,
    redoCount,
    passCount,
    checkCount,
    passRate:        total > 0 ? Math.round((passCount / total) * 100) : 0,
    redoRate:        total > 0 ? Math.round((redoCount / total) * 100) : 0,
    thisMonthJobs:   monthJobsRes.count ?? 0,
    chatCount:       chatsRes.count    ?? 0,
    totalProjects:   projectsRes.count ?? 0,
    totalStores:     storesRes.count   ?? 0,
  }
}

// ============================================================
// 月別品質トレンド（過去12ヶ月）
// ============================================================

export async function getMonthlyTrends(): Promise<MonthlyTrend[]> {
  const supabase  = createClient()
  const months    = getLast12Months()
  const startDate = months[0] + '-01'

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, work_date')
    .gte('work_date', startDate)

  const { data: evals } = await supabase
    .from('ai_evaluations')
    .select('job_id, score')
    .gte('created_at', startDate + 'T00:00:00Z')

  // job_id -> month マップ
  const jobMonthMap: Record<string, string> = {}
  for (const job of (jobs ?? [])) {
    jobMonthMap[job.id] = job.work_date.substring(0, 7) // "2026-08"
  }

  // month -> scores
  const monthScores: Record<string, number[]> = {}
  const monthJobCount: Record<string, Set<string>> = {}

  for (const ev of (evals ?? [])) {
    const month = jobMonthMap[ev.job_id]
    if (!month) continue
    if (!monthScores[month])   monthScores[month]   = []
    if (!monthJobCount[month]) monthJobCount[month] = new Set()
    if (ev.score != null) monthScores[month].push(ev.score)
    monthJobCount[month].add(ev.job_id)
  }

  return months.map((m) => {
    const scores  = monthScores[m] ?? []
    const avgScore = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null
    return {
      month:    m,
      label:    monthLabel(m),
      avgScore,
      jobCount: monthJobCount[m]?.size ?? 0,
    }
  })
}

// ============================================================
// 店舗品質ランキング
// ============================================================

export async function getStoreRankings(): Promise<StoreRanking[]> {
  const supabase = createClient()

  // jobs → photo_spots → stores 経路でスコアを集計
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, work_date, projects(store_id, stores(id, name))')

  const { data: evals } = await supabase
    .from('ai_evaluations')
    .select('job_id, score')

  // storeId -> { scores, lastDate }
  const storeData: Record<string, { name: string; scores: number[]; lastDate: string }> = {}

  for (const job of (jobs ?? [])) {
    const storeId   = (job as any).projects?.store_id as string | null
    const storeName = (job as any).projects?.stores?.name as string | null
    if (!storeId || !storeName) continue

    if (!storeData[storeId]) {
      storeData[storeId] = { name: storeName, scores: [], lastDate: '' }
    }
    if (job.work_date > (storeData[storeId].lastDate ?? '')) {
      storeData[storeId].lastDate = job.work_date
    }
  }

  // job_id -> storeId マップ
  const jobStoreMap: Record<string, string> = {}
  for (const job of (jobs ?? [])) {
    const storeId = (job as any).projects?.store_id as string | null
    if (storeId) jobStoreMap[job.id] = storeId
  }

  for (const ev of (evals ?? [])) {
    const storeId = jobStoreMap[ev.job_id]
    if (!storeId || !storeData[storeId]) continue
    if (ev.score != null) storeData[storeId].scores.push(ev.score)
  }

  // Job count per store
  const jobCount: Record<string, number> = {}
  for (const job of (jobs ?? [])) {
    const storeId = jobStoreMap[job.id]
    if (storeId) jobCount[storeId] = (jobCount[storeId] ?? 0) + 1
  }

  return Object.entries(storeData)
    .map(([storeId, d]) => ({
      storeId,
      storeName:   d.name,
      avgScore:    d.scores.length > 0 ? Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length) : null,
      jobCount:    jobCount[storeId] ?? 0,
      lastJobDate: d.lastDate || null,
    }))
    .filter((r) => r.avgScore != null)
    .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0))
}

// ============================================================
// 作業者ランキング
// ============================================================

export async function getWorkerRankings(): Promise<WorkerRanking[]> {
  const supabase = createClient()

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, worker_id, profiles(name)')

  const { data: evals } = await supabase
    .from('ai_evaluations')
    .select('job_id, score, recommendation')

  // worker -> { scores, redoCount }
  const workerData: Record<string, { name: string; scores: number[]; redoCount: number; passCount: number; totalEvals: number }> = {}
  const jobWorkerMap: Record<string, string> = {}

  for (const job of (jobs ?? [])) {
    if (!job.worker_id) continue
    const name = (job as any).profiles?.name ?? '不明'
    if (!workerData[job.worker_id]) {
      workerData[job.worker_id] = { name, scores: [], redoCount: 0, passCount: 0, totalEvals: 0 }
    }
    jobWorkerMap[job.id] = job.worker_id
  }

  for (const ev of (evals ?? [])) {
    const wid = jobWorkerMap[ev.job_id]
    if (!wid || !workerData[wid]) continue
    workerData[wid].totalEvals++
    if (ev.score != null) workerData[wid].scores.push(ev.score)
    if (ev.recommendation === 'redo') workerData[wid].redoCount++
    if (ev.recommendation === 'pass') workerData[wid].passCount++
  }

  const jobCount: Record<string, number> = {}
  for (const job of (jobs ?? [])) {
    if (job.worker_id) jobCount[job.worker_id] = (jobCount[job.worker_id] ?? 0) + 1
  }

  return Object.entries(workerData)
    .map(([workerId, d]) => ({
      workerId,
      workerName: d.name,
      avgScore:   d.scores.length > 0 ? Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length) : null,
      jobCount:   jobCount[workerId] ?? 0,
      redoCount:  d.redoCount,
      passRate:   d.totalEvals > 0 ? Math.round((d.passCount / d.totalEvals) * 100) : 0,
    }))
    .filter((r) => r.avgScore != null)
    .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0))
}

// ============================================================
// 品質スコア分布
// ============================================================

export async function getQualityDistribution(): Promise<QualityDistribution[]> {
  const supabase = createClient()
  const { data } = await supabase.from('ai_evaluations').select('score')
  const scores   = (data ?? []).map((e) => e.score).filter((s) => s != null) as number[]

  const ranges = [
    { range: '90-100', label: '90〜100点（優秀）', min: 90, max: 100 },
    { range: '75-89',  label: '75〜89点（良好）',  min: 75, max: 89 },
    { range: '60-74',  label: '60〜74点（普通）',  min: 60, max: 74 },
    { range: '45-59',  label: '45〜59点（要改善）', min: 45, max: 59 },
    { range: '0-44',   label: '0〜44点（不合格）',  min: 0,  max: 44 },
  ]

  const total = scores.length
  return ranges.map((r) => {
    const count = scores.filter((s) => s >= r.min && s <= r.max).length
    return {
      range: r.range,
      label: r.label,
      count,
      pct:   total > 0 ? Math.round((count / total) * 100) : 0,
    }
  })
}

// ============================================================
// 撮影箇所別品質ランキング
// ============================================================

export async function getSpotQualityRankings(): Promise<SpotQualityRank[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('ai_evaluations')
    .select('score, recommendation, photo_spots(name)')

  const spotData: Record<string, { scores: number[]; redoCount: number; total: number }> = {}

  for (const ev of (data ?? [])) {
    const name = (ev as any).photo_spots?.name as string | null
    if (!name) continue
    if (!spotData[name]) spotData[name] = { scores: [], redoCount: 0, total: 0 }
    spotData[name].total++
    if (ev.score != null) spotData[name].scores.push(ev.score)
    if (ev.recommendation === 'redo') spotData[name].redoCount++
  }

  return Object.entries(spotData)
    .map(([spotName, d]) => ({
      spotName,
      avgScore:  d.scores.length > 0 ? Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length) : 0,
      evalCount: d.total,
      redoRate:  d.total > 0 ? Math.round((d.redoCount / d.total) * 100) : 0,
    }))
    .sort((a, b) => b.avgScore - a.avgScore)
}

// ============================================================
// 店舗詳細分析
// ============================================================

export async function getStoreAnalyticsDetail(storeId: string): Promise<StoreAnalyticsDetail | null> {
  const supabase = createClient()
  const months   = getLast6Months()
  const startDate = months[0] + '-01'

  const [storeRes, projectsRes] = await Promise.all([
    supabase.from('stores').select('id, name, address, clients(name)').eq('id', storeId).single(),
    supabase.from('projects').select('id').eq('store_id', storeId),
  ])

  if (!storeRes.data) return null

  const projectIds = (projectsRes.data ?? []).map((p) => p.id)
  if (projectIds.length === 0) {
    return {
      storeId,
      storeName:   storeRes.data.name,
      clientName:  (storeRes.data as any).clients?.name ?? null,
      address:     storeRes.data.address ?? null,
      totalJobs:   0,
      avgScore:    null,
      lastJobDate: null,
      monthlyTrends: months.map((m) => ({ month: m, label: monthLabel(m), avgScore: null, jobCount: 0 })),
      spotRankings:  [],
      recentReports: [],
    }
  }

  const [jobsRes, reportsRes] = await Promise.all([
    supabase.from('jobs').select('id, work_date').in('project_id', projectIds),
    supabase.from('reports').select('id, created_at, overall_score, version')
      .in('project_id', projectIds)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const jobIds = (jobsRes.data ?? []).map((j) => j.id)
  const { data: evals } = jobIds.length > 0
    ? await supabase.from('ai_evaluations').select('job_id, score, recommendation, photo_spots(name)')
        .in('job_id', jobIds)
    : { data: [] }

  // avg score
  const scores = (evals ?? []).map((e) => e.score).filter((s) => s != null) as number[]
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null

  // last job date
  const lastJobDate = (jobsRes.data ?? [])
    .map((j) => j.work_date)
    .sort()
    .pop() ?? null

  // monthly trends
  const jobMonthMap: Record<string, string> = {}
  for (const job of (jobsRes.data ?? [])) {
    jobMonthMap[job.id] = job.work_date.substring(0, 7)
  }

  const monthScores: Record<string, number[]> = {}
  const monthJobSet: Record<string, Set<string>> = {}
  for (const ev of (evals ?? [])) {
    const month = jobMonthMap[ev.job_id]
    if (!month) continue
    if (!monthScores[month])  monthScores[month]  = []
    if (!monthJobSet[month])  monthJobSet[month]  = new Set()
    if (ev.score != null) monthScores[month].push(ev.score)
    monthJobSet[month].add(ev.job_id)
  }

  const monthlyTrends: MonthlyTrend[] = months.map((m) => {
    const sc = monthScores[m] ?? []
    return {
      month: m,
      label: monthLabel(m),
      avgScore: sc.length > 0 ? Math.round(sc.reduce((a, b) => a + b, 0) / sc.length) : null,
      jobCount: monthJobSet[m]?.size ?? 0,
    }
  })

  // spot rankings
  const spotData: Record<string, { scores: number[]; redoCount: number; total: number }> = {}
  for (const ev of (evals ?? [])) {
    const name = (ev as any).photo_spots?.name as string | null
    if (!name) continue
    if (!spotData[name]) spotData[name] = { scores: [], redoCount: 0, total: 0 }
    spotData[name].total++
    if (ev.score != null) spotData[name].scores.push(ev.score)
    if (ev.recommendation === 'redo') spotData[name].redoCount++
  }
  const spotRankings = Object.entries(spotData)
    .map(([spotName, d]) => ({
      spotName,
      avgScore:  d.scores.length > 0 ? Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length) : 0,
      evalCount: d.total,
      redoRate:  d.total > 0 ? Math.round((d.redoCount / d.total) * 100) : 0,
    }))
    .sort((a, b) => a.avgScore - b.avgScore) // 問題の大きい順

  return {
    storeId,
    storeName:   storeRes.data.name,
    clientName:  (storeRes.data as any).clients?.name ?? null,
    address:     storeRes.data.address ?? null,
    totalJobs:   jobsRes.data?.length ?? 0,
    avgScore,
    lastJobDate,
    monthlyTrends,
    spotRankings,
    recentReports: (reportsRes.data ?? []) as any,
  }
}

// ============================================================
// 作業者詳細分析
// ============================================================

export async function getWorkerAnalyticsDetail(workerId: string): Promise<WorkerAnalyticsDetail | null> {
  const supabase = createClient()
  const months   = getLast6Months()
  const startDate = months[0] + '-01'

  const [profileRes, jobsRes, chatRes] = await Promise.all([
    supabase.from('profiles').select('id, name').eq('id', workerId).single(),
    supabase.from('jobs').select('id, work_date').eq('worker_id', workerId),
    supabase.from('chat_messages').select('id', { count: 'exact', head: true }).eq('role', 'user')
      .in('job_id',
        (await supabase.from('jobs').select('id').eq('worker_id', workerId)).data?.map((j) => j.id) ?? []
      ),
  ])

  if (!profileRes.data) return null

  const jobIds = (jobsRes.data ?? []).map((j) => j.id)
  const { data: evals } = jobIds.length > 0
    ? await supabase.from('ai_evaluations').select('job_id, score, recommendation, photo_spots(name)').in('job_id', jobIds)
    : { data: [] }

  const scores   = (evals ?? []).map((e) => e.score).filter((s) => s != null) as number[]
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
  const redoCount = (evals ?? []).filter((e) => e.recommendation === 'redo').length
  const passCount = (evals ?? []).filter((e) => e.recommendation === 'pass').length
  const passRate  = evals && evals.length > 0 ? Math.round((passCount / evals.length) * 100) : 0

  // monthly trends
  const jobMonthMap: Record<string, string> = {}
  for (const job of (jobsRes.data ?? [])) {
    jobMonthMap[job.id] = job.work_date.substring(0, 7)
  }
  const monthScores: Record<string, number[]> = {}
  const monthJobSet: Record<string, Set<string>> = {}
  for (const ev of (evals ?? [])) {
    const month = jobMonthMap[ev.job_id]
    if (!month) continue
    if (!monthScores[month]) monthScores[month] = []
    if (!monthJobSet[month]) monthJobSet[month] = new Set()
    if (ev.score != null) monthScores[month].push(ev.score)
    monthJobSet[month].add(ev.job_id)
  }
  const monthlyTrends: MonthlyTrend[] = months.map((m) => {
    const sc = monthScores[m] ?? []
    return {
      month: m, label: monthLabel(m),
      avgScore: sc.length > 0 ? Math.round(sc.reduce((a, b) => a + b, 0) / sc.length) : null,
      jobCount: monthJobSet[m]?.size ?? 0,
    }
  })

  // spot scores
  const spotData: Record<string, { scores: number[]; redoCount: number; total: number }> = {}
  for (const ev of (evals ?? [])) {
    const name = (ev as any).photo_spots?.name as string | null
    if (!name) continue
    if (!spotData[name]) spotData[name] = { scores: [], redoCount: 0, total: 0 }
    spotData[name].total++
    if (ev.score != null) spotData[name].scores.push(ev.score)
    if (ev.recommendation === 'redo') spotData[name].redoCount++
  }
  const spotScores = Object.entries(spotData)
    .map(([spotName, d]) => ({
      spotName,
      avgScore:  d.scores.length > 0 ? Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length) : 0,
      evalCount: d.total,
      redoRate:  d.total > 0 ? Math.round((d.redoCount / d.total) * 100) : 0,
    }))
    .sort((a, b) => a.avgScore - b.avgScore)

  return {
    workerId,
    workerName:    profileRes.data.name,
    totalJobs:     jobsRes.data?.length ?? 0,
    avgScore,
    redoCount,
    passRate,
    chatCount:     chatRes.count ?? 0,
    monthlyTrends,
    spotScores,
  }
}
