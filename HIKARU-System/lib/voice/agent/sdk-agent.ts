// ============================================================
// JARVIS System — Agents SDK Definition
// OpenAI Agents SDK (@openai/agents) を使用する公式推奨実装。
// 既存の /api/ai/agent (Chat Completions) はfallbackとして維持。
// ============================================================

import { Agent, tool, setTracingDisabled } from '@openai/agents'
import { z } from 'zod'
import { isValidAction, getActionLevel } from '@/lib/voice/registry/system.actions'
import { getJSTDateString } from '@/lib/date'

const CONFIRMATION_EXPIRY_MS = 5 * 60 * 1000

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
  description: '通知・お知らせの未読件数と内容・IDを確認する。mark_notification_read のためにIDが必要。',
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
          `${i + 1}件目: ${n.title ?? n.body ?? '通知'} [id:${n.id}]`
      ).join(', ')
      return `未読の通知が${unread.length}件あります。一覧（IDつき）: ${items}`
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
  description: '経費申請の状況・下書き/申請中の件数とIDを確認する。submit_expense のためにexpenseIdが必要。',
  parameters:  z.object({}),
  execute: async (_, runCtx) => {
    const ctx = runCtx!.context as WorkerAgentContext
    try {
      const res   = await apiGet('/api/expenses', ctx)
      if (!res.ok) return '経費情報を取得できませんでした。'
      const data  = await res.json()
      const items = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : [])
      const drafts = items.filter((e: { status?: string }) => e.status === 'draft')
      if (drafts.length === 0) return '提出できる経費申請（下書き）はありません。'
      const list = drafts.slice(0, 3).map(
        (e: { id: string; title?: string; amount?: number }, i: number) =>
          `${i + 1}件目: ${e.title ?? `¥${e.amount ?? '?'}`} [id:${e.id}]`
      ).join(', ')
      return `提出可能な経費申請が${drafts.length}件あります。一覧（IDつき）: ${list}`
    } catch {
      return '経費情報の取得中にエラーが発生しました。'
    }
  },
})

// propose_action: L3/L4 Write操作をユーザーに確認提案する
const proposeActionTool = tool({
  name:        'propose_action',
  description: 'L3/L4 Write操作（作業開始・完了・打刻・経費申請等）をユーザーに提案し確認を求める。実行はしない。propose_actionを呼んだ後、finalOutputに確認文を書くこと。',
  parameters:  z.object({
    action:              z.string().describe('system.start_job / system.complete_job / system.clock_in / system.clock_out / system.submit_expense / system.mark_notification_read 等'),
    params:              z.record(z.string(), z.string()).optional().describe('actionに必要なパラメータ（jobId, projectId, expenseId, notificationId等）'),
    confirmationMessage: z.string().describe('ユーザーへの確認文（例：「〇〇案件を完了にします。よろしいですか？」）'),
  }),
  execute: async ({ action, params = {}, confirmationMessage }) => {
    if (!isValidAction(action)) return `不明なAction: ${action}。対応アクション: system.start_job, system.complete_job, system.clock_in, system.clock_out, system.submit_expense, system.mark_notification_read`
    const level = getActionLevel(action)
    if (level < 3) return `${action}はConfirmation不要です。`
    if (level >= 5) return 'この操作は音声での実行が禁止されています。'
    return JSON.stringify({
      __pendingConfirmation: true,
      action,
      params,
      safetyLevel: level,
      message:     confirmationMessage,
      expiresAt:   Date.now() + CONFIRMATION_EXPIRY_MS,
    })
  },
})

// get_active_job: 今日の進行中 job ID を取得する（complete_job に必要）
const getActiveJobTool = tool({
  name:        'get_active_job',
  description: '現在進行中（in_progress）の作業Job IDを取得する。complete_job を呼ぶ前に必ずこれでjobIdを確認すること。',
  parameters:  z.object({
    projectId: z.string().optional().describe('案件ID。省略時はURLの現在案件から解決。'),
  }),
  execute: async ({ projectId }, runCtx) => {
    const ctx = runCtx!.context as WorkerAgentContext
    const pid = projectId || ctx.projectId
    try {
      // 今日のin_progress jobを検索
      const today = getJSTDateString()
      const path  = pid
        ? `/api/jobs?projectId=${pid}&status=in_progress&date=${today}`
        : `/api/jobs?status=in_progress&date=${today}`
      const res = await apiGet(path, ctx)
      if (!res.ok) {
        // フォールバック: home/data から案件を確認
        const homeRes = await apiGet('/api/home/data', ctx)
        if (!homeRes.ok) return '進行中の作業を確認できませんでした。'
        const homeData = await homeRes.json()
        const inProgress = (homeData.jobs ?? []).filter((j: { status: string }) => j.status === 'in_progress')
        if (inProgress.length === 0) return '現在進行中の作業はありません。'
        const j = inProgress[0] as { id: string; project?: { name?: string } }
        return `進行中の作業: ${j.project?.name ?? '案件'} [jobId:${j.id}]`
      }
      const data = await res.json()
      const jobs: Array<{ id: string; project_id?: string; status?: string }> =
        Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : [])
      const active = jobs.filter(j => j.status === 'in_progress')
      if (active.length === 0) return '現在進行中の作業はありません。作業を開始してください。'
      const j = active[0]
      return `進行中の作業が見つかりました [jobId:${j.id}]。complete_job の params に jobId として使ってください。`
    } catch {
      return '進行中の作業の取得中にエラーが発生しました。'
    }
  },
})

