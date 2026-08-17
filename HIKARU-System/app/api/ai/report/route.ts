import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  generateReportContent,
  calcWorkDuration,
  formatDateTime,
  formatDate,
  type ReportContent,
  type ReportSpot,
} from '@/modules/report-ai'
import type { SpotInput } from '@/modules/report-ai/prompts'

// ============================================================
// POST /api/ai/report — 報告書生成
// 認証: hk_s_uid cookie（ミドルウェア検証済み）
// ============================================================

export async function POST(req: NextRequest) {
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) {
    return Response.json({ success: false, error: { code: 'UNAUTHORIZED', message: '認証が必要です' } }, { status: 401 })
  }

  const { jobId } = await req.json()
  if (!jobId) {
    return Response.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'jobIdが必要です' } }, { status: 400 })
  }

  const admin = createAdminClient()

  try {
    // ---- データ収集 ----
    const { data: job } = await admin
      .from('jobs')
      .select(`
        id, project_id, worker_id, company_id,
        work_date, started_at, completed_at,
        projects(
          id, name, code, notes,
          location_name, phone, emergency_contact
        ),
        profiles(name)
      `)
      .eq('id', jobId)
      .eq('worker_id', uid)
      .single()

    if (!job) {
      return Response.json({ success: false, error: { code: 'NOT_FOUND', message: 'ジョブが見つかりません' } }, { status: 404 })
    }

    const project = (job as any).projects

    // ---- 写真取得 ----
    const { data: photos } = await admin
      .from('photos')
      .select('id, spot_id, photo_type, url')
      .eq('job_id', jobId)

    // ---- AI評価取得 ----
    const { data: evaluations } = await admin
      .from('ai_evaluations')
      .select('*, photo_spots(id, name, order_num, is_required)')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true })

    // ---- 撮影箇所一覧（project_id ベース） ----
    const { data: allSpots } = await admin
      .from('photo_spots')
      .select('id, name, order_num, is_required')
      .eq('project_id', job.project_id)
      .order('order_num', { ascending: true })

    // ---- データ統合 ----
    const photoMap: Record<string, { before?: any; after?: any }> = {}
    for (const p of (photos ?? [])) {
      if (!photoMap[p.spot_id]) photoMap[p.spot_id] = {}
      if (p.photo_type === 'before') photoMap[p.spot_id].before = p
      if (p.photo_type === 'after')  photoMap[p.spot_id].after  = p
    }

    const evalMap: Record<string, any> = {}
    for (const ev of (evaluations ?? [])) {
      evalMap[ev.spot_id] = ev
    }

    const reportSpots: ReportSpot[] = (allSpots ?? []).map((spot, idx) => {
      const ev   = evalMap[spot.id]
      const pair = photoMap[spot.id]
      return {
        name:             spot.name,
        order:            idx + 1,
        score:            ev?.score ?? null,
        recommendation:   ev?.recommendation ?? null,
        before_url:       pair?.before?.url  ?? null,
        after_url:        pair?.after?.url   ?? null,
        comparison:       ev?.comparison     ?? null,
        ai_comment:       '',
        improvements:     ev?.improvements      ?? [],
        remaining_issues: ev?.remaining_issues  ?? [],
      }
    })

    // ---- スコア集計 ----
    const scored = reportSpots.filter((s) => s.score !== null)
    const overallScore = scored.length > 0
      ? Math.round(scored.reduce((sum, s) => sum + (s.score ?? 0), 0) / scored.length)
      : 0

    const passedCount = reportSpots.filter((s) => s.recommendation === 'pass').length
    const checkCount  = reportSpots.filter((s) => s.recommendation === 'check').length
    const redoCount   = reportSpots.filter((s) => s.recommendation === 'redo').length

    // ---- AI生成 ----
    const spotInputs: SpotInput[] = reportSpots.map((s) => ({
      name:             s.name,
      score:            s.score,
      recommendation:   s.recommendation,
      comparison:       s.comparison,
      remaining_issues: s.remaining_issues,
      improvements:     s.improvements,
    }))

    const workerName  = (job as any).profiles?.name ?? '担当者'
    const workDate    = formatDate(job.work_date)
    const locationName = project?.location_name ?? project?.name ?? '—'

    const aiContent = await generateReportContent({
      storeName:    locationName,
      clientName:   '—',
      workDate,
      workerName,
      spots: spotInputs,
      overallScore,
    })

    // ---- AI コメントをスポットに設定 ----
    for (const spot of reportSpots) {
      spot.ai_comment = aiContent.spot_comments[spot.name] ?? `${spot.name}の清掃を実施しました。`
    }

    // ---- 報告書コンテンツ構築 ----
    const { data: existingReport } = await admin
      .from('reports')
      .select('version')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const version = (existingReport?.version ?? 0) + 1

    const content: ReportContent = {
      project: {
        name:  project?.name  ?? '—',
        code:  project?.code  ?? null,
        notes: project?.notes ?? null,
      },
      store: {
        name:    locationName,
        phone:   project?.phone ?? null,
      },
      client: { name: '—' },
      job: {
        work_date:    job.work_date,
        started_at:   job.started_at,
        completed_at: job.completed_at,
        worker_name:  workerName,
      },
      spots: reportSpots,
      summary: {
        overall_score:       overallScore,
        passed_count:        passedCount,
        check_count:         checkCount,
        redo_count:          redoCount,
        total_spots:         reportSpots.length,
        work_summary:        aiContent.work_summary,
        quality_assessment:  aiContent.quality_assessment,
        total_comment:       aiContent.total_comment,
        next_recommendations: aiContent.next_recommendations,
      },
      generated_at: new Date().toISOString(),
      version,
    }

    // ---- DB保存 ----
    const { data: saved, error: saveErr } = await admin
      .from('reports')
      .insert({
        job_id:        jobId,
        project_id:    job.project_id,
        worker_id:     uid,
        company_id:    job.company_id,
        version,
        content,
        overall_score: overallScore,
      })
      .select('id')
      .single()

    if (saveErr) console.error('[report] save error:', saveErr.message)

    return Response.json({ success: true, data: { reportId: saved?.id, content } })
  } catch (err) {
    console.error('[report] error:', (err as Error).message)
    return Response.json(
      { success: false, error: { code: 'AI_ERROR', message: (err as Error).message } },
      { status: 500 }
    )
  }
}

