import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { evaluateBeforeAfter, checkPhotoQuality } from '@/modules/quality-ai'

// ============================================================
// Manual Context Builder（QUALITY-MG）
// AI callなし。project + company manuals を直接取得。
// company_id は job.project_id → projects.company_id で解決（tenant isolation）。
// ============================================================

interface QualityManualRow { type: string; title: string; content: string | null; source: 'project' | 'company' }

const QUALITY_MANUAL_TYPES   = new Set(['note', 'faq', 'text'])
const MANUAL_CONTEXT_MAX_CHARS  = 600   // 1 Manualあたり上限
const TOTAL_MANUAL_CONTEXT_MAX  = 1500  // 全Manual合計上限

function getManualRelevance(manual: QualityManualRow, spotName: string, spotDesc: string): number {
  if (manual.source === 'project') return 100
  const target = `${spotName} ${spotDesc}`.toLowerCase()
  const source = (manual.title ?? '').toLowerCase()
  if (spotName.length > 0 && source.includes(spotName.toLowerCase())) return 3
  const words = target.split(/[\s・、。]+/).filter((w) => w.length >= 2)
  return words.filter((w) => source.includes(w)).length > 0 ? 1 : 0
}

function buildQualityManualContext(manuals: QualityManualRow[], spotName = '', spotDesc = ''): string {
  const filtered = manuals.filter((m) => QUALITY_MANUAL_TYPES.has(m.type) && m.content && m.content.trim().length > 0)
  if (filtered.length === 0) return ''
  const scored = filtered.map((m) => ({ m, score: getManualRelevance(m, spotName, spotDesc) }))
  scored.sort((a, b) => b.score - a.score)
  const parts = scored.map(({ m }) => {
    const prefix = m.source === 'project' ? '【案件指示】' : '【会社基準】'
    const body   = (m.content ?? '').trim().slice(0, MANUAL_CONTEXT_MAX_CHARS)
    return `${prefix}「${m.title}」\n${body}`
  })
  return parts.join('\n\n').slice(0, TOTAL_MANUAL_CONTEXT_MAX)
}

async function fetchQualityManuals(admin: any, projectId: string, companyId: string): Promise<QualityManualRow[]> {
  const [{ data: pManuals }, { data: cManuals }] = await Promise.all([
    admin.from('manuals').select('type, title, content')
      .eq('project_id', projectId).order('order_num', { ascending: true }),
    admin.from('manuals').select('type, title, content')
      .eq('company_id', companyId).eq('is_template', true).is('project_id', null)
      .order('order_num', { ascending: true }),
  ])
  return [
    ...((pManuals ?? []) as any[]).map((m: any) => ({ ...m, source: 'project' as const })),
    ...((cManuals ?? []) as any[]).map((m: any) => ({ ...m, source: 'company' as const })),
  ]
}

async function getProjectCompanyId(admin: any, projectId: string): Promise<string | null> {
  const { data } = await admin.from('projects').select('company_id').eq('id', projectId).single()
  return (data as any)?.company_id ?? null
}

// ============================================================
// Evaluation Freshness（QUALITY-FRESH）
// URL完全一致のみFRESH。NULL = STALE（撮影URL不明な旧評価）。
// ============================================================

function isEvaluationFresh(
  evaluation: { evaluated_before_url: string | null; evaluated_after_url: string | null } | null | undefined,
  currentBeforeUrl: string,
  currentAfterUrl:  string,
): boolean {
  return !!(
    evaluation?.evaluated_before_url &&
    evaluation?.evaluated_after_url &&
    evaluation.evaluated_before_url === currentBeforeUrl &&
    evaluation.evaluated_after_url  === currentAfterUrl
  )
}

// ============================================================
// POST /api/ai/quality
// action: 'check' | 'evaluate' | 'evaluate-all'
// 認証: hk_s_uid cookie（ミドルウェア検証済み）
// ============================================================

export async function POST(req: NextRequest) {
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) {
    return Response.json({ success: false, error: { code: 'UNAUTHORIZED', message: '認証が必要です' } }, { status: 401 })
  }

  const body = await req.json()
  const { action } = body
  const admin = createAdminClient()

  switch (action) {
    case 'check':        return handlePhotoCheck(body)
    case 'evaluate':     return handleEvaluate(body, uid, admin)
    case 'evaluate-all': return handleEvaluateAll(body, uid, admin)
    default:
      return Response.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'actionが不正です' } }, { status: 400 })
  }
}

