import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  generateScopedManualReplyStream,
  extractSources,
  flattenScopedManuals,
  type ManualItem,
  type ScopedManuals,
  type ChatMessage,
} from '@/modules/manual-ai'
import {
  checkRateLimit,
  WORKER_RATE_LIMIT,
  rateLimitExceededResponse,
} from '@/lib/ai/ratelimit'

// Vercel: SSE streaming のタイムアウト上限（OpenAI最大応答 + 余裕）
export const maxDuration = 60

// ============================================================
// POST /api/ai/manual — SSEストリーミングでAI回答を返す
// 認証: hk_s_uid cookie（ミドルウェア検証済み）
// ownership:
//   profiles → entity_type / entity_id / company_id
//   → project_assignments
//   → projects.company_id === worker.company_id（company isolation）
// ============================================================

export async function POST(req: NextRequest) {
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) {
    return Response.json({ success: false, error: { code: 'UNAUTHORIZED', message: '認証が必要です' } }, { status: 401 })
  }

  // ---- Rate Limit（SSE開始前に判定）----
  if (!checkRateLimit(`worker:${uid}`, WORKER_RATE_LIMIT.limit, WORKER_RATE_LIMIT.windowMs)) {
    return rateLimitExceededResponse()
  }

  const body = await req.json()
  const {
    projectId,
    message,
    chatHistory = [],
    jobId,
  } = body as {
    projectId: string
    message: string
    chatHistory: ChatMessage[]
    jobId?: string
  }

  if (!projectId || !message?.trim()) {
    return Response.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'パラメータが不正です' } }, { status: 400 })
  }

  const admin = createAdminClient()

  // ---- profileからworker情報取得（company_idを含む）----
  type WorkerProfile = { entity_type: string; entity_id: string; company_id: string }
  const { data: profileRaw } = await admin
    .from('profiles')
    .select('entity_type, entity_id, company_id')
    .eq('id', uid)
    .single()
  const profile = profileRaw as WorkerProfile | null

  if (!profile?.entity_type || !profile?.entity_id || !profile?.company_id) {
    return Response.json({ success: false, error: { code: 'FORBIDDEN', message: 'アクセス権がありません' } }, { status: 403 })
  }

  // ---- project_assignments ownership確認（Employee / Partner 双方対応）----
  const { data: assignment } = await admin
    .from('project_assignments')
    .select('project_id')
    .eq('assignee_type', profile.entity_type)
    .eq('assignee_id', profile.entity_id)
    .eq('project_id', projectId)
    .maybeSingle()

  if (!assignment) {
    return Response.json({ success: false, error: { code: 'FORBIDDEN', message: 'この案件へのアクセス権がありません' } }, { status: 403 })
  }

  // ---- company isolation: プロジェクトのcompany_idとworkerのcompany_idが一致するか確認 ----
  type ProjectRow = { id: string; company_id: string }
  const { data: projectRaw } = await admin
    .from('projects')
    .select('id, company_id')
    .eq('id', projectId)
    .single()
  const project = projectRaw as ProjectRow | null

  if (!project || project.company_id !== profile.company_id) {
    return Response.json({ success: false, error: { code: 'FORBIDDEN', message: 'この案件へのアクセス権がありません' } }, { status: 403 })
  }

  // ---- jobId整合確認（指定された場合のみ）----
  // worker_id と project_id が一致するジョブか確認し、不一致は null として扱う
  // ⚠️ 現在: 不正jobIdはサイレント劣化（null扱い）。403化はPhase A-2候補として検討。
  let validJobId: string | null = null
  if (jobId) {
    const { data: job } = await admin
      .from('jobs')
      .select('id')
      .eq('id', jobId)
      .eq('worker_id', uid)
      .eq('project_id', projectId)
      .maybeSingle()
    validJobId = job?.id ?? null
  }

  // ---- SSEストリーミング開始（ownership・company isolation確認済み）----
  const encoder = new TextEncoder()

  function send(data: object): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer = writable.getWriter()

  ;(async () => {
    try {
      // ---- Phase B: 3階層スコープ別マニュアル取得 ----
      // company isolation は SSE外で完了済み (profile.company_id 確定)
      const [
        { data: projectManuals },
        { data: companyManuals },
        { data: globalManuals },
      ] = await Promise.all([
        // PROJECT: この案件専用
        admin.from('manuals')
          .select('id, type, title, content, file_url')
          .eq('project_id', projectId)
          .order('order_num', { ascending: true }),

        // COMPANY: 同社テンプレート (is_template=true, project_idなし)
        admin.from('manuals')
          .select('id, type, title, content, file_url')
          .eq('company_id', profile.company_id)
          .eq('is_template', true)
          .is('project_id', null)
          .order('order_num', { ascending: true }),

        // GLOBAL: HIKARU標準 (company_id=NULL, project_id=NULL)
        admin.from('manuals')
          .select('id, type, title, content, file_url')
          .is('company_id', null)
          .is('project_id', null)
          .order('order_num', { ascending: true }),
      ])

      const scoped: ScopedManuals = {
        project: (projectManuals ?? []) as ManualItem[],
        company: (companyManuals ?? []) as ManualItem[],
        global:  (globalManuals  ?? []) as ManualItem[],
      }
      const allManuals = flattenScopedManuals(scoped)

      // ---- ユーザーメッセージ保存 ----
      await admin.from('chat_messages').insert({
        project_id: projectId,
        worker_id:  uid,
        job_id:     validJobId,
        role:       'user',
        content:    message.trim(),
        sources:    [],
      })

      // ---- ストリーミング ----
      let fullContent = ''
      await writer.write(send({ type: 'start' }))

      for await (const chunk of generateScopedManualReplyStream(message.trim(), chatHistory, scoped)) {
        fullContent += chunk
        await writer.write(send({ type: 'chunk', content: chunk }))
      }

      // ---- 保存・完了 ----
      const sources = extractSources(fullContent, allManuals)

      await admin.from('chat_messages').insert({
        project_id: projectId,
        worker_id:  uid,
        job_id:     validJobId,
        role:       'assistant',
        content:    fullContent,
        sources,
      })

      await writer.write(send({ type: 'done', sources }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI回答の生成に失敗しました'
      await writer.write(send({ type: 'error', message: msg }))
    } finally {
      await writer.close()
    }
  })()

  return new Response(readable, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection:      'keep-alive',
    },
  })
}

