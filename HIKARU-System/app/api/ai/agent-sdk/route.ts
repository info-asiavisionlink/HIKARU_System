import { NextRequest } from 'next/server'
import { run }           from '@openai/agents'
import { checkRateLimit, rateLimitExceededResponse } from '@/lib/ai/ratelimit'
import { workerJarvisAgent, type WorkerAgentContext } from '@/lib/voice/agent/sdk-agent'
import type { AgentApiResponse } from '@/lib/voice/agent/types'

// ============================================================
// POST /api/ai/agent-sdk — System JARVIS Agent (Agents SDK)
// OpenAI Agents SDK + Responses API を使用する公式推奨経路。
// 認証: hk_s_uid cookie（ミドルウェア検証済み）
// DB変更なし。Read-only Tools + Navigation提案のみ。
// ============================================================

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!checkRateLimit(`agent-sdk:${uid}`, 60, 60_000)) {
    return rateLimitExceededResponse()
  }

  let body: {
    utterance?:          string
    currentPath?:        string
    currentResourceId?:  string
    recentMessages?:     Array<{ role: string; content: string }>
    lastIntent?:         string
    lastResultData?:     { type: string; items?: Array<{ id: string; label: string }> }
    previousResponseId?: string
  }
  try { body = await req.json() }
  catch { return Response.json({ error: 'invalid JSON' }, { status: 400 }) }

  const {
    utterance, currentPath = '/home', currentResourceId,
    recentMessages, lastIntent, lastResultData, previousResponseId,
  } = body

  if (!utterance?.trim()) {
    return Response.json({ error: 'utterance required' }, { status: 400 })
  }

  const origin      = req.headers.get('origin') || req.nextUrl.origin
  const baseUrl     = origin.startsWith('http') ? origin : `https://${origin}`
  const cookieHeader = req.headers.get('cookie') ?? ''

  const agentCtx: WorkerAgentContext = {
    workerId:    uid,
    cookieHeader,
    baseUrl,
    projectId:   currentResourceId,
  }

  // ─── 入力構築（単一string + previousResponseId でセッション継続）
  let contextAddendum = ''
  if (lastResultData?.items?.length) {
    contextAddendum += '\n【直前の選択肢】\n'
    lastResultData.items.forEach(item => { contextAddendum += `  ${item.label} → ID: ${item.id}\n` })
  }
  if (lastIntent) contextAddendum += `\n【直前のAction】: ${lastIntent}`
  if (recentMessages?.length) {
    contextAddendum += '\n【直近の会話】\n'
    recentMessages.slice(-4).forEach(m => {
      contextAddendum += `${m.role === 'user' ? 'User' : 'JARVIS'}: ${m.content}\n`
    })
  }

  const inputText = [
    `発話: "${utterance.trim()}"`,
    `現在のパス: ${currentPath}`,
    currentResourceId ? `現在の案件ID: ${currentResourceId}` : '',
    contextAddendum,
  ].filter(Boolean).join('\n')

  try {
    const result = await run(workerJarvisAgent, inputText, {
      maxTurns:          5,
      context:           agentCtx,
      previousResponseId: previousResponseId ?? undefined,
    })

    const finalOutput = result.finalOutput ?? ''

    // tool 結果を検出（navigate / pendingConfirmation）
    let navigateAction: string | null = null
    let navigateProjectId: string | undefined
    let pendingConfirmation: Record<string, unknown> | null = null

    for (const item of result.newItems ?? []) {
      if (item.type === 'tool_call_output_item') {
        try {
          const output = typeof item.output === 'string' ? item.output : ''
          const parsed = JSON.parse(output)
          if (parsed.__navigate && parsed.action) {
            navigateAction    = parsed.action
            navigateProjectId = parsed.projectId
          }
          if (parsed.__pendingConfirmation) {
            pendingConfirmation = {
              action:      parsed.action,
              params:      parsed.params ?? {},
              safetyLevel: parsed.safetyLevel,
              message:     parsed.message,
              expiresAt:   parsed.expiresAt,
            }
          }
        } catch {}
      }
    }

    const response: AgentApiResponse & {
      pendingApproval?:    boolean
      pendingConfirmation?: Record<string, unknown>
      previousResponseId?: string
    } = {
      action:              navigateAction,
      confidence:          navigateAction ? 1.0 : 0,
      params:              navigateProjectId ? { projectId: navigateProjectId } : {},
      voiceReply:          finalOutput || null,
      pendingApproval:     false,
      pendingConfirmation: pendingConfirmation ?? undefined,
      previousResponseId:  result.lastResponseId,
    }

    return Response.json(response)

  } catch (err) {
    console.error('[agent-sdk] error:', err instanceof Error ? err.message : err)
    return Response.json({
      action: null, confidence: 0, params: {},
      voiceReply: null,
      error: 'agent_failed',
    }, { status: 500 })
  }
}
