// ============================================================
// JARVIS System Tool Registry — DAY1 Read-only Tools
// 各ToolはAction Registryの既存APIを通じてデータ取得する。
// Agentが直接Supabase queryすることは禁止。
// ============================================================

import type { SystemAgentTool, SystemAgentContext, ToolResult } from './types'

// ─── HTTP helper（Cookie転送でAuth維持）──────────────────────
async function apiFetch(path: string, ctx: SystemAgentContext): Promise<Response> {
  return fetch(`${ctx.baseUrl}${path}`, {
    headers: {
      Cookie: ctx.cookieHeader,
    },
    credentials: 'include',
  })
}

// ─── Tools ───────────────────────────────────────────────────

const getTodayJobs: SystemAgentTool = {
  name:        'get_today_jobs',
  description: '今日の担当作業・案件一覧を取得する',
  safetyLevel: 1,
  parameters:  { type: 'object', properties: {}, required: [] },
  async execute(_, ctx): Promise<ToolResult> {
    try {
      const res = await apiFetch('/api/home/data', ctx)
      if (!res.ok) return { success: false, text: '今日の作業情報を取得できませんでした。' }
      const data = await res.json()
      const projects: Array<{ id: string; name: string }> = data.projects ?? []
      const total = data.summary?.total ?? projects.length
      if (total === 0) return { success: true, text: '今日の担当作業はありません。', items: [] }
      const items = projects.slice(0, 5).map((p, i) => ({
        id:    p.id,
        label: `${i + 1}件目: ${p.name}`,
      }))
      const first = projects[0]
      const text = total === 1
        ? `今日は${first.name}の1件です。`
        : `今日は${total}件あります。最初は${first.name}です。`
      return { success: true, text, items, data: { total, projects } }
    } catch {
      return { success: false, text: '今日の作業情報の取得中にエラーが発生しました。' }
    }
  },
}

const getJobDetails: SystemAgentTool = {
  name:        'get_job_details',
  description: '案件・Job詳細情報を取得する。projectIdが必要。',
  safetyLevel: 1,
  parameters: {
    type:       'object',
    properties: {
      projectId: { type: 'string', description: '案件ID（UUID）' },
    },
    required: ['projectId'],
  },
  async execute(params, ctx): Promise<ToolResult> {
    const { projectId } = params
    if (!projectId) return { success: false, text: '案件IDが指定されていません。' }
    try {
      const res = await apiFetch(`/api/projects/${projectId}`, ctx)
      if (!res.ok) return { success: false, text: '案件情報を取得できませんでした。' }
      const data = await res.json()
      const name     = data?.data?.name     ?? data?.name
      const location = data?.data?.location_name ?? data?.location_name
      const text = name
        ? `案件名: ${name}${location ? `（${location}）` : ''}`
        : '案件詳細を確認してください。'
      return { success: true, text, data: data?.data ?? data }
    } catch {
      return { success: false, text: '案件情報の取得中にエラーが発生しました。' }
    }
  },
}

const getNotifications: SystemAgentTool = {
  name:        'get_notifications',
  description: '通知・お知らせの未読件数と内容を確認する',
  safetyLevel: 1,
  parameters:  { type: 'object', properties: {}, required: [] },
  async execute(_, ctx): Promise<ToolResult> {
    try {
      const res = await apiFetch('/api/notifications', ctx)
      if (!res.ok) return { success: false, text: '通知を取得できませんでした。' }
      const data = await res.json()
      const list   = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : [])
      const unread = list.filter((n: { is_read?: boolean }) => !n.is_read)
      if (unread.length === 0) return { success: true, text: '未読の通知はありません。' }
      const items = unread.slice(0, 5).map((n: { id: string; title?: string; body?: string }, i: number) => ({
        id:    n.id,
        label: `${i + 1}件目: ${n.title ?? n.body ?? '通知'}`,
      }))
      return {
        success: true,
        text:    `未読の通知が${unread.length}件あります。`,
        items,
      }
    } catch {
      return { success: false, text: '通知の取得中にエラーが発生しました。' }
    }
  },
}