// ---- 写真品質チェック ----
async function handlePhotoCheck(body: any) {
  const { photoUrl, locationName } = body
  if (!photoUrl || !locationName) {
    return Response.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'パラメータ不足' } }, { status: 400 })
  }

  try {
    const result = await checkPhotoQuality(photoUrl, locationName)
    return Response.json({ success: true, data: result })
  } catch (err) {
    return Response.json({ success: false, error: { code: 'AI_ERROR', message: (err as Error).message } }, { status: 500 })
  }
}

// ---- 単一スポット評価 ----
async function handleEvaluate(body: any, uid: string, admin: any) {
  const { jobId, spotId, beforeUrl, afterUrl, beforePhotoId, afterPhotoId } = body

  if (!jobId || !spotId || !beforeUrl || !afterUrl) {
    return Response.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'パラメータ不足' } }, { status: 400 })
  }

  // Job ownership確認（project_idも同時取得）
  const { data: job } = await admin.from('jobs').select('id, status, project_id').eq('id', jobId).eq('worker_id', uid).maybeSingle()
  if (!job) {
    return Response.json({ success: false, error: { code: 'FORBIDDEN', message: 'このジョブへのアクセス権がありません' } }, { status: 403 })
  }
  // JOB-C6A: completed JobへのAI評価をブロック（ownership確認後、AI call前）
  if (job.status === 'completed') {
    return Response.json(
      { success: false, error: { code: 'JOB_ALREADY_COMPLETED', message: 'この作業は既に完了しているため変更できません。' } },
      { status: 409 },
    )
  }

  // QUALITY-FRESH: 同じBefore/AfterURLなら既存評価を返す（Vision AI 0 call）
  const { data: cachedEval } = await admin
    .from('ai_evaluations')
    .select('evaluated_before_url, evaluated_after_url, score, passed, recommendation, comment, comparison, improvements, remaining_issues, dirty_removal, thoroughness, shine, before_summary, after_summary, photo_quality_ok, photo_quality_issues')
    .eq('job_id', jobId)
    .eq('spot_id', spotId)
    .maybeSingle()

  if (isEvaluationFresh(cachedEval, beforeUrl, afterUrl)) {
    return Response.json({ success: true, data: cachedEval, fromCache: true })
  }

  // 撮影箇所名・descriptionを取得
  const { data: spot } = await admin.from('photo_spots').select('name, description').eq('id', spotId).single()
  const locationName = (spot as any)?.name        ?? '撮影箇所'
  const spotDesc     = (spot as any)?.description ?? ''

  // QUALITY-MG: Manual Context構築（AI callなし・失敗時はGeneric評価にfallback）
  let manualContext = ''
  try {
    if (job.project_id) {
      const companyId = await getProjectCompanyId(admin, job.project_id)
      if (companyId) {
        const manuals = await fetchQualityManuals(admin, job.project_id, companyId)
        manualContext = buildQualityManualContext(manuals, locationName, spotDesc)
      }
    }
  } catch { /* silent fallback to generic evaluation */ }

  try {
    const result = await evaluateBeforeAfter(
      beforeUrl, afterUrl, locationName,
      spotDesc || undefined,
      manualContext || undefined,
    )

    // PHOTO-VALID: 写真検証NGならDB保存しない（スコア0をDBに残さない）
    if (!result.evaluationPossible) {
      return Response.json({
        success:            false,
        validationFailed:   true,
        evaluationPossible: false,
        validation:         result.validation,
        issues:             result.validation?.issues ?? [],
        error: { code: 'VALIDATION_FAILED', message: '写真が評価条件を満たしていません' },
      })
    }

    // DB保存（upsert・evaluated URLでFreshness判定可能にする）
    const { error } = await admin.from('ai_evaluations').upsert(
      {
        job_id:               jobId,
        spot_id:              spotId,
        before_photo_id:      beforePhotoId ?? null,
        after_photo_id:       afterPhotoId  ?? null,
        evaluated_before_url: beforeUrl,
        evaluated_after_url:  afterUrl,
        score:                result.score,
        dirty_removal:        result.breakdown.dirtyRemoval,
        thoroughness:         result.breakdown.thoroughness,
        shine:                result.breakdown.shine,
        passed:               result.passed,
        recommendation:       result.recommendation,
        before_summary:       result.beforeAnalysis.summary,
        after_summary:        result.afterAnalysis.summary,
        comparison:           result.comparison,
        comment:              result.comment,
        improvements:         result.improvements,
        remaining_issues:     result.afterAnalysis.remainingIssues,
        photo_quality_ok:     result.photoQuality.beforeValid && result.photoQuality.afterValid,
        photo_quality_issues: result.photoQuality.issues,
      },
      { onConflict: 'job_id,spot_id' }
    )

    if (error) console.error('[quality] DB save error:', error.message)

    return Response.json({ success: true, data: result })
  } catch (err) {
    console.error('[quality] evaluate error:', (err as Error).message)
    return Response.json({ success: false, error: { code: 'AI_ERROR', message: (err as Error).message } }, { status: 500 })
  }
}

