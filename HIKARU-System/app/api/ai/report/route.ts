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

// Vercel Pro: Node.js runtime — allow up to 90s for OpenAI(60s) + DB ops + response margin
export const maxDuration = 90

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
        id, project_id, worker_id, company_id, status,
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

    // JOB-C6A: completed Jobへの報告書生成をブロック（ownership確認後、OpenAI call前）
    if ((job as any).status === 'completed') {
      return Response.json(
        { success: false, error: { code: 'JOB_ALREADY_COMPLETED', message: 'この作業は既に完了しているため変更できません。' } },
        { status: 409 },
      )
    }

    // Dedup: 既存Report確認（OpenAI callより前 — 二重生成・連打防止）
    // NOTE: reports.job_id にUNIQUE制約がないため同時requestでのrace conditionは
    //       DBレベルでは防止できない。UI連打・画面再遷移による重複は防止する。
    const { data: existingReport } = await admin
      .from('reports')
      .select('id, version, content, overall_score')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingReport) {
      return Response.json({
        success: true,
        data: { reportId: (existingReport as any).id, content: (existingReport as any).content },
      })
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
    // dedupチェックで既存なしが確認済みのため version = 1 が確定
    const version = 1

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

    if (saveErr) {
      console.error('[report] save error:', saveErr.message)
      return Response.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'レポートの保存に失敗しました' } },
        { status: 500 },
      )
    }

    // 報告書生成のたびに管理者へSystem通知（fire-and-forget・報告書処理を失敗させない）
    if (saved?.id) {
      void notifyAdminsOfReportSubmitted({
        reportId:    saved.id,
        companyId:   job.company_id,
        workerName,
        projectName: project?.name ?? '—',
        overallScore,
        version,
      })
    }

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
// 管理者System通知: 作業完了報告（fire-and-forget）
// ============================================================

async function notifyAdminsOfReportSubmitted({
  reportId, companyId, workerName, projectName, overallScore, version,
}: {
  reportId: string; companyId: string; workerName: string
  projectName: string; overallScore: number; version: number
}): Promise<void> {
  try {
    const admin = createAdminClient()

    const { data: admins } = await admin
      .from('profiles')
      .select('id')
      .eq('company_id', companyId)
      .eq('role', 'admin')

    if (!admins || admins.length === 0) return

    const title = version === 1 ? '作業完了報告が届きました' : '報告書が更新されました'
    const rows = admins.map((a: { id: string }) => ({
      company_id:           companyId,
      recipient_profile_id: a.id,
      title,
      body:                 `${workerName}さんが「${projectName}」の報告書を${version === 1 ? '提出' : '更新'}しました。スコア: ${overallScore}点`,
      type:                 'project_report_submitted',
      target_app:           'console',
      is_read:              false,
      target_url:           `/reports/${reportId}`,
    }))

    const { error } = await admin.from('notifications').insert(rows)
    if (error) console.error('[Admin通知] 報告書通知挿入失敗:', error.message)
  } catch (e) {
    console.error('[Admin通知] 報告書通知 予期しないエラー:', e)
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