const getSchedule: SystemAgentTool = {
  name:        'get_schedule',
  description: '今後のスケジュール・予定一覧を確認する',
  safetyLevel: 1,
  parameters:  { type: 'object', properties: {}, required: [] },
  async execute(_, ctx): Promise<ToolResult> {
    try {
      const res = await apiFetch('/api/schedule', ctx)
      if (!res.ok) return { success: false, text: 'スケジュールを取得できませんでした。' }
      const data  = await res.json()
      const items = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : [])
      if (items.length === 0) return { success: true, text: '今後の予定はありません。' }
      return {
        success: true,
        text:    `スケジュールに${items.length}件の予定があります。`,
        data:    { total: items.length },
      }
    } catch {
      return { success: false, text: 'スケジュールの取得中にエラーが発生しました。' }
    }
  },
}

const getManuals: SystemAgentTool = {
  name:        'get_manuals',
  description: '案件マニュアル一覧を取得する。projectIdが必要。',
  safetyLevel: 1,
  parameters: {
    type:       'object',
    properties: {
      projectId: { type: 'string', description: '案件ID（UUID）' },
    },
    required: ['projectId'],
  },
  async execute(params, ctx): Promise<ToolResult> {
    const { projectId } = params
    const pid = projectId || ctx.projectId
    if (!pid) return { success: false, text: 'マニュアルを確認するには案件の画面を開いてください。' }
    try {
      const res = await apiFetch(`/api/jobs/${pid}/manuals`, ctx)
      if (!res.ok) return { success: false, text: 'マニュアルを取得できませんでした。' }
      const data = await res.json()
      const list: Array<{ id: string; title: string }> = data.manuals ?? []
      if (list.length === 0) return { success: true, text: 'マニュアルはまだ登録されていません。' }
      const items = list.slice(0, 5).map((m, i) => ({ id: m.id, label: `${i + 1}件目: ${m.title}` }))
      const text = list.length === 1
        ? `${list[0].title}のマニュアルがあります。`
        : `マニュアルが${list.length}件あります。`
      return { success: true, text, items, data: { manuals: list } }
    } catch {
      return { success: false, text: 'マニュアルの取得中にエラーが発生しました。' }
    }
  },
}

const askManualAi: SystemAgentTool = {
  name:        'ask_manual_ai',
  description: 'マニュアルAIへ清掃手順・業務質問を問い合わせる。projectIdと質問が必要。',
  safetyLevel: 0,
  parameters: {
    type:       'object',
    properties: {
      projectId: { type: 'string', description: '案件ID（UUID）' },
      question:  { type: 'string', description: '質問内容' },
    },
    required: ['question'],
  },
  async execute(params, ctx): Promise<ToolResult> {
    const { question } = params
    const pid = params.projectId || ctx.projectId
    if (!pid) return { success: false, text: 'AI質問には案件の画面を開いてください。' }
    if (!question?.trim()) return { success: false, text: '質問内容が空です。' }
    try {
      // マニュアルAI はSSEストリーミングなので、非ストリーミングsummaryとして扱う
      // JSONモードで短い回答を要求する専用エンドポイントへ送る
      // 既存 /api/ai/manual はSSEなのでAgentからは直接使えない
      // → Agentは「マニュアルを開いてください」という提案で代替
      return {
        success: true,
        text: `「${question}」についてマニュアルで確認します。AIチャットを開いて詳しく質問できます。`,
        data: { suggestOpenChat: true, projectId: pid },
      }
    } catch {
      return { success: false, text: 'AI質問の処理中にエラーが発生しました。' }
    }
  },
}