// ---- 全スポット一括評価 ----
async function handleEvaluateAll(body: any, uid: string, admin: any) {
  const { jobId } = body

  if (!jobId) {
    return Response.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'jobIdが必要です' } }, { status: 400 })
  }

  // jobのアクセス権確認
  const { data: job } = await admin.from('jobs').select('id, project_id, status').eq('id', jobId).eq('worker_id', uid).single()
  if (!job) {
    return Response.json({ success: false, error: { code: 'FORBIDDEN', message: 'このジョブへのアクセス権がありません' } }, { status: 403 })
  }
  // JOB-C6A: completed JobへのAI一括評価をブロック（ownership確認後、AI loop前）
  if (job.status === 'completed') {
    return Response.json(
      { success: false, error: { code: 'JOB_ALREADY_COMPLETED', message: 'この作業は既に完了しているため変更できません。' } },
      { status: 409 },
    )
  }

  // QUALITY-MG: Manual一覧をspot loop前に1回だけ取得（N+1なし・AI callなし）
  let allManuals: QualityManualRow[] = []
  try {
    if (job.project_id) {
      const companyId = await getProjectCompanyId(admin, job.project_id)
      if (companyId) {
        allManuals = await fetchQualityManuals(admin, job.project_id, companyId)
      }
    }
  } catch { /* silent fallback */ }

  // 撮影箇所一覧取得（description含む）
  const { data: spots } = await admin
    .from('photo_spots')
    .select('id, name, description, is_required')
    .eq('project_id', job.project_id)
    .order('order_num', { ascending: true })

  // このジョブの写真を取得
  const { data: photos } = await admin
    .from('photos')
    .select('id, spot_id, photo_type, url')
    .eq('job_id', jobId)

  const photoMap: Record<string, { before?: any; after?: any }> = {}
  for (const p of (photos ?? [])) {
    if (!photoMap[p.spot_id]) photoMap[p.spot_id] = {}
    if (p.photo_type === 'before') photoMap[p.spot_id].before = p
    if (p.photo_type === 'after')  photoMap[p.spot_id].after  = p
  }

  // QUALITY-FRESH: 既存評価を一括取得（N+1なし）
  const { data: existingEvals } = await admin
    .from('ai_evaluations')
    .select('spot_id, evaluated_before_url, evaluated_after_url, score, passed, recommendation')
    .eq('job_id', jobId)

  const evalBySpot = new Map<string, { evaluated_before_url: string | null; evaluated_after_url: string | null; score: number; passed: boolean; recommendation: string }>(
    (existingEvals ?? []).map((e: any) => [e.spot_id, e]),
  )

  const results: { spotId: string; spotName: string; success: boolean; fromCache?: boolean; validationFailed?: boolean; validation?: any; issues?: string[]; data?: any; error?: string }[] = []

  for (const spot of (spots ?? [])) {
    const pair = photoMap[spot.id]
    if (!pair?.before?.url || !pair?.after?.url) {
      results.push({ spotId: spot.id, spotName: spot.name, success: false, error: '写真が揃っていません' })
      continue
    }

    // QUALITY-FRESH: 同じURLなら既存評価を再利用（Vision AI 0 call）
    const existingEval = evalBySpot.get(spot.id)
    if (isEvaluationFresh(existingEval, pair.before.url, pair.after.url)) {
      results.push({
        spotId:    spot.id,
        spotName:  spot.name,
        success:   true,
        fromCache: true,
        data: {
          score:          existingEval!.score,
          passed:         existingEval!.passed,
          recommendation: existingEval!.recommendation,
        },
      })
      continue
    }

    try {
      const spotDesc      = (spot as any).description ?? ''
      // spot ごとに pure function で soft-sort + Total Cap 適用（DB re-query なし）
      const manualContext = buildQualityManualContext(allManuals, spot.name, spotDesc)
      const result = await evaluateBeforeAfter(
        pair.before.url, pair.after.url, spot.name,
        spotDesc || undefined,
        manualContext || undefined,
      )

      // PHOTO-VALID: 写真検証NGならDB保存スキップ（スコア0を誤保存しない）
      if (!result.evaluationPossible) {
        results.push({
          spotId:           spot.id,
          spotName:         spot.name,
          success:          false,
          validationFailed: true,
          validation:       result.validation,
          issues:           result.validation?.issues ?? [],
          error:            '写真が評価条件を満たしていません',
        })
        continue
      }

      await admin.from('ai_evaluations').upsert(
        {
          job_id:               jobId,
          spot_id:              spot.id,
          before_photo_id:      pair.before.id,
          after_photo_id:       pair.after.id,
          evaluated_before_url: pair.before.url,
          evaluated_after_url:  pair.after.url,
          score:                result.score,
          dirty_removal:        result.breakdown.dirtyRemoval,
          thoroughness:         result.breakdown.thoroughness,
          shine:                result.breakdown.shine,
          passed:               result.passed,
          recommendation:       result.recommendation,
          before_summary:       result.beforeAnalysis.summary,
          after_summary:        result.afterAnalysis.summary,
          comparison:           result.comparison,
          comment:              result.comment,
          improvements:         result.improvements,
          remaining_issues:     result.afterAnalysis.remainingIssues,
          photo_quality_ok:     result.photoQuality.beforeValid && result.photoQuality.afterValid,
          photo_quality_issues: result.photoQuality.issues,
        },
        { onConflict: 'job_id,spot_id' }
      )

      results.push({ spotId: spot.id, spotName: spot.name, success: true, data: result })
    } catch (err) {
      results.push({ spotId: spot.id, spotName: spot.name, success: false, error: (err as Error).message })
    }
  }

  // 総合スコア計算（通過したスポットの平均）
  const evaluated = results.filter((r) => r.success && r.data)
  const averageScore = evaluated.length > 0
    ? Math.round(evaluated.reduce((sum, r) => sum + r.data.score, 0) / evaluated.length)
    : 0

  return Response.json({
    success: true,
    data: {
      results,
      summary: {
        total:    spots?.length ?? 0,
        evaluated: evaluated.length,
        passed:   evaluated.filter((r) => r.data.passed).length,
        failed:   evaluated.filter((r) => !r.data.passed).length,
        averageScore,
        allPassed: evaluated.every((r) => r.data.passed) && evaluated.length > 0,
      },
    },
  })
}

