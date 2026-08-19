import { NextRequest } from 'next/server'
import { createOpenAIClient, OPENAI_MODELS } from '@/lib/openai/client'
import { buildActionListForPrompt, isValidAction, getActionLevel } from '@/lib/voice/registry/system.actions'
import { buildIntentSystemPrompt, type IntentPromptContext } from '@/lib/voice/intent/prompts'
import { checkRateLimit, rateLimitExceededResponse } from '@/lib/ai/ratelimit'

// Intent解析はgpt-4o-miniのみ。DBへの書き込みなし。
export const maxDuration = 15

// ============================================================
// POST /api/ai/intent — 発話からAction Intentを解析（自然会話対応版）
// 認証: hk_s_uid cookie（ミドルウェア検証済み）
// ⚠️ このAPIはActionを実行しない。Intent名とparamを返すだけ。
// ============================================================

export async function POST(req: NextRequest) {
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!checkRateLimit(`intent:${uid}`, 120, 60_000)) {
    return rateLimitExceededResponse()
  }

  let body: {
    utterance?:         string
    currentPath?:       string
    currentResourceId?: string
    contextType?:       string
    // 自然会話Context（オプション・後方互換あり）
    recentMessages?:    Array<{ role: string; content: string }>
    lastIntent?:        string
    lastResultData?:    { type: string; items?: Array<{ id: string; label: string }> }
  }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const {
    utterance, currentPath = '/home', currentResourceId, contextType,
    recentMessages, lastIntent, lastResultData,
  } = body

  if (!utterance?.trim()) {
    return Response.json({ error: 'utterance required' }, { status: 400 })
  }

  const actionList = buildActionListForPrompt()

  // 自然会話Contextをpromptへ統合
  const promptContext: IntentPromptContext = {
    recentMessages:  recentMessages?.slice(-6),
    lastIntent,
    lastResultData,
  }
  const systemPrompt = buildIntentSystemPrompt(actionList, promptContext)

  const userMessage  = [
    `発話: "${utterance.trim()}"`,
    `現在のパス: ${currentPath}`,
    currentResourceId ? `現在のリソースID（案件ID等）: ${currentResourceId}` : '',
    contextType       ? `画面コンテキスト: ${contextType}` : '',
  ].filter(Boolean).join('\n')

  try {
    const openai = createOpenAIClient()
    const completion = await openai.chat.completions.create({
      model:           OPENAI_MODELS.MINI,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage  },
      ],
      temperature:     0.1,
      max_tokens:      250,
      response_format: { type: 'json_object' },
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    let parsed: { action?: string; confidence?: number; params?: Record<string, string>; voiceReply?: string }
    try {
      parsed = JSON.parse(raw)
    } catch {
      return Response.json({ action: null, confidence: 0, params: {}, voiceReply: null })
    }

    const actionName = parsed.action

    if (actionName && !isValidAction(actionName)) {
      return Response.json({ action: null, confidence: 0, params: {}, voiceReply: null })
    }

    if (actionName && isValidAction(actionName) && getActionLevel(actionName) >= 3) {
      return Response.json({
        action:     null,
        confidence: 0,
        params:     {},
        voiceReply: 'この操作はまだ音声で対応していません。画面から操作してください。',
      })
    }

    return Response.json({
      action:     actionName ?? null,
      confidence: parsed.confidence ?? 0,
      params:     parsed.params     ?? {},
      voiceReply: parsed.voiceReply ?? null,
    })
  } catch (err) {
    console.error('[voice/intent]', err instanceof Error ? err.message : err)
    return Response.json({ action: null, confidence: 0, params: {}, voiceReply: null }, { status: 500 })
  }
}