const getAttendanceSummary: SystemAgentTool = {
  name:        'get_attendance_summary',
  description: '勤怠情報・出退勤状況のサマリーを確認する',
  safetyLevel: 1,
  parameters:  { type: 'object', properties: {}, required: [] },
  async execute(_, ctx): Promise<ToolResult> {
    try {
      const res = await apiFetch('/api/attendance', ctx)
      if (!res.ok) return { success: false, text: '勤怠情報を取得できませんでした。' }
      const data  = await res.json()
      const items = Array.isArray(data?.data) ? data.data : []
      return {
        success: true,
        text:    items.length > 0 ? `勤怠記録が${items.length}件あります。` : '勤怠記録はありません。',
      }
    } catch {
      return { success: false, text: '勤怠情報の取得中にエラーが発生しました。' }
    }
  },
}

const getExpenseSummary: SystemAgentTool = {
  name:        'get_expense_summary',
  description: '経費申請の状況・申請中件数を確認する',
  safetyLevel: 1,
  parameters:  { type: 'object', properties: {}, required: [] },
  async execute(_, ctx): Promise<ToolResult> {
    try {
      const res = await apiFetch('/api/expenses', ctx)
      if (!res.ok) return { success: false, text: '経費情報を取得できませんでした。' }
      const data    = await res.json()
      const items   = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : [])
      const pending = items.filter((e: { status?: string }) =>
        e.status === 'draft' || e.status === 'submitted'
      ).length
      return {
        success: true,
        text:    pending === 0 ? '申請中の経費はありません。' : `申請中の経費が${pending}件あります。`,
      }
    } catch {
      return { success: false, text: '経費情報の取得中にエラーが発生しました。' }
    }
  },
}

const getProfile: SystemAgentTool = {
  name:        'get_profile',
  description: 'ユーザーのプロフィール・自分の情報を確認する',
  safetyLevel: 1,
  parameters:  { type: 'object', properties: {}, required: [] },
  async execute(_, ctx): Promise<ToolResult> {
    try {
      const res = await apiFetch('/api/profile', ctx)
      if (!res.ok) return { success: false, text: 'プロフィールを取得できませんでした。' }
      const data = await res.json()
      const name = data?.data?.name ?? data?.name
      return {
        success: true,
        text:    name ? `${name}さんのプロフィールです。` : 'プロフィール画面を確認してください。',
        data:    data?.data,
      }
    } catch {
      return { success: false, text: 'プロフィールの取得中にエラーが発生しました。' }
    }
  },
}

// navigate: Agentがナビゲーションを提案するためのTool
// 実際のrouter.push()はclient側で行う（Agent APIがaction名を返す）
const navigate: SystemAgentTool = {
  name:        'navigate',
  description: '指定のページへ移動する。actionにsystem.xxx形式で指定する。',
  safetyLevel: 2,
  parameters: {
    type:       'object',
    properties: {
      action:    { type: 'string', description: 'system.go_home / system.open_job 等' },
      projectId: { type: 'string', description: '案件ページへ移動する場合のID（オプション）' },
    },
    required: ['action'],
  },
  async execute(params): Promise<ToolResult> {
    const { action, projectId } = params
    return {
      success: true,
      text:    `navigate:${action}${projectId ? `:${projectId}` : ''}`,
      data:    { action, projectId },
    }
  },
}

// ─── Registry ────────────────────────────────────────────────
export const SYSTEM_AGENT_TOOLS: SystemAgentTool[] = [
  getTodayJobs,
  getJobDetails,
  getNotifications,
  getSchedule,
  getManuals,
  askManualAi,
  getAttendanceSummary,
  getExpenseSummary,
  getProfile,
  navigate,
]

/** OpenAI tools形式に変換 */
export function toOpenAITools(tools: SystemAgentTool[]) {
  return tools.map(tool => ({
    type: 'function' as const,
    function: {
      name:        tool.name,
      description: tool.description,
      parameters:  tool.parameters,
    },
  }))
}
