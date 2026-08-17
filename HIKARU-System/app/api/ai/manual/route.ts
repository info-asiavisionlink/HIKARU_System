import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  generateManualReplyStream,
  extractSources,
  type ManualItem,
  type ChatMessage,
} from '@/modules/manual-ai'

// ============================================================
// POST /api/ai/manual — SSEストリーミングでAI回答を返す
// 認証: hk_s_uid cookie（ミドルウェア検証済み）
// ownership: profiles → entity_type/entity_id → project_assignments
// ============================================================

export async function POST(req: NextRequest) {
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) {
    return Response.json({ success: false, error: { code: 'UNAUTHORIZED', message: '認証が必要です' } }, { status: 401 })
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

  // ---- project_assignments ownership確認（Employee / Partner 双方対応）----
  const { data: profile } = await admin
    .from('profiles')
    .select('entity_type, entity_id')
    .eq('id', uid)
    .single()

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

  // ---- jobId整合確認（指定された場合のみ）----
  // worker_id と project_id が一致するジョブか確認し、不一致は null として扱う
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

  // ---- SSEストリーミング開始（ownership確認済み）----
  const encoder = new TextEncoder()

  function send(data: object): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer = writable.getWriter()

  ;(async () => {
    try {
      // ---- マニュアル取得 ----
      const { data: manuals } = await admin
        .from('manuals')
        .select('id, type, title, content, file_url')
        .eq('project_id', projectId)
        .order('order_num', { ascending: true })

      const manualItems = (manuals ?? []) as ManualItem[]

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

      for await (const chunk of generateManualReplyStream(message.trim(), chatHistory, manualItems)) {
        fullContent += chunk
        await writer.write(send({ type: 'chunk', content: chunk }))
      }

      // ---- 保存・完了 ----
      const sources = extractSources(fullContent, manualItems)

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
  const { data: profile } = await admin
    .from('profiles')
    .select('entity_type, entity_id')
    .eq('id', uid)
    .single()

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
