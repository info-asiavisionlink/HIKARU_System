// ============================================================
// JARVIS System — Agents SDK Definition
// OpenAI Agents SDK (@openai/agents) を使用する公式推奨実装。
// 既存の /api/ai/agent (Chat Completions) はfallbackとして維持。
// ============================================================

import { Agent, tool, setTracingDisabled } from '@openai/agents'
import { z } from 'zod'
import { isValidAction, getActionLevel } from '@/lib/voice/registry/system.actions'

// HIKARU業務データをOpenAIトレーシングプラットフォームへ送信しない
setTracingDisabled(true)

// ─── Agent Context（全Toolで共有）────────────────────────────
export type WorkerAgentContext = {
  workerId:    string  // 検証済みUID（APIルートで検証済み）
  cookieHeader: string  // 既存API認証転送用
  baseUrl:     string
  projectId?:  string  // URL自動抽出
}

// ─── HTTP helper ─────────────────────────────────────────────
async function apiGet(path: string, ctx: WorkerAgentContext): Promise<Response> {
  return fetch(`${ctx.baseUrl}${path}`, {
    headers: { Cookie: ctx.cookieHeader },
    credentials: 'include',
  })
}

// ─── Tools（Read-only / L0-L2 のみ）─────────────────────────

const getTodayJobsTool = tool({
  name:        'get_today_jobs',
  description: '今日の担当作業・案件一覧を取得する',
  parameters:  z.object({}),
  execute: async (_, runCtx) => {
    const ctx = runCtx!.context as WorkerAgentContext
    try {
      const res = await apiGet('/api/home/data', ctx)
      if (!res.ok) return '今日の作業情報を取得できませんでした。'
      const data = await res.json()
      const projects: Array<{ id: string; name: string }> = data.projects ?? []
      const total = data.summary?.total ?? projects.length
      if (total === 0) return '今日の担当作業はありません。'
      const first = projects[0]
      const list  = projects.slice(0, 5).map((p, i) => `${i + 1}件目: ${p.name} (id:${p.id})`).join(', ')
      return total === 1
        ? `今日は${first.name}の1件です。案件ID: ${first.id}。`
        : `今日は${total}件あります。最初は${first.name}（案件ID: ${first.id}）。一覧: ${list}`
    } catch {
      return '今日の作業情報の取得中にエラーが発生しました。'
    }
  },
})

const getJobDetailsTool = tool({
  name:        'get_job_details',
  description: '案件・Job詳細情報を取得する',
  parameters:  z.object({ projectId: z.string().describe('案件ID (UUID)') }),
  execute: async ({ projectId }, runCtx) => {
    const ctx = runCtx!.context as WorkerAgentContext
    const pid = projectId || ctx.projectId
    if (!pid) return '案件IDが指定されていません。'
    try {
      const res = await apiGet(`/api/projects/${pid}`, ctx)
      if (!res.ok) return '案件情報を取得できませんでした。'
      const data = await res.json()
      const name     = data?.data?.name     ?? data?.name
      const location = data?.data?.location_name ?? ''
      return name ? `案件名: ${name}${location ? `（${location}）` : ''}`
                  : '案件詳細を確認してください。'
    } catch {
      return '案件情報の取得中にエラーが発生しました。'
    }
  },
})

const getManualsTool = tool({
  name:        'get_manuals',
  description: '案件マニュアル一覧を取得する',
  parameters:  z.object({ projectId: z.string().optional().describe('案件ID (UUID)') }),
  execute: async ({ projectId }, runCtx) => {
    const ctx = runCtx!.context as WorkerAgentContext
    const pid = projectId || ctx.projectId
    if (!pid) return 'マニュアルを確認するには案件の画面を開いてください。'
    try {
      const res = await apiGet(`/api/jobs/${pid}/manuals`, ctx)
      if (!res.ok) return 'マニュアルを取得できませんでした。'
      const data = await res.json()
      const list: Array<{ id: string; title: string }> = data.manuals ?? []
      if (list.length === 0) return 'マニュアルはまだ登録されていません。'
      const items = list.slice(0, 5).map((m, i) => `${i + 1}件目: ${m.title} (id:${m.id})`).join(', ')
      return list.length === 1
        ? `${list[0].title}のマニュアルがあります。マニュアルID: ${list[0].id}`
        : `マニュアルが${list.length}件あります。一覧: ${items}`
    } catch {
      return 'マニュアルの取得中にエラーが発生しました。'
    }
  },
})

const askManualAiTool = tool({
  name:        'ask_manual_ai',
  description: 'マニュアルAIへ清掃手順・業務質問を問い合わせる',
  parameters:  z.object({
    projectId: z.string().optional(),
    question:  z.string().describe('質問内容'),
  }),
  execute: async ({ projectId, question }, runCtx) => {
    const ctx = runCtx!.context as WorkerAgentContext
    const pid = projectId || ctx.projectId
    if (!pid) return 'AI質問には案件の画面を開いてください。'
    if (!question?.trim()) return '質問内容が空です。'
    // マニュアルAIはSSEストリーミングのためAgentからは概要提案を返す
    return `「${question}」についてはAIチャット画面で詳しく確認できます。案件ID: ${pid}`
  },
})

