import { NextRequest } from 'next/server'
import { createOpenAIClient, OPENAI_MODELS } from '@/lib/openai/client'
import { checkRateLimit, rateLimitExceededResponse } from '@/lib/ai/ratelimit'
import { isValidAction, getActionLevel } from '@/lib/voice/registry/system.actions'
import { SYSTEM_AGENT_TOOLS, toOpenAITools } from '@/lib/voice/agent/system.tools'
import type { SystemAgentContext, AgentApiResponse } from '@/lib/voice/agent/types'

// ============================================================
// POST /api/ai/agent — System JARVIS Agent
// 認証: hk_s_uid cookie（ミドルウェア検証済み）
// 複数Tool呼び出しによる多段データ取得 → 自然な回答生成
// DBへの書き込みなし（Read-only Tools + Navigation提案のみ）
// ============================================================

export const maxDuration = 30

const MAX_TOOL_STEPS = 5

// ─── System Prompt ───────────────────────────────────────────
const SYSTEM_PROMPT = `あなたはHIKARU Workerアシスタント「JARVIS」です。
清掃業務に携わる従業員の音声アシスタントとして、自然な日本語で業務をサポートします。

## 役割
- 今日の作業・案件の確認と案内
- マニュアル・手順書の情報提供
- スケジュール・勤怠・経費のサマリー確認
- 必要なページへのナビゲーション提案

## 重要なルール
- Toolで取得した情報のみを事実として扱う（存在しないJobやManualを作らない）
- Read-only Toolは必要に応じて連続使用可（最大${MAX_TOOL_STEPS}回）
- NavigationはNavigate Toolを通じて提案する
- ユーザーが「うん」「開いて」と言った場合のみNavigate実行
- 情報確認だけなら不要なNavigateをしない

## 返答スタイル（音声向け）
- 結論から先に伝える（「今日は3件です」）
- 重要な情報のみ（案件名・時間・場所）
- 長い説明は避ける（2〜3文以内）
- 次のActionが明らかな場合のみ提案する
- すべての返答を質問で終わらせない

## Navigate Toolの使い方
navigate Toolを呼ぶとき action には以下を使用:
- system.go_home, system.go_back
- system.open_job（projectId必須）
- system.open_notifications, system.open_schedule
- system.open_shifts, system.open_attendance
- system.open_expenses, system.open_profile
- system.open_manual, system.open_chat（projectId必須）
- system.open_jobs_list, system.open_report（projectId必須）
`