// get_quality_evaluation: AI品質評価を取得する
const getQualityEvaluationTool = tool({
  name:        'get_quality_evaluation',
  description: '作業のAI品質評価スコア・フィードバックを取得する。jobIdが必要。',
  parameters:  z.object({
    jobId: z.string().optional().describe('作業Job ID（UUID）。省略時は現在のcontextから解決。'),
  }),
  execute: async ({ jobId }, runCtx) => {
    const ctx = runCtx!.context as WorkerAgentContext
    const jid = jobId || ctx.projectId
    if (!jid) return '品質評価を確認するには作業画面を開いてください。'
    try {
      const res = await apiGet(`/api/ai/quality?jobId=${jid}`, ctx)
      if (!res.ok) return '品質評価を取得できませんでした。'
      const data = await res.json()
      const score   = data?.score   ?? data?.data?.score
      const reason  = data?.reason  ?? data?.data?.reason  ?? ''
      const issues  = data?.issues  ?? data?.data?.issues
      if (score == null) return '品質評価データがありません。AI評価画面から評価を実行してください。'
      const issuesText = Array.isArray(issues) && issues.length > 0
        ? `指摘: ${issues.slice(0, 2).join('、')}`
        : ''
      return `品質スコア: ${score}点。${reason}${issuesText ? '　' + issuesText : ''}`
    } catch {
      return '品質評価の取得中にエラーが発生しました。'
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
- 業務操作（作業開始・完了・打刻・経費申請）の安全な実行支援

## 重要なルール
- Toolで取得した情報のみを事実として扱う（存在しないJobやManualを作らない）
- Read-only Toolは必要に応じて連続使用可（最大5回）
- ユーザーが「開いて」「確認して」と言った場合のみnavigateを実行する
- 情報確認だけなら不要なnavigateをしない

## Write操作のルール（重要）
Write操作（作業開始・完了・打刻・経費申請・通知既読）は必ずpropose_actionを使う。
直接実行は禁止。必ずユーザーの確認を取ること。

propose_action の使い方:
1. まずRead Toolで必要なIDを取得する（例: get_today_jobs でprojectIdを確認）
2. propose_actionを呼ぶ（action, params, confirmationMessage を指定）
3. finalOutputに確認文を書く（例: 「〇〇の作業を完了にします。よろしいですか？」）
4. ユーザーが「はい」と言ったら自動的にServerが実行する（Agentは何もしない）

## propose_actionのactionとparamsの対応（IDの取得方法）
- system.start_job    → params: { projectId }   「〇〇の作業を開始します。よろしいですか？」
  ※ projectId は get_today_jobs または URLの currentResourceId から取得
- system.complete_job → params: { jobId }       「〇〇の作業を完了にします。よろしいですか？」
  ※ jobId は必ず先に get_active_job を呼んで取得すること。get_today_jobs のIDはprojectIdであり jobId ではない
- system.clock_in     → params: {}              「出勤を打刻します。よろしいですか？」
- system.clock_out    → params: {}              「退勤を打刻します。よろしいですか？」
- system.submit_expense → params: { expenseId } 「〇〇の経費申請を提出します。よろしいですか？」
  ※ expenseId は先に get_expense_summary を呼んで一覧のIDから取得すること
- system.mark_notification_read → params: { notificationId } 「通知を既読にします。よろしいですか？」
  ※ notificationId は先に get_notifications を呼んで IDを確認すること

## 重要：IDが不明な場合は propose_action を呼ばず、先にReadツールでIDを取得すること

## L5禁止操作（音声実行不可）
削除・権限変更・大量操作は実行不可。

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
  model:        'gpt-4o-mini',
  tools:        [
    getTodayJobsTool,
    getJobDetailsTool,
    getActiveJobTool,
    getManualsTool,
    askManualAiTool,
    getNotificationsTool,
    getScheduleTool,
    getAttendanceTool,
    getExpensesTool,
    getQualityEvaluationTool,
    proposeActionTool,
    navigateTool,
  ],
})