const getNotificationsTool = tool({
  name:        'get_notifications',
  description: '通知・お知らせの未読件数と内容を確認する',
  parameters:  z.object({}),
  execute: async (_, runCtx) => {
    const ctx = runCtx!.context as WorkerAgentContext
    try {
      const res = await apiGet('/api/notifications', ctx)
      if (!res.ok) return '通知を取得できませんでした。'
      const data   = await res.json()
      const list   = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : [])
      const unread = list.filter((n: { is_read?: boolean }) => !n.is_read)
      if (unread.length === 0) return '未読の通知はありません。'
      const items = unread.slice(0, 5).map(
        (n: { id: string; title?: string; body?: string }, i: number) =>
          `${i + 1}件目: ${n.title ?? n.body ?? '通知'}`
      ).join(', ')
      return `未読の通知が${unread.length}件あります。内容: ${items}`
    } catch {
      return '通知の取得中にエラーが発生しました。'
    }
  },
})

const getScheduleTool = tool({
  name:        'get_schedule',
  description: '今後のスケジュール・予定一覧を確認する',
  parameters:  z.object({}),
  execute: async (_, runCtx) => {
    const ctx   = runCtx!.context as WorkerAgentContext
    try {
      const res   = await apiGet('/api/schedule', ctx)
      if (!res.ok) return 'スケジュールを取得できませんでした。'
      const data  = await res.json()
      const items = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : [])
      return items.length === 0
        ? '今後の予定はありません。'
        : `スケジュールに${items.length}件の予定があります。`
    } catch {
      return 'スケジュールの取得中にエラーが発生しました。'
    }
  },
})

const getAttendanceTool = tool({
  name:        'get_attendance_summary',
  description: '勤怠情報・出退勤状況のサマリーを確認する',
  parameters:  z.object({}),
  execute: async (_, runCtx) => {
    const ctx   = runCtx!.context as WorkerAgentContext
    try {
      const res   = await apiGet('/api/attendance', ctx)
      if (!res.ok) return '勤怠情報を取得できませんでした。'
      const data  = await res.json()
      const items = Array.isArray(data?.data) ? data.data : []
      return items.length > 0
        ? `勤怠記録が${items.length}件あります。`
        : '勤怠記録はありません。'
    } catch {
      return '勤怠情報の取得中にエラーが発生しました。'
    }
  },
})

const getExpensesTool = tool({
  name:        'get_expense_summary',
  description: '経費申請の状況・申請中件数を確認する',
  parameters:  z.object({}),
  execute: async (_, runCtx) => {
    const ctx = runCtx!.context as WorkerAgentContext
    try {
      const res     = await apiGet('/api/expenses', ctx)
      if (!res.ok) return '経費情報を取得できませんでした。'
      const data    = await res.json()
      const items   = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : [])
      const pending = items.filter((e: { status?: string }) =>
        e.status === 'draft' || e.status === 'submitted'
      ).length
      return pending === 0
        ? '申請中の経費はありません。'
        : `申請中の経費が${pending}件あります。`
    } catch {
      return '経費情報の取得中にエラーが発生しました。'
    }
  },
})

// navigate: L2アクション名を返してクライアントで実行
const navigateTool = tool({
  name:        'navigate',
  description: '指定のページへ移動する。actionにsystem.xxx形式で指定する。',
  parameters:  z.object({
    action:    z.string().describe('system.go_home / system.open_job 等のAction名'),
    projectId: z.string().optional().describe('案件ページへ移動する場合の案件ID'),
  }),
  execute: async ({ action, projectId }) => {
    // L3以上のActionは拒否
    if (isValidAction(action) && getActionLevel(action) >= 3) {
      return `このAction（${action}）は現在音声では実行できません。`
    }
    // navigate結果はJSONとして返す（API routeで解析）
    return JSON.stringify({ __navigate: true, action, projectId })
  },
})

// ─── Agent（モジュールレベルで1インスタンス再利用）────────────
const SYSTEM_PROMPT = `あなたはHIKARU Workerアシスタント「JARVIS」です。
清掃業務に携わる従業員の音声アシスタントとして、自然な日本語で業務をサポートします。

## 役割
- 今日の作業・案件の確認と案内
- マニュアル・手順書の情報提供
- スケジュール・勤怠・経費のサマリー確認
- 必要なページへのナビゲーション提案

## 重要なルール
- Toolで取得した情報のみを事実として扱う（存在しないJobやManualを作らない）
- Read-only Toolは必要に応じて連続使用可（最大5回）
- ユーザーが「開いて」「確認して」と言った場合のみnavigateを実行する
- 情報確認だけなら不要なnavigateをしない
- Write操作（作業開始・完了・経費申請等）は現在対応していない

## 返答スタイル（音声向け）
- 結論から先に伝える（「今日は3件です」）
- 重要な情報のみ（案件名・時間・場所）
- 2〜3文以内で簡潔に
- 次のActionが明らかな場合のみ提案する
- すべての返答を質問で終わらせない

## navigate Toolの使い方
action には以下を使用:
- system.go_home, system.go_back
- system.open_job（projectId必須）
- system.open_notifications, system.open_schedule, system.open_shifts
- system.open_attendance, system.open_expenses, system.open_profile
- system.open_manual, system.open_chat（projectId必須）
- system.open_jobs_list, system.open_report（projectId必須）
`

export const workerJarvisAgent = new Agent<WorkerAgentContext>({
  name:         'JARVIS Worker',
  instructions: SYSTEM_PROMPT,
  model:        'gpt-4o',
  tools:        [
    getTodayJobsTool,
    getJobDetailsTool,
    getManualsTool,
    askManualAiTool,
    getNotificationsTool,
    getScheduleTool,
    getAttendanceTool,
    getExpensesTool,
    navigateTool,
  ],
})