export async function POST(req: NextRequest) {
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!checkRateLimit(`agent:${uid}`, 60, 60_000)) {
    return rateLimitExceededResponse()
  }

  let body: {
    utterance?:         string
    currentPath?:       string
    currentResourceId?: string
    contextType?:       string
    recentMessages?:    Array<{ role: string; content: string }>
    lastIntent?:        string
    lastResultData?:    { type: string; items?: Array<{ id: string; label: string }> }
  }
  try { body = await req.json() }
  catch { return Response.json({ error: 'invalid JSON' }, { status: 400 }) }

  const {
    utterance, currentPath = '/home', currentResourceId,
    recentMessages, lastIntent, lastResultData,
  } = body

  if (!utterance?.trim()) {
    return Response.json({ error: 'utterance required' }, { status: 400 })
  }

  // origin を取得（self-call用）
  const origin   = req.headers.get('origin') || req.nextUrl.origin
  const baseUrl  = origin.startsWith('http') ? origin : `https://${origin}`
  const cookieHeader = req.headers.get('cookie') ?? ''

  const agentCtx: SystemAgentContext = {
    workerId:    uid,
    currentPath,
    projectId:   currentResourceId,
    cookieHeader,
    baseUrl,
  }

  // ─── メッセージ構築 ───────────────────────────────────────
  const messages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string; name?: string }> = []

  // 直前の会話履歴
  if (recentMessages?.length) {
    for (const m of recentMessages.slice(-6)) {
      messages.push({ role: m.role as 'user' | 'assistant', content: m.content })
    }
  }

  // 直前の選択肢（lastResultData）
  let contextAddendum = ''
  if (lastResultData?.items?.length) {
    contextAddendum += '\n【直前の選択肢】\n'
    lastResultData.items.forEach(item => { contextAddendum += `  ${item.label} → ID: ${item.id}\n` })
  }
  if (lastIntent) {
    contextAddendum += `\n【直前のAction】: ${lastIntent}`
  }

  const userContent = [
    `発話: "${utterance.trim()}"`,
    `現在のパス: ${currentPath}`,
    currentResourceId ? `現在の案件ID: ${currentResourceId}` : '',
    contextAddendum,
  ].filter(Boolean).join('\n')

  messages.push({ role: 'user', content: userContent })

  const openai   = createOpenAIClient()
  const openaiTools = toOpenAITools(SYSTEM_AGENT_TOOLS)

  // ─── Agent Loop（最大MAX_TOOL_STEPS回）───────────────────
  let steps = 0
  const toolResults: Array<{ id: string; name: string; result: string }> = []
  let lastNavigateAction: { action: string; projectId?: string } | null = null
  let finalResultData: AgentApiResponse['resultData'] | undefined

  const allMessages = [{ role: 'system' as const, content: SYSTEM_PROMPT }, ...messages]

  while (steps < MAX_TOOL_STEPS) {
    let completion
    try {
      completion = await openai.chat.completions.create({
        model:       OPENAI_MODELS.CHAT,
        messages:    allMessages as any,
        tools:       openaiTools,
        tool_choice: 'auto',
        temperature: 0.3,
        max_tokens:  600,
      })
    } catch (err) {
      console.error('[agent] OpenAI error:', err instanceof Error ? err.message : err)
      return Response.json({
        action: null, confidence: 0, params: {}, voiceReply: 'AIに接続できませんでした。しばらくしてから再度お試しください。',
      })
    }

    const choice  = completion.choices[0]
    const message = choice?.message

    if (!message) break

    // Tool calls あり → 実行
    if (message.tool_calls?.length) {
      allMessages.push({ role: 'assistant', content: message.content ?? '', ...({ tool_calls: message.tool_calls } as any) })

      for (const tc of message.tool_calls) {
        const toolName = tc.function.name
        const tool     = SYSTEM_AGENT_TOOLS.find(t => t.name === toolName)

        let resultText = `Tool "${toolName}" not found`
        if (tool) {
          let params: Record<string, string> = {}
          try { params = JSON.parse(tc.function.arguments) } catch {}

          // Safety Level 3以上は実行しない（Registry上は存在しないが念のため）
          if (tool.safetyLevel >= 3) {
            resultText = 'この操作は現在許可されていません。'
          } else {
            try {
              const result = await tool.execute(params, agentCtx)
              resultText = result.text

              // navigate toolの結果を捕捉
              if (toolName === 'navigate' && result.data?.action) {
                lastNavigateAction = {
                  action:    result.data.action as string,
                  projectId: result.data.projectId as string | undefined,
                }
              }

              // アイテムリストを捕捉（lastResultData更新用）
              if (result.items?.length) {
                const typeMap: Record<string, AgentApiResponse['resultData']> = {
                  get_today_jobs:  { type: 'job_list',      items: result.items },
                  get_manuals:     { type: 'manual_list',   items: result.items },
                  get_notifications: { type: 'notification_list', items: result.items },
                }
                if (typeMap[toolName]) finalResultData = typeMap[toolName]
              }

              toolResults.push({ id: tc.id, name: toolName, result: resultText })
            } catch (err) {
              resultText = 'Toolの実行中にエラーが発生しました。'
              console.error(`[agent] Tool ${toolName} error:`, err)
            }
          }
        }

        allMessages.push({
          role:        'tool',
          content:     resultText,
          tool_call_id: tc.id,
          name:        toolName,
        } as any)
      }

      steps++
      continue
    }

    // Tool calls なし → 最終回答
    const voiceReply = message.content?.trim() ?? null

    // Navigate action を Action Registry に変換
    if (lastNavigateAction) {
      const actionName = lastNavigateAction.action
      if (isValidAction(actionName) && getActionLevel(actionName) <= 2) {
        return Response.json({
          action:     actionName,
          confidence: 1.0,
          params:     lastNavigateAction.projectId ? { projectId: lastNavigateAction.projectId } : {},
          voiceReply,
          resultData: finalResultData,
        } satisfies AgentApiResponse)
      }
    }

    return Response.json({
      action:     null,
      confidence: 0,
      params:     {},
      voiceReply,
      resultData: finalResultData,
    } satisfies AgentApiResponse)
  }

  // Max steps 到達
  return Response.json({
    action: null, confidence: 0, params: {},
    voiceReply: '情報を確認しましたが、まとめるのに少し時間がかかりました。もう少し具体的に教えていただけますか？',
    resultData: finalResultData,
  } satisfies AgentApiResponse)
}