// ============================================================
// GET /api/ai/manual?projectId=xxx&limit=30 — 履歴取得
// 認証: hk_s_uid cookie（ミドルウェア検証済み）
// ownership: profiles → entity_type/entity_id → project_assignments
// ============================================================

export async function GET(req: NextRequest) {
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) {
    return Response.json({ success: false, error: { code: 'UNAUTHORIZED', message: '認証が必要です' } }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  const limit     = Math.min(Number(searchParams.get('limit') ?? '30'), 100)

  if (!projectId) {
    return Response.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'projectIdが必要です' } }, { status: 400 })
  }

  const admin = createAdminClient()

  // ---- project_assignments ownership確認（Employee / Partner 双方対応）----
  type GetWorkerProfile = { entity_type: string; entity_id: string }
  const { data: profileRaw2 } = await admin
    .from('profiles')
    .select('entity_type, entity_id')
    .eq('id', uid)
    .single()
  const profile = profileRaw2 as GetWorkerProfile | null

  if (!profile?.entity_type || !profile?.entity_id) {
    return Response.json({ success: false, error: { code: 'FORBIDDEN', message: 'アクセス権がありません' } }, { status: 403 })
  }

  const { data: assignment } = await admin
    .from('project_assignments')
    .select('project_id')
    .eq('assignee_type', profile.entity_type)
    .eq('assignee_id', profile.entity_id)
    .eq('project_id', projectId)
    .maybeSingle()

  if (!assignment) {
    return Response.json({ success: false, error: { code: 'FORBIDDEN', message: 'この案件へのアクセス権がありません' } }, { status: 403 })
  }

  const { data, error } = await admin
    .from('chat_messages')
    .select('id, role, content, sources, created_at')
    .eq('project_id', projectId)
    .eq('worker_id', uid)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return Response.json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 })
  }

  return Response.json({ success: true, data: (data ?? []).reverse() })
}
