import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ============================================================
// Evaluation Freshness（QUALITY-FRESH）
// URL完全一致のみFRESH。NULL = STALE。
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

// POST /api/jobs/complete
// ブラウザSupabase経由の completeJob() ハングリスクを回避するサーバー版。
// hk_s_uid cookie で Worker確認 → worker_id / company_id 二重所有権確認 →
// 二重完了防止 → Evaluation freshnessチェック → jobs UPDATE
export async function POST(req: NextRequest) {
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { jobId } = body as { jobId?: string }
  if (!jobId) return Response.json({ error: 'jobId is required' }, { status: 400 })

  try {
    const supabase = await createClient()

    // profiles から company_id をサーバー側で決定（クライアント値を信用しない）
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', uid)
      .single()

    if (!profile?.company_id) {
      return Response.json({ error: 'forbidden' }, { status: 403 })
    }

    // 所有権確認: worker_id = uid かつ company_id 一致（担当外・他社ジョブは404）
    const { data: job } = await supabase
      .from('jobs')
      .select('id, status, worker_id, company_id')
      .eq('id', jobId)
      .eq('worker_id', uid)
      .eq('company_id', profile.company_id)
      .single()

    if (!job) {
      return Response.json({ error: 'not found' }, { status: 404 })
    }

    // 二重完了防止: 既に completed なら成功として返す（冪等）
    if (job.status === 'completed') {
      return Response.json({ job, already_completed: true })
    }

    // in_progress 以外は完了不可
    if (job.status !== 'in_progress') {
      return Response.json({ error: 'job is not in progress' }, { status: 400 })
    }

    // QUALITY-FRESH: 写真撮り直し後に古いEvaluationでcompleteできないようにする
    const [photosRes, evalsRes] = await Promise.all([
      supabase.from('photos').select('spot_id, photo_type, url').eq('job_id', jobId),
      supabase.from('ai_evaluations').select('spot_id, evaluated_before_url, evaluated_after_url, recommendation').eq('job_id', jobId),
    ])

    const beforeUrlBySpot: Record<string, string> = {}
    const afterUrlBySpot:  Record<string, string> = {}
    for (const p of ((photosRes.data ?? []) as any[])) {
      if (p.photo_type === 'before') beforeUrlBySpot[p.spot_id] = p.url ?? ''
      if (p.photo_type === 'after')  afterUrlBySpot[p.spot_id]  = p.url ?? ''
    }

    const staleEvals = ((evalsRes.data ?? []) as any[]).filter((ev: any) =>
      !isEvaluationFresh(ev, beforeUrlBySpot[ev.spot_id] ?? '', afterUrlBySpot[ev.spot_id] ?? '')
    )

    if (staleEvals.length > 0) {
      return Response.json(
        {
          error:   'evaluations are stale',
          code:    'EVALUATION_STALE',
          message: '写真が更新されているためAI品質評価を再実行してください。',
          spotIds: (staleEvals as any[]).map((e: any) => e.spot_id),
        },
        { status: 409 },
      )
    }

    // REDO guard: Fresh評価でREDOが残っている場合はComplete不可
    const redoFreshEvals = ((evalsRes.data ?? []) as any[]).filter((ev: any) =>
      isEvaluationFresh(ev, beforeUrlBySpot[ev.spot_id] ?? '', afterUrlBySpot[ev.spot_id] ?? '') &&
      ev.recommendation === 'redo'
    )

    if (redoFreshEvals.length > 0) {
      return Response.json(
        {
          error:   'redo evaluation not resolved',
          code:    'REDO_NOT_RESOLVED',
          message: '再清掃が必要な箇所があります。写真を撮り直して再評価してください。',
          spotIds: (redoFreshEvals as any[]).map((e: any) => e.spot_id),
        },
        { status: 409 },
      )
    }

    const { data: updated, error: updateError } = await supabase
      .from('jobs')
      .update({
        status:       'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .eq('worker_id', uid)
      .select('id, project_id, worker_id, company_id, status, work_date, started_at, completed_at, notes, created_at')
      .single()

    if (updateError) {
      console.error('[api/jobs/complete]', updateError.message)
      return Response.json({ error: updateError.message }, { status: 500 })
    }

    return Response.json({ job: updated })
  } catch (e) {
    console.error('[api/jobs/complete] error:', e)
    return Response.json({ error: 'server_error' }, { status: 500 })
  }
}
