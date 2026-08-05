import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { evaluateBeforeAfter, checkPhotoQuality } from '@/modules/quality-ai'

// ============================================================
// POST /api/ai/quality
// action: 'check' | 'evaluate' | 'evaluate-all'
// ============================================================

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ success: false, error: { code: 'UNAUTHORIZED', message: '認証が必要です' } }, { status: 401 })
  }

  const body = await req.json()
  const { action } = body

  switch (action) {
    case 'check':   return handlePhotoCheck(body, user.id, supabase)
    case 'evaluate': return handleEvaluate(body, user.id, supabase)
    case 'evaluate-all': return handleEvaluateAll(body, user.id, supabase)
    default:
      return Response.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'actionが不正です' } }, { status: 400 })
  }
}

// ---- 写真品質チェック ----
async function handlePhotoCheck(body: any, _userId: string, _supabase: any) {
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
async function handleEvaluate(body: any, userId: string, supabase: any) {
  const { jobId, spotId, beforeUrl, afterUrl, beforePhotoId, afterPhotoId } = body

  if (!jobId || !spotId || !beforeUrl || !afterUrl) {
    return Response.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'パラメータ不足' } }, { status: 400 })
  }

  // 撮影箇所名を取得
  const { data: spot } = await supabase.from('photo_spots').select('name').eq('id', spotId).single()
  const locationName = spot?.name ?? '撮影箇所'

  try {
    const result = await evaluateBeforeAfter(beforeUrl, afterUrl, locationName)

    // DB保存（upsert）
    const { error } = await supabase.from('ai_evaluations').upsert(
      {
        job_id:          jobId,
        spot_id:         spotId,
        before_photo_id: beforePhotoId ?? null,
        after_photo_id:  afterPhotoId  ?? null,
        score:           result.score,
        dirty_removal:   result.breakdown.dirtyRemoval,
        thoroughness:    result.breakdown.thoroughness,
        shine:           result.breakdown.shine,
        passed:          result.passed,
        recommendation:  result.recommendation,
        before_summary:  result.beforeAnalysis.summary,
        after_summary:   result.afterAnalysis.summary,
        comparison:      result.comparison,
        comment:         result.comment,
        improvements:    result.improvements,
        remaining_issues: result.afterAnalysis.remainingIssues,
        photo_quality_ok: result.photoQuality.beforeValid && result.photoQuality.afterValid,
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
async function handleEvaluateAll(body: any, userId: string, supabase: any) {
  const { jobId } = body

  if (!jobId) {
    return Response.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'jobIdが必要です' } }, { status: 400 })
  }

  // jobのアクセス権確認
  const { data: job } = await supabase.from('jobs').select('id, project_id').eq('id', jobId).eq('worker_id', userId).single()
  if (!job) {
    return Response.json({ success: false, error: { code: 'FORBIDDEN', message: 'このジョブへのアクセス権がありません' } }, { status: 403 })
  }

  // 撮影箇所一覧取得（project_id ベース）
  const { data: spots } = await supabase
    .from('photo_spots')
    .select('id, name, is_required')
    .eq('project_id', job.project_id)
    .order('order_num', { ascending: true })

  // このジョブの写真を取得
  const { data: photos } = await supabase
    .from('photos')
    .select('id, spot_id, photo_type, url')
    .eq('job_id', jobId)

  const photoMap: Record<string, { before?: any; after?: any }> = {}
  for (const p of (photos ?? [])) {
    if (!photoMap[p.spot_id]) photoMap[p.spot_id] = {}
    if (p.photo_type === 'before') photoMap[p.spot_id].before = p
    if (p.photo_type === 'after')  photoMap[p.spot_id].after  = p
  }

  const results: { spotId: string; spotName: string; success: boolean; data?: any; error?: string }[] = []

  for (const spot of (spots ?? [])) {
    const pair = photoMap[spot.id]
    if (!pair?.before?.url || !pair?.after?.url) {
      results.push({ spotId: spot.id, spotName: spot.name, success: false, error: '写真が揃っていません' })
      continue
    }

    try {
      const result = await evaluateBeforeAfter(pair.before.url, pair.after.url, spot.name)

      await supabase.from('ai_evaluations').upsert(
        {
          job_id:          jobId,
          spot_id:         spot.id,
          before_photo_id: pair.before.id,
          after_photo_id:  pair.after.id,
          score:           result.score,
          dirty_removal:   result.breakdown.dirtyRemoval,
          thoroughness:    result.breakdown.thoroughness,
          shine:           result.breakdown.shine,
          passed:          result.passed,
          recommendation:  result.recommendation,
          before_summary:  result.beforeAnalysis.summary,
          after_summary:   result.afterAnalysis.summary,
          comparison:      result.comparison,
          comment:         result.comment,
          improvements:    result.improvements,
          remaining_issues: result.afterAnalysis.remainingIssues,
          photo_quality_ok: result.photoQuality.beforeValid && result.photoQuality.afterValid,
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
// ============================================================

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ success: false, error: { code: 'UNAUTHORIZED', message: '認証が必要です' } }, { status: 401 })
  }

  const jobId = new URL(req.url).searchParams.get('jobId')
  if (!jobId) {
    return Response.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'jobIdが必要です' } }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('ai_evaluations')
    .select('*, photo_spots(name, is_required)')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true })

  if (error) {
    return Response.json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 })
  }

  return Response.json({ success: true, data: data ?? [] })
}