// ============================================================
// GET /api/ai/report?jobId=xxx — 報告書履歴取得
//     /api/ai/report?reportId=xxx — 単一報告書取得
// 認証: hk_s_uid cookie（ミドルウェア検証済み）
// ============================================================

export async function GET(req: NextRequest) {
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) {
    return Response.json({ success: false, error: { code: 'UNAUTHORIZED', message: '認証が必要です' } }, { status: 401 })
  }

  const jobId    = new URL(req.url).searchParams.get('jobId')
  const reportId = new URL(req.url).searchParams.get('reportId')

  const admin = createAdminClient()

  if (reportId) {
    // ---- reportId指定: report → job ownership確認 ----
    const { data, error } = await admin.from('reports').select('*').eq('id', reportId).single()
    if (error || !data) {
      return Response.json({ success: false, error: { code: 'NOT_FOUND', message: '報告書が見つかりません' } }, { status: 404 })
    }
    // report.job_id → jobs.worker_id === uid（他WorkerのReportへのアクセス防止）
    const { data: job } = await admin.from('jobs').select('id').eq('id', data.job_id).eq('worker_id', uid).maybeSingle()
    if (!job) {
      return Response.json({ success: false, error: { code: 'FORBIDDEN', message: 'このレポートへのアクセス権がありません' } }, { status: 403 })
    }
    return Response.json({ success: true, data })
  }

  if (!jobId) {
    return Response.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'jobIdが必要です' } }, { status: 400 })
  }

  // ---- jobId指定: job ownership確認してからreports取得 ----
  const { data: job } = await admin.from('jobs').select('id').eq('id', jobId).eq('worker_id', uid).maybeSingle()
  if (!job) {
    return Response.json({ success: false, error: { code: 'FORBIDDEN', message: 'このジョブへのアクセス権がありません' } }, { status: 403 })
  }

  const { data, error } = await admin
    .from('reports')
    .select('id, version, overall_score, created_at')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })

  if (error) {
    return Response.json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 })
  }

  return Response.json({ success: true, data: data ?? [] })
}