// ============================================================
// GET /api/ai/quality?jobId=xxx — 評価結果一覧取得
// 認証: hk_s_uid cookie（ミドルウェア検証済み）
// ============================================================

export async function GET(req: NextRequest) {
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) {
    return Response.json({ success: false, error: { code: 'UNAUTHORIZED', message: '認証が必要です' } }, { status: 401 })
  }

  const jobId = new URL(req.url).searchParams.get('jobId')
  if (!jobId) {
    return Response.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'jobIdが必要です' } }, { status: 400 })
  }

  const admin = createAdminClient()

  // Job ownership確認（adminクライアントはRLSをバイパスするため明示確認）
  const { data: job } = await admin.from('jobs').select('id').eq('id', jobId).eq('worker_id', uid).maybeSingle()
  if (!job) {
    return Response.json({ success: false, error: { code: 'FORBIDDEN', message: 'このジョブへのアクセス権がありません' } }, { status: 403 })
  }

  // 評価と現在写真を並列取得（QUALITY-FRESH: freshステータスを返すため）
  const [evalsRes, photosRes] = await Promise.all([
    admin.from('ai_evaluations').select('*, photo_spots(name, is_required)').eq('job_id', jobId).order('created_at', { ascending: true }),
    admin.from('photos').select('spot_id, photo_type, url').eq('job_id', jobId),
  ])

  if (evalsRes.error) {
    return Response.json({ success: false, error: { code: 'INTERNAL_ERROR', message: evalsRes.error.message } }, { status: 500 })
  }

  // 現在写真URLマップ（freshness判定用）
  const beforeUrlBySpot: Record<string, string> = {}
  const afterUrlBySpot:  Record<string, string> = {}
  for (const p of (photosRes.data ?? [])) {
    if ((p as any).photo_type === 'before') beforeUrlBySpot[(p as any).spot_id] = (p as any).url ?? ''
    if ((p as any).photo_type === 'after')  afterUrlBySpot[(p as any).spot_id]  = (p as any).url ?? ''
  }

  const dataWithFresh = (evalsRes.data ?? []).map((ev: any) => ({
    ...ev,
    fresh: isEvaluationFresh(ev, beforeUrlBySpot[ev.spot_id] ?? '', afterUrlBySpot[ev.spot_id] ?? ''),
  }))

  return Response.json({ success: true, data: dataWithFresh })
}
