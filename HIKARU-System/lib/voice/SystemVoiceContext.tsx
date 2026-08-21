'use client'
// ============================================================
// SystemVoiceContext — System (Worker) Persistent Voice Provider
// WorkerLayoutに1つだけ配置。ページ遷移後もSessionを維持する。
// Realtime(WebRTC)を標準Voice Engine。失敗時はBrowser STTへfallback。
// useSystemJarvis() で各Pageから消費する。
// ============================================================

import * as React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { browserTTS }            from '@/lib/voice/tts/browser'
import { resolveLocalIntent }    from '@/lib/voice/intent/resolver'
import { getScreenContext }      from '@/lib/voice/context/screen'
import type {
  VoiceMode, ConversationContext, LastResultData, VoiceSettings, PendingConfirmation,
} from '@/lib/voice/state/types'
import type { SystemActionName } from '@/lib/voice/registry/system.actions'
import { getJSTDateString } from '@/lib/date'

// ─── Realtime 定数 ────────────────────────────────────────────
// gpt-realtime-2.1 = @openai/agents-realtime v0.17 のデフォルトモデル。
// SDKのデフォルトconfig（semantic_vad / audio/pcm / gpt-4o-mini-transcribe）と整合する。
const RT_MODEL = 'gpt-realtime-2.1'

const RT_SYSTEM_PROMPT = `あなたはHIKARU Workerアシスタント「JARVIS」です。
清掃業務に携わる従業員の音声アシスタントとして、自然な日本語で業務をサポートします。
回答は2〜3文以内で音声向けに簡潔に。

## Navigation操作（Read-only・安全）
「〇〇を開いて」「〇〇に移動して」等のリクエストは navigate_to ツールを使う。
destinationは必ず下記のEnum値を選ぶ（自由なURLは絶対禁止）。
移動後は「〇〇を開きました」と簡潔に発話する。

destination値:
home=ホーム, attendance=勤怠管理, schedule=スケジュール,
shifts=シフト管理, expenses=経費申請, notifications=通知,
profile=プロフィール画面(開くのみ), jobs=案件一覧, assistant=アシスタント,
back=前の画面, job_detail=案件詳細, job_chat=AIチャット,
job_manual=マニュアル, job_report=報告書,
job_before=Before写真画面, job_after=After写真画面, job_evaluation=AI品質評価画面

★ 重要 — 以下は navigate_to を使わない:
「プロフィール教えて」「名前は？」「電話番号は？」「メールは？」「権限は？」
→ これらは画面移動ではなくデータ取得。get_profile ツールを呼ぶ。
→ navigate_to('profile') は「プロフィール画面開いて」等の画面遷移専用。

## Write操作（最重要ルール）
★ ツールを呼ぶ前に言葉で「完了しました」「やりました」「打刻しました」等を言うことは絶対禁止。
★ execute_confirmed_actionを呼び、Tool Resultを受け取ってから初めて成功/失敗を発話する。
★ Tool Resultがなければ何も成功していない。

確認フロー（全Write操作で必ず守る）:
1. 「出勤を打刻します。よろしいですか？」と聞く
2. ユーザーが「はい」「うん」「OK」等と答える
3. 何も言わずにexecute_confirmed_actionツールを呼ぶ（この時点で発話しない）
4. Tool Resultが返ってくる
5. Tool ResultのvoiceReplyをそのまま読み上げる
6. 失敗なら「できませんでした」とエラーを正確に伝える

## actionとparamsの対応（全Write Action）
- system.clock_in      出勤打刻（params: {}）
- system.clock_out     退勤打刻（params: {}）
- system.break_start   休憩開始（params: {}）
- system.break_end     休憩終了（params: {}）
- system.start_job     作業開始（params: { projectId: "実ID" }）
- system.complete_job  作業完了（params: { projectId: "実ID" }）
- system.submit_expense 経費申請（params: { expenseId: "実ID" }）
- system.withdraw_expense 経費取り下げ（params: { expenseId: "実ID" }）申請中のみ
- system.cancel_shift シフト取消（params: { shiftId: "実ID" }）scheduledのみ
- system.withdraw_correction 勤怠修正申請取り下げ（params: { correctionId: "実ID" }）submittedのみ
- system.mark_notification_read 通知既読（params: { notificationId: "実ID" }）
- system.mark_all_notifications_read 一括既読（params: {}）

## 案件操作完全フロー
「今日の案件教えて」→ get_today_jobs呼ぶ → 一覧を読み上げ
「1件目開いて」→ navigate_to(job_detail, jobId=取得したID)
「詳細教えて」→ get_job_details(projectId) → 詳細を読み上げ
「この作業開始して」→ get_current_context → projectId確認 → 「開始します？」→ execute_confirmed_action(start_job) → 開始成功後「Before画面を開きますか？」
「Before写真画面開いて」→ navigate_to(job_before, jobId=currentProjectId) → /jobs/[id]/before へNavigation
「After写真画面開いて」→ navigate_to(job_after, jobId=currentProjectId) → /jobs/[id]/after へNavigation
「品質評価画面開いて」→ navigate_to(job_evaluation, jobId=currentProjectId) → 画面移動のみ
「品質評価して」→ get_active_job(projectId) → jobId取得 → 「評価を実行します？」→ run_quality_evaluation(jobId) → スコア・合格数読み上げ
「作業完了して」→ get_current_context → 「完了します？」→ execute_confirmed_action(complete_job) → 完了後「報告書を生成しますか？」
「報告書画面開いて」→ navigate_to(job_report, jobId=currentProjectId) → 画面移動のみ
「報告書作って」→ get_active_job(projectId) → jobId取得 → generate_report(jobId) → スコア・生成確認発話
「報告書の内容読んで」→ get_job_report → 最新報告書のスコア・概要を読み上げ
★ Navigation（「開いて」）とAction/Data読み上げ（「して」「読んで」）を混同しない

## 追加ツール（Jobsフロー）
- get_job_details: 案件詳細・作業状態・写真進捗を取得。projectId省略時は現在ページを使用。
- run_quality_evaluation: AI品質評価を実行。jobIdが必要。get_active_jobで取得。
- generate_report: AI品質報告書を生成。jobIdが必要。生成後スコアを読み上げる。
- get_job_report: 最新報告書の内容を読み上げる。「報告書読んで」「内容教えて」に使う。navigate_toとは別。
- get_expense_detail: 経費詳細確認。expenseId省略時は現在ページから自動取得。
- create_expense_draft: 経費下書き作成。amount・categoryが必要。確認後に呼ぶ。結果にexpenseIdが含まれる。
- edit_expense_draft: 下書き状態の経費を編集。expenseId必須。変更フィールドのみ指定。

## 経費操作完全フロー（★必ずこの手順）
「経費一覧教えて」→ get_expense_summary → 「N件あります。1番目:交通費¥500 下書き expenseId=UUID」
「1件目の詳細教えて」→ get_expense_detail(expenseId=一覧のUUID) → 詳細発話
「これを編集して」→ get_expense_detail確認 → 変更内容ヒアリング → 「¥500→¥800に変更します？」→ edit_expense_draft
「申請して」→ get_current_context or 前の操作のexpenseId → 「申請します？」→ execute_confirmed_action(submit_expense,{expenseId})
「取り下げて」→ Confirmation → execute_confirmed_action(withdraw_expense,{expenseId}) → status=withdrawnになる（draft=下書きではない）
「経費登録して」→「何の経費？」→「金額は？」→ Confirmation → create_expense_draft → expenseId返却

## Context解決ルール（ID取得の順序）
ユーザーが「この作業」「今の案件」等と言った場合:
1. まず get_current_context を呼んでcurrentProjectIdを確認
2. projectIdがあれば案件名をユーザーに確認する
3. projectIdがなければ get_today_jobs で一覧取得してユーザーに選ばせる
jobIdが必要な場合（complete_job等）: get_active_jobでjobIdを取得する
IDを推測・捏造しない。必ずツールで取得した実IDを使う。

## 勤怠操作フロー例
「出勤して」→「出勤を打刻します。よろしいですか？」→「はい」→execute_confirmed_action呼ぶ→Tool Result発話
「休憩開始して」→「休憩を開始します。よろしいですか？」→「はい」→execute_confirmed_action(break_start)→発話
「休憩終わって」→execute_confirmed_action(break_end)→発話
「退勤して」→execute_confirmed_action(clock_out)→発話

## プロフィールフロー（★「教えて」「は？」系は必ず get_profile を呼ぶ。navigate_toは使わない）
以下はすべて navigate_to ではなく get_profile ツールを呼んでデータを取得し、Tool Resultを音声で読み上げる:
「プロフィール教えて」→ get_profile → 「お名前は○○です。メールは...電話は...権限は...」と読み上げ
「名前は？」「名前教えて」→ get_profile → nameを回答
「電話番号は？」「電話番号教えて」→ get_profile → phoneを回答
「メールアドレスは？」「メール教えて」→ get_profile → emailを回答
「権限は？」「役割は？」→ get_profile → roleを回答
「プロフィール画面開いて」「プロフィールを開いて」→ navigate_to('profile') で画面遷移のみ
「プロフィール変更したい」→「プロフィールの変更はアプリから行えません。管理者にご連絡ください。」
- ★ プロフィールはRead-only。更新APIなし
- ★ role・company・permission・emailをVoiceで変更しない

## 通知フロー（★必ずこの手順）
「未読通知何件？」→ get_notifications → 「未読N件あります」と発話
「通知教えて」→ get_notifications → 「N件（未読M件）あります。1件目:シフト更新 notificationId=UUID」
「1件目の詳細」→ get_notificationsで取得済みデータから読み上げ（再API呼び出し不要）
「この通知を既読にして」→「既読にします？」→ execute_confirmed_action(mark_notification_read,{notificationId:"実UUID"})
「全部既読にして」→「未読N件を全て既読にします？」→ execute_confirmed_action(mark_all_notifications_read,{})
- ★ notificationIdはget_notificationsで取得した実IDのみ使用。推測・捏造禁止
- ★ 「1件目」等はget_notifications取得済みデータから解決（AIがIDを生成しない）
- ★ 個別通知GET APIは存在しない。詳細は一覧取得済みデータを使う

## シフト操作フロー（★必ずこの手順）
「今日のシフト教えて」→ get_shift_list(date_from=今日YYYY-MM-DD, date_to=今日) → 一覧発話(shiftId含む)
「今週のシフト」→ get_shift_list(date_from=今週月曜, date_to=今週日曜) → 一覧発話
「明日シフト登録して」→ get_assigned_projects_for_shift → 案件確認 → 開始/終了時刻ヒアリング
確認例:「明日、○○店、9時〜17時でシフトを登録します。よろしいですか？」
「はい」→ create_shift(projectId=実ID, shiftDate=YYYY-MM-DD, startTime="09:00", endTime="17:00") → Read-back
「このシフト編集して」→ 変更内容ヒアリング → edit_shift(shiftId, 現在値も含む全required field, 変更値)
「このシフト取り消して」→「取消します？」→ execute_confirmed_action(cancel_shift,{shiftId:"実UUID"})
- ★ projectIdはget_assigned_projects_for_shiftで取得した実IDのみ使用
- ★ shiftIdはget_shift_listで取得した実IDのみ。推測・捏造禁止
- ★ 時刻はHH:MM形式(24時間)。edit_shiftはshiftDate・startTime・endTimeをすべて指定
- ★ scheduled状態のみ編集・取消可。confirmed/completedは変更不可

## 勤怠修正申請フロー（★必ずこの手順）
「勤怠修正したい」→ get_attendance_for_correction(date=YYYY-MM-DD) → 現在の出勤/退勤/休憩時刻を取得
「出勤時間を8時50分に」→ 修正後時刻ヒアリング確認 → 理由ヒアリング
確認発話例:「8月21日の出勤時間を9時02分から8時50分へ修正申請します。理由:打刻忘れ。申請しますか？」
「はい」→ create_attendance_correction(attendanceRecordId=実ID, workDate=YYYY-MM-DD, requestedClockIn="08:50", reason="...") → 申請後Read-back
「修正申請一覧教えて」→ get_correction_list → 「N件あります。1件目:8月21日 出勤修正 申請中 correctionId=UUID」
「1件目の詳細」→ get_correction_list結果のcorrectionIdを使って詳細発話（すでに取得済みのため再取得不要）
「この申請取り下げて」→「取り下げます？」→ execute_confirmed_action(withdraw_correction,{correctionId:"実UUID"})
- ★ attendanceRecordIdはget_attendance_for_correctionで取得した実IDのみ使用。IDを推測・捏造禁止
- ★ 時刻はHH:MM形式(24時間)。workDateと組み合わせてISOに変換する
- ★ 修正項目が1つ以上必須。理由は必須(500文字以内)
- ★ create_attendance_correction前に必ず内容を読み上げて確認を取る`

// ─── Realtime Tools（ブラウザ側。credentials: 'include' でAuth）─
// toolFactory = SDK の tool() 関数。FunctionTool を生成し invoke を持つオブジェクトを返す。
// plain object { execute } では SDK が invoke を呼べないため Tool 実行が無音で失敗する。
function buildHikaruRealtimeTools(
  router:       ReturnType<typeof useRouter>,
  projectIdRef: React.MutableRefObject<string | undefined>,
  toolFactory:  (opts: any) => any,
  pathnameRef:  React.MutableRefObject<string>,
) {
  const apiFetch = async (path: string) => {
    const res = await fetch(path, { credentials: 'include' })
    if (!res.ok) return null
    return res.json()
  }

  return [
    toolFactory({
      // 現在の画面コンテキストを返す — start_job/complete_jobのprojectId解決に使用
      name:        'get_current_context',
      description: '現在開いている画面のURL・案件IDを取得する。作業開始・完了前にprojectIdを確認するために使う。',
      parameters:  { type: 'object', properties: {}, required: [], additionalProperties: false },
      execute:     async () => {
        const path      = pathnameRef.current
        const projectId = projectIdRef.current
        // /jobs/[id]/... ページ
        const jobMatch = path?.match(/^\/jobs\/([^/]+)/)
        if (jobMatch) {
          const pid = jobMatch[1]
          return `現在 ${path} を表示中。currentProjectId=${pid}。start_job/complete_jobのparamsに{ projectId: "${pid}" }を使用。`
        }
        // /expenses/[id] ページ
        const expenseMatch = path?.match(/^\/expenses\/([^/]+)$/)
        if (expenseMatch) {
          return `現在 /expenses/${expenseMatch[1]} を表示中。currentExpenseId=${expenseMatch[1]}。submit_expense/withdraw_expenseのparamsに{ expenseId: "${expenseMatch[1]}" }を使用。`
        }
        return `現在 ${path || '/home'} を表示中。`
      },
    }),
    toolFactory({
      name:        'get_today_jobs',
      description: '今日の担当作業・案件一覧とIDを取得する',
      parameters:  { type: 'object', properties: {}, required: [], additionalProperties: false },
      execute:     async () => {
        const data = await apiFetch('/api/home/data')
        if (!data) return '今日の作業情報を取得できませんでした。'
        const ps: Array<{ id: string; name: string }> = data.projects ?? []
        if (ps.length === 0) return '今日の担当作業はありません。'
        const list = ps.slice(0, 5).map((p, i) => `${i + 1}件目: ${p.name} [id:${p.id}]`).join(', ')
        return `今日は${ps.length}件あります。${list}`
      },
    }),
    toolFactory({
      // GET /api/notifications → { notifications: [...], unread_count: N }
      // 個別GET APIは存在しない。詳細は一覧取得済みデータを使う。
      name:        'get_notifications',
      description: '通知一覧・未読件数を取得する。notificationIdを含むので「1件目」等の既読化に使える。既読化にはmark_notification_readを使う。',
      parameters:  { type: 'object', properties: {}, required: [], additionalProperties: false },
      execute:     async () => {
        const data = await apiFetch('/api/notifications')
        if (!data) return '通知を取得できませんでした。'
        // GET /api/notifications → { notifications: [...], unread_count: N }
        const list: any[]      = Array.isArray(data?.notifications) ? data.notifications : []
        const unreadCount: number = data?.unread_count ?? list.filter((n: any) => !n.is_read).length
        if (list.length === 0) return '通知はありません。'

        const TYPE_LABEL: Record<string, string> = {
          expense_approved:              '経費承認',
          expense_rejected:              '経費却下',
          shift_created:                 'シフト作成',
          shift_updated:                 'シフト更新',
          shift_cancelled:               'シフト取消',
          shift_confirmed:               'シフト確定',
          project_assigned:              '案件割り当て',
          project_unassigned:            '案件解除',
          project_cancelled:             '案件取消',
          project_paused:                '案件休止',
          project_completed:             '案件完了',
          project_details_changed:       '案件詳細変更',
          attendance_correction_approved:'勤怠修正承認',
          attendance_correction_rejected:'勤怠修正却下',
        }
        const fmtDate = (iso: string): string => {
          const d         = new Date(iso)
          const today     = new Date()
          const yesterday = new Date(today)
          yesterday.setDate(today.getDate() - 1)
          const time = d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
          if (d.toDateString() === today.toDateString())     return `今日 ${time}`
          if (d.toDateString() === yesterday.toDateString()) return `昨日 ${time}`
          return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }) + ' ' + time
        }
        const items = list.slice(0, 5).map((n: any, i: number) => {
          const status  = n.is_read ? '既読' : '未読'
          const type    = TYPE_LABEL[n.type] ?? n.type
          const bodyStr = n.body ? `「${n.body.slice(0, 30)}」` : ''
          return `${i + 1}件目: ${fmtDate(n.created_at)} [${type}] ${n.title}${bodyStr} ${status} notificationId=${n.id}`
        }).join(' / ')
        return `通知${list.length}件（未読${unreadCount}件）。${items}`
      },
    }),
    toolFactory({
      // GET /api/attendance → { data: record } ← 単一オブジェクト（配列ではない）
      name:        'get_attendance',
      description: '今日の勤怠・打刻状況を確認する',
      parameters:  { type: 'object', properties: {}, required: [], additionalProperties: false },
      execute:     async () => {
        const data = await apiFetch('/api/attendance')
        if (!data) return '勤怠情報を取得できませんでした。'
        // GET /api/attendance → { data: single_record | null }（配列ではない）
        const rec = data?.data ?? null
        if (!rec) return '本日の勤怠記録はありません。出勤打刻をしてください。'
        const fmt = (t: string | null) => t
          ? new Date(t).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
          : '未打刻'
        const breakStatus = rec.break_start && !rec.break_end ? ' (休憩中)' : ''
        return `本日: 出勤${fmt(rec.clock_in)} / 退勤${fmt(rec.clock_out)}${breakStatus}。`
      },
    }),
    toolFactory({
      // ★ GET /api/expenses → { expenses: [...] } が正しいResponse Contract
      //    data.data ではなく data.expenses を使う（修正前はここが原因でデータ0件になっていた）
      name:        'get_expense_summary',
      description: '自分の経費一覧を取得する。IDを含むので「1件目」等の選択に使える。',
      parameters:  { type: 'object', properties: {}, required: [], additionalProperties: false },
      execute:     async () => {
        const data = await apiFetch('/api/expenses')
        if (!data) return '経費情報を取得できませんでした。'
        // API returns { expenses: [...], category_labels: {...} }
        const items: any[] = Array.isArray(data?.expenses) ? data.expenses : []
        console.log('[JARVIS-expense] get_expense_summary count:', items.length)
        const CATEGORY: Record<string, string> = {
          transport: '交通費', parking: '駐車場代', supplies: '備品', consumables: '消耗品', other: 'その他',
        }
        const STATUS: Record<string, string> = {
          draft: '下書き', submitted: '申請中', approved: '承認済み',
          rejected: '却下', settled: '精算済み', withdrawn: '取り下げ',
        }
        if (items.length === 0) return '経費はありません。'
        const drafts    = items.filter((e: any) => e.status === 'draft').length
        const submitted = items.filter((e: any) => e.status === 'submitted').length
        // AIが「1件目」を参照できるよう番号とexpenseIdを明示
        const list = items.slice(0, 5).map((e: any, i: number) =>
          `${i + 1}番目: ${CATEGORY[e.category] ?? e.category} ¥${e.amount} ${STATUS[e.status] ?? e.status} expenseId=${e.id}`
        ).join(' / ')
        return `経費${items.length}件（下書き${drafts}件・申請中${submitted}件）。${list}`
      },
    }),
    toolFactory({
      // 経費詳細取得 — 特定経費の詳細を確認する
      name:        'get_expense_detail',
      description: '特定の経費の詳細を取得する。expenseId省略時は現在ページから自動取得。',
      parameters:  {
        type:       'object',
        properties: { expenseId: { type: 'string' } },
        required:             [],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { expenseId } = input ?? {}
        // 現在URLから expenseId を取得
        const pathMatch = pathnameRef.current?.match(/^\/expenses\/([^/]+)$/)
        const eid = expenseId || pathMatch?.[1]
        if (!eid) return '経費詳細を確認するにはexpenseIdが必要です。get_expense_summaryで一覧を取得してください。'
        console.log('[JARVIS-expense] get_expense_detail expenseId:', eid)
        // GET /api/expenses/[id] → { expense: {} } が正しいResponse Contract
        const res = await fetch(`/api/expenses/${eid}`, { credentials: 'include' })
        console.log('[JARVIS-expense] get_expense_detail status:', res.status)
        if (!res.ok) return `経費情報を取得できませんでした(${res.status})。`
        const resJson = await res.json()
        const expense = resJson?.expense
        if (!expense) return '経費が見つかりませんでした。'
        const CATEGORY: Record<string, string> = {
          transport: '交通費', parking: '駐車場代', supplies: '備品', consumables: '消耗品', other: 'その他',
        }
        const STATUS: Record<string, string> = {
          draft: '下書き', submitted: '申請中', approved: '承認済み',
          rejected: '却下', settled: '精算済み', withdrawn: '取り下げ',
        }
        const desc = expense.description ? `内容:${expense.description}。` : ''
        const project = expense.projects?.name ? `案件:${expense.projects.name}。` : ''
        const actionHint = expense.status === 'draft'
          ? `submit_expenseで申請できます(params:{expenseId:"${eid}"})。`
          : expense.status === 'submitted'
          ? `withdraw_expenseで取り下げできます(params:{expenseId:"${eid}"})。`
          : ''
        return `${CATEGORY[expense.category] ?? expense.category} ¥${expense.amount}。${expense.expense_date}。${STATUS[expense.status] ?? expense.status}。${desc}${project}${actionHint}`
      },
    }),
    toolFactory({
      name:        'get_active_job',
      description: '今日の進行中作業のjobIdを取得する（complete_jobで必要）',
      parameters:  {
        type: 'object',
        properties: { projectId: { type: 'string' } },
        required: [],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { projectId } = input ?? {}
        const pid   = projectId || projectIdRef.current
        const today = getJSTDateString()
        const path  = pid ? `/api/jobs?projectId=${pid}&status=in_progress&date=${today}` : `/api/jobs?status=in_progress&date=${today}`
        const data  = await apiFetch(path)
        const jobs  = Array.isArray(data?.data) ? data.data : []
        const active = jobs.filter((j: any) => j.status === 'in_progress')
        if (active.length === 0) return '進行中の作業はありません。作業を開始してください。'
        return `進行中の作業 [jobId:${active[0].id}]。complete_jobのparamsにjobIdとして使用。`
      },
    }),
    toolFactory({
      name:        'get_schedule',
      description: '今後のスケジュールを確認する',
      parameters:  { type: 'object', properties: {}, required: [], additionalProperties: false },
      execute:     async () => {
        const data = await apiFetch('/api/schedule')
        if (!data) return 'スケジュールを取得できませんでした。'
        const items = Array.isArray(data?.data) ? data.data : []
        return items.length === 0 ? '今後の予定はありません。' : `スケジュールに${items.length}件の予定があります。`
      },
    }),
    toolFactory({
      // GET /api/profile → { profile: { id, name, email, phone, role } }
      // ★ 「プロフィール教えて」「名前は？」等はこのToolを呼ぶ（navigate_toではない）
      // ★ プロフィールはRead-only。更新API・編集UIが存在しないため変更不可。
      name:        'get_profile',
      description: '★自分のプロフィール情報（氏名・メール・電話番号・権限）を取得して読み上げる。「プロフィール教えて」「名前は？」「電話は？」「メールは？」「権限は？」に使う。navigate_toとは別。',
      parameters:  { type: 'object', properties: {}, required: [], additionalProperties: false },
      execute:     async () => {
        console.log('[JARVIS-profile] get_profile called')
        const res = await fetch('/api/profile', { credentials: 'include' })
        console.log('[JARVIS-profile] /api/profile status:', res.status, 'ok:', res.ok)
        if (!res.ok) return 'プロフィール情報を取得できませんでした。'
        const data = await res.json()
        // GET /api/profile → { profile: { id, name, email, phone, role } }
        const profile = data?.profile
        console.log('[JARVIS-profile] hasName:', !!profile?.name, 'hasEmail:', !!profile?.email, 'hasPhone:', !!profile?.phone, 'hasRole:', !!profile?.role)
        if (!profile) return 'プロフィールが見つかりませんでした。'
        const ROLE: Record<string, string> = {
          admin: '管理者', worker: '作業者', client: 'オーナー',
        }
        const role  = ROLE[profile.role] ?? profile.role ?? '不明'
        const phone = profile.phone ? profile.phone : '未登録'
        return `お名前: ${profile.name}。メール: ${profile.email}。電話番号: ${phone}。権限: ${role}。プロフィールの変更はアプリ上では行えません。管理者にご連絡ください。`
      },
    }),
    toolFactory({
      // navigate_to — Allowlist Registry経由。自由URL禁止。tool()で正式なFunctionToolを生成。
      name:        'navigate_to',
      description: 'ページへ移動する。destinationは必ずEnum値から選ぶ。自由URLは絶対禁止。',
      parameters:  {
        type:       'object',
        properties: {
          destination: {
            type: 'string',
            enum: ['home', 'attendance', 'schedule', 'shifts', 'expenses', 'expenses_new', 'notifications', 'profile', 'jobs', 'assistant', 'back', 'job_detail', 'job_chat', 'job_manual', 'job_report', 'corrections', 'job_before', 'job_after', 'job_evaluation'],
          },
          jobId: { type: 'string' },
        },
        required:             ['destination'],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { destination, jobId } = input ?? {}
        const NAV: Record<string, string> = {
          home: '/home', attendance: '/attendance', schedule: '/schedule',
          shifts: '/shifts', expenses: '/expenses', expenses_new: '/expenses/new',
          notifications: '/notifications', profile: '/profile', jobs: '/jobs', assistant: '/assistant',
          corrections: '/attendance/corrections',
        }
        const LABELS: Record<string, string> = {
          home: 'ホーム', attendance: '勤怠管理', schedule: 'スケジュール',
          shifts: 'シフト管理', expenses: '経費申請', expenses_new: '経費新規登録',
          notifications: '通知', profile: 'プロフィール', jobs: '案件一覧', assistant: 'アシスタント',
          corrections: '勤怠修正申請一覧',
        }
        console.log('[JARVIS-nav] tool_called navigate_to', Date.now())
        console.log('[JARVIS-nav] destination', destination)
        if (destination === 'back') {
          router.back()
          console.log('[JARVIS-nav] router_back_called')
          return '前の画面に戻りました。'
        }
        const subPages: Record<string, string> = {
          job_detail: '', job_chat: '/chat', job_manual: '/manual', job_report: '/report',
          job_before: '/before', job_after: '/after', job_evaluation: '/evaluation',
        }
        if (destination in subPages) {
          const id = jobId || projectIdRef.current
          if (!id) return '案件を特定できません。案件一覧から選んでください。'
          const route = `/jobs/${id}${subPages[destination]}`
          console.log('[JARVIS-nav] target_route', route)
          router.push(route)
          console.log('[JARVIS-nav] router_push_called')
          const label = destination === 'job_detail' ? '案件詳細'
            : destination === 'job_chat' ? 'AIアシスタント'
            : destination === 'job_manual' ? 'マニュアル'
            : destination === 'job_report' ? '報告書'
            : destination === 'job_before' ? 'Before写真画面'
            : destination === 'job_after' ? 'After写真画面'
            : 'AI品質評価画面'
          return `${label}を開きました。`
        }
        const route = NAV[destination]
        if (!route) {
          console.log('[JARVIS-nav] unknown_destination', destination)
          return 'その画面は現在操作対象にありません。'
        }
        console.log('[JARVIS-nav] target_route', route)
        router.push(route)
        console.log('[JARVIS-nav] router_push_called')
        return `${LABELS[destination] ?? route}を開きました。`
      },
    }),
    toolFactory({
      // ★ CRITICAL: params を additionalProperties:false で全フィールド明示。
      // additionalProperties:{type:'string'} はOpenAI strict mode違反で
      // ツールが使用不可になり FAKE_SUCCESS の根本原因だった。
      name:        'execute_confirmed_action',
      description: 'ユーザーが「はい」と明確に確認した後にのみ呼ぶ。Server Auth再検証して実行。呼ぶ前に言葉で成功を言わない。',
      parameters:  {
        type:       'object',
        properties: {
          action: {
            type: 'string',
            enum: [
              'system.clock_in', 'system.clock_out',
              'system.break_start', 'system.break_end',
              'system.start_job', 'system.complete_job',
              'system.submit_expense', 'system.withdraw_expense',
              'system.cancel_shift',
              'system.withdraw_correction',
              'system.mark_notification_read',
              'system.mark_all_notifications_read',
            ],
          },
          params: {
            type:       'object',
            properties: {
              projectId:      { type: 'string' },
              jobId:          { type: 'string' },
              expenseId:      { type: 'string' },
              shiftId:        { type: 'string' },
              correctionId:   { type: 'string' },
              notificationId: { type: 'string' },
            },
            required:             [],
            additionalProperties: false,
          },
        },
        required:             ['action'],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { action, params = {} } = input ?? {}
        console.log('[JARVIS-action] execute_confirmed_action called:', action, params)
        try {
          const res = await fetch('/api/ai/confirm-action', {
            method:      'POST',
            headers:     { 'Content-Type': 'application/json' },
            credentials: 'include',
            body:        JSON.stringify({ action, params, safetyLevel: 3, expiresAt: Date.now() + 90_000 }),
          })
          const data = await res.json()
          console.log('[JARVIS-action] confirm-action result:', res.status, data)
          return res.ok ? (data.voiceReply ?? '完了しました。') : (data.error ?? '実行に失敗しました。')
        } catch (e) {
          console.error('[JARVIS-action] confirm-action error:', e)
          return '実行中にエラーが発生しました。'
        }
      },
    }),
    toolFactory({
      // 案件詳細取得 — プロジェクト情報・作業状態・写真進捗を一度に取得
      name:        'get_job_details',
      description: '案件の詳細情報・作業状態・写真撮影進捗を取得する。projectId省略時は現在ページから自動取得。',
      parameters:  {
        type:       'object',
        properties: { projectId: { type: 'string' } },
        required:             [],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { projectId } = input ?? {}
        const pid = projectId || projectIdRef.current
        if (!pid) return '案件ページを開いてから詳細を確認してください。'
        const res = await fetch(`/api/jobs/${pid}`, { credentials: 'include', cache: 'no-store' })
        if (!res.ok) return '案件情報を取得できませんでした。'
        const { project, photoSpots, todayJob, photos } = await res.json()
        if (!project) return '案件が見つかりませんでした。'
        const statusLabel = !todayJob ? '未着手' : todayJob.status === 'completed' ? '完了済み' : `作業中(jobId:${todayJob.id})`
        let photoInfo = ''
        if (photoSpots?.length > 0) {
          const spots = photoSpots as any[]
          const ph = photos as any[] ?? []
          const bef = spots.filter((s: any) => ph.some((p: any) => p.spot_id === s.id && p.photo_type === 'before')).length
          const aft = spots.filter((s: any) => ph.some((p: any) => p.spot_id === s.id && p.photo_type === 'after')).length
          const req = spots.filter((s: any) => s.is_required).length
          photoInfo = `撮影箇所${spots.length}件(必須${req}件)。Before${bef}/${spots.length}、After${aft}/${spots.length}完了。`
        }
        return `案件「${project.name}」。現場:${project.location_name ?? '-'}。状態:${statusLabel}。${photoInfo}${project.notes ? `注意:${project.notes}` : ''}`
      },
    }),
    toolFactory({
      // AI品質評価実行 — Before/After写真が揃った後にAI評価を実行する
      name:        'run_quality_evaluation',
      description: '写真をAIで品質評価する。Before/After写真を撮影後に実行。jobIdが必要(get_active_jobで取得)。',
      parameters:  {
        type:       'object',
        properties: { jobId: { type: 'string' } },
        required:             ['jobId'],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { jobId } = input ?? {}
        if (!jobId) return 'jobIdが必要です。get_active_jobで取得してください。'
        console.log('[JARVIS-action] run_quality_evaluation:', jobId)
        try {
          const res = await fetch('/api/ai/quality', {
            method:      'POST',
            headers:     { 'Content-Type': 'application/json' },
            credentials: 'include',
            body:        JSON.stringify({ action: 'evaluate-all', jobId }),
          })
          const data = await res.json()
          if (!data.success) return `品質評価に失敗しました: ${data.error?.message ?? 'エラー'}`
          // API: { success: true, data: { results:[...], summary:{total,evaluated,passed,failed,averageScore,allPassed} } }
          const s = data.data?.summary
          console.log('[JARVIS-quality] summary:', JSON.stringify(s))
          if (!s) return `品質評価を実行しましたが結果を取得できませんでした。`
          const allPassed = s?.allPassed
          return `AI品質評価が完了しました。平均スコア${s?.averageScore ?? '-'}点。合格${s?.passed ?? 0}/${s?.total ?? 0}箇所。${allPassed ? '全箇所合格です！報告書を生成しますか？' : '要改善箇所があります。再清掃が必要かもしれません。'}`
        } catch {
          return '品質評価の実行中にエラーが発生しました。'
        }
      },
    }),
    toolFactory({
      // 報告書生成 — 作業完了後にAI報告書を生成する
      name:        'generate_report',
      description: '作業完了後にAI品質報告書を生成する。jobIdが必要。get_current_contextまたはget_active_jobで取得。',
      parameters:  {
        type:       'object',
        properties: {
          jobId: { type: 'string' },
        },
        required:             ['jobId'],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { jobId } = input ?? {}
        if (!jobId) return '報告書を生成するにはjobIdが必要です。'
        console.log('[JARVIS-action] generate_report:', jobId)
        try {
          const res = await fetch('/api/ai/report', {
            method:      'POST',
            headers:     { 'Content-Type': 'application/json' },
            credentials: 'include',
            body:        JSON.stringify({ jobId }),
          })
          const data = await res.json()
          if (!res.ok) return `報告書の生成に失敗しました: ${data.error ?? 'エラー'}`
          // API: { success: true, data: { reportId, content: { summary: { overall_score, ... } } } }
          if (!data.success || !data.data?.reportId) {
            return '報告書の生成結果を確認できませんでした。'
          }
          const rid     = data.data.reportId
          const summary = data.data?.content?.summary
          const score   = summary?.overall_score ?? '-'
          const passed  = summary?.passed_count ?? '-'
          const total   = summary?.total_spots ?? '-'
          console.log('[JARVIS-report] generated reportId:', rid, 'score:', score)
          return `報告書を生成しました（ver.${data.data.content?.version ?? 1}）。総合スコア${score}点、合格${passed}/${total}箇所。報告書ページで確認できます。`
        } catch {
          return '報告書の生成中にエラーが発生しました。'
        }
      },
    }),
    toolFactory({
      // 報告書内容取得 — 現在案件の最新報告書を取得して内容を読み上げる
      // GET /api/ai/report?jobId=... → { success: true, data: [{ id, version, overall_score, created_at }] }
      // GET /api/ai/report?reportId=... → { success: true, data: { content: { summary: {...} } } }
    }),
    toolFactory({
      name:        'get_job_report',
      description: '現在の案件の最新報告書の内容を取得して読み上げる。「報告書読んで」「内容教えて」等に使う。navigate_toとは別。',
      parameters:  {
        type:       'object',
        properties: { projectId: { type: 'string', description: '案件ID（省略時は現在ページから自動取得）' } },
        required:             [],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const pid = input?.projectId || projectIdRef.current
        if (!pid) return '案件が特定できません。案件ページを開いてから試してください。'

        // 今日の完了済みjobを探す（/api/jobs → projectsWithStatus[].todayJob）
        const jobsData = await apiFetch('/api/jobs')
        const projects: any[] = Array.isArray(jobsData?.data) ? jobsData.data : []
        const project = projects.find((p: any) => p.id === pid)
        const todayJob = project?.todayJob
        const jobId = todayJob?.id
        if (!jobId) return 'この案件の今日の作業記録が見つかりません。作業を開始してください。'

        // GET /api/ai/report?jobId=xxx → 報告書一覧
        const reportsData = await apiFetch(`/api/ai/report?jobId=${jobId}`)
        if (!reportsData?.success) return '報告書を取得できませんでした。'
        const reports: any[] = Array.isArray(reportsData.data) ? reportsData.data : []
        if (reports.length === 0) return '報告書がまだ作成されていません。先に「報告書作って」で生成してください。'

        const latest = reports[0]  // created_at desc で最新が先頭
        // GET /api/ai/report?reportId=xxx → 詳細
        const reportData = await apiFetch(`/api/ai/report?reportId=${latest.id}`)
        if (!reportData?.success || !reportData.data?.content) return '報告書の内容を取得できませんでした。'

        const content = reportData.data.content
        const summary = content?.summary
        const lines = [
          `報告書 ver.${reportData.data.version}。`,
          `総合スコア: ${summary?.overall_score ?? '-'}点。`,
          `合格${summary?.passed_count ?? '-'}箇所、要確認${summary?.check_count ?? '-'}箇所、再清掃推奨${summary?.redo_count ?? '-'}箇所。`,
          summary?.work_summary        ? `作業概要: ${summary.work_summary}。`       : '',
          summary?.quality_assessment  ? `品質評価: ${summary.quality_assessment}。` : '',
          summary?.total_comment       ? `総評: ${summary.total_comment}。`           : '',
        ].filter(Boolean).join('')
        return lines
      },
    }),
    toolFactory({
      // 経費下書き作成 — 後から申請ボタンで送信するドラフトを作成
      name:        'create_expense_draft',
      description: '経費の下書きを作成する（申請はしない）。amount・categoryは必須。ユーザーに確認後に呼ぶ。',
      parameters:  {
        type:       'object',
        properties: {
          amount:       { type: 'string' },
          category:     { type: 'string', enum: ['transport', 'parking', 'supplies', 'consumables', 'other'] },
          description:  { type: 'string' },
          expense_date: { type: 'string' },
        },
        required:             ['amount', 'category'],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { amount, category, description, expense_date } = input ?? {}
        const numAmount = Number(amount)
        if (!numAmount || numAmount <= 0) return '金額が正しくありません。'
        const LABELS: Record<string, string> = {
          transport: '交通費', parking: '駐車場代', supplies: '備品', consumables: '消耗品', other: 'その他',
        }
        console.log('[JARVIS-action] create_expense_draft:', { amount: numAmount, category })
        try {
          const res = await fetch('/api/expenses', {
            method:      'POST',
            headers:     { 'Content-Type': 'application/json' },
            credentials: 'include',
            body:        JSON.stringify({
              expense_date: expense_date || getJSTDateString(),
              category,
              amount:       numAmount,
              description:  description || null,
            }),
          })
          const data = await res.json()
          // POST /api/expenses → { expense: {} } status 201
          if (!res.ok) return `経費の登録に失敗しました: ${data.error ?? 'エラー'}`
          const created = data?.expense
          const eid = created?.id ?? '不明'
          console.log('[JARVIS-expense] create_expense_draft created expenseId:', eid)
          return `${LABELS[category] ?? category}¥${numAmount.toLocaleString()}を下書きとして登録しました。expenseId=${eid}。申請するにはsubmit_expense(params:{expenseId:"${eid}"})を呼ぶか経費画面から送信できます。`
        } catch {
          return '経費の登録中にエラーが発生しました。'
        }
      },
    }),
    toolFactory({
      // 経費編集 — draft状態のみ編集可能。PUT /api/expenses/[id] を使用。
      name:        'edit_expense_draft',
      description: '下書き状態の経費を編集する。draft状態のみ可能。変更するフィールドだけ指定する。',
      parameters:  {
        type:       'object',
        properties: {
          expenseId:    { type: 'string' },
          amount:       { type: 'string' },
          category:     { type: 'string', enum: ['transport', 'parking', 'supplies', 'consumables', 'other'] },
          description:  { type: 'string' },
          expense_date: { type: 'string' },
          note:         { type: 'string' },
        },
        required:             ['expenseId'],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { expenseId, amount, category, description, expense_date, note } = input ?? {}
        // 現在URLからも取得可能
        const pathMatch = pathnameRef.current?.match(/^\/expenses\/([^/]+)$/)
        const eid = expenseId || pathMatch?.[1]
        if (!eid) return '編集する経費のIDが必要です。get_expense_summaryで取得してください。'

        const update: Record<string, any> = {}
        if (amount !== undefined)       update.amount       = Number(amount)
        if (category !== undefined)     update.category     = category
        if (description !== undefined)  update.description  = description || null
        if (expense_date !== undefined) update.expense_date = expense_date
        if (note !== undefined)         update.note         = note || null

        if (Object.keys(update).length === 0) return '変更する項目が指定されていません。'
        if (update.amount !== undefined && (isNaN(update.amount) || update.amount <= 0)) {
          return '金額が正しくありません。'
        }

        console.log('[JARVIS-expense] edit_expense_draft:', eid, update)
        // PUT /api/expenses/[id] → { expense: {} }
        const res = await fetch(`/api/expenses/${eid}`, {
          method:      'PUT',
          headers:     { 'Content-Type': 'application/json' },
          credentials: 'include',
          body:        JSON.stringify(update),
        })
        const data = await res.json()
        if (!res.ok) return `経費の編集に失敗しました: ${data.error ?? 'エラー'}`
        // Read-back from response
        const updated = data?.expense
        if (!updated) return '編集完了しましたが確認できませんでした。'
        const LABELS: Record<string, string> = {
          transport: '交通費', parking: '駐車場代', supplies: '備品', consumables: '消耗品', other: 'その他',
        }
        return `経費を更新しました。${LABELS[updated.category] ?? updated.category} ¥${updated.amount}。${updated.expense_date}。expenseId=${eid}`
      },
    }),

    // ─── シフト操作ツール群 ───────────────────────────────────

    toolFactory({
      // シフト一覧 — GET /api/shifts?date_from&date_to → { shifts: [...] }
      name:        'get_shift_list',
      description: '自分のシフト一覧を取得する。shiftIdを含む。date_from/date_toでYYYY-MM-DD形式の日付範囲を指定。',
      parameters:  {
        type:       'object',
        properties: {
          date_from: { type: 'string', description: '開始日 YYYY-MM-DD。省略時は今日。' },
          date_to:   { type: 'string', description: '終了日 YYYY-MM-DD。省略時はdate_fromと同日。' },
        },
        required:             [],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const today   = getJSTDateString()
        const from    = (input?.date_from ?? today).trim()
        const to      = (input?.date_to   ?? from).trim()
        const data    = await apiFetch(`/api/shifts?date_from=${from}&date_to=${to}`)
        if (!data) return 'シフト情報を取得できませんでした。'
        const shifts: any[] = Array.isArray(data?.shifts) ? data.shifts : []
        if (shifts.length === 0) return `${from}〜${to}のシフトはありません。`
        const STATUS: Record<string, string> = {
          scheduled: '予定', confirmed: '確定', in_progress: '作業中', completed: '完了', cancelled: '取消済',
        }
        const DAYS = ['日', '月', '火', '水', '木', '金', '土']
        const items = shifts.slice(0, 7).map((s: any, i: number) => {
          const d       = new Date(s.shift_date + 'T00:00:00')
          const day     = DAYS[d.getDay()]
          const start   = s.start_time.slice(0, 5)
          const end     = s.end_time.slice(0, 5)
          const status  = STATUS[s.status] ?? s.status
          const project = s.projects?.name ?? '案件未設定'
          const canEdit = s.status === 'scheduled' ? ' 編集/取消可' : ''
          return `${i + 1}件目: ${s.shift_date}(${day}) ${start}〜${end} ${project} ${status}${canEdit} shiftId=${s.id}`
        }).join(' / ')
        return `シフト${shifts.length}件。${items}`
      },
    }),

    toolFactory({
      // 担当案件取得（シフト登録用）— GET /api/jobs → { data: [...] }
      name:        'get_assigned_projects_for_shift',
      description: 'シフト登録に使える担当案件一覧を取得する。projectIdを含む。',
      parameters:  { type: 'object', properties: {}, required: [], additionalProperties: false },
      execute:     async () => {
        const data = await apiFetch('/api/jobs')
        if (!data) return '案件情報を取得できませんでした。'
        const projects: any[] = Array.isArray(data?.data) ? data.data : []
        if (projects.length === 0) return '担当案件がありません。管理者にお問い合わせください。'
        const items = projects.map((p: any, i: number) =>
          `${i + 1}件目: ${p.name}${p.location_name ? `（${p.location_name}）` : ''} projectId=${p.id}`
        ).join(' / ')
        return `担当案件${projects.length}件。${items}`
      },
    }),

    toolFactory({
      // シフト新規登録 — POST /api/shifts → { shift: {} } status 201
      // ★ 呼ぶ前に必ず日時・案件を読み上げてユーザー確認を取ること
      name:        'create_shift',
      description: 'シフトを新規登録する。projectId・shiftDate・startTime・endTimeが必須。必ず事前確認してから呼ぶ。',
      parameters:  {
        type:       'object',
        properties: {
          projectId: { type: 'string', description: 'get_assigned_projects_for_shiftで取得した実ID' },
          shiftDate: { type: 'string', description: '対象日 YYYY-MM-DD' },
          startTime: { type: 'string', description: '開始時刻 HH:MM（例: 09:00）' },
          endTime:   { type: 'string', description: '終了時刻 HH:MM（例: 17:00）' },
          notes:     { type: 'string', description: '備考（任意）' },
        },
        required:             ['projectId', 'shiftDate', 'startTime', 'endTime'],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { projectId, shiftDate, startTime, endTime, notes } = input ?? {}
        if (!projectId) return '案件IDが必要です。get_assigned_projects_for_shiftで取得してください。'
        if (!shiftDate) return '日付が必要です（YYYY-MM-DD形式）。'

        // HH:MM 形式へ正規化
        const parseTime = (s: string): string | null => {
          if (!s) return null
          const m1 = s.trim().match(/^(\d{1,2}):(\d{2})$/)
          if (m1) return `${m1[1].padStart(2, '0')}:${m1[2]}`
          const m2 = s.trim().match(/^(\d{1,2})時(半|\d{1,2}分?)?/)
          if (m2) {
            const h   = m2[1].padStart(2, '0')
            const min = !m2[2] ? '00' : m2[2] === '半' ? '30' : m2[2].replace(/[分]/g, '').padStart(2, '0')
            return `${h}:${min}`
          }
          return null
        }
        const st = parseTime(startTime)
        const et = parseTime(endTime)
        if (!st) return `開始時刻の形式が不正: ${startTime}。HH:MM形式で指定してください。`
        if (!et) return `終了時刻の形式が不正: ${endTime}。HH:MM形式で指定してください。`
        if (st >= et) return '終了時刻は開始時刻より後にしてください。'

        console.log('[JARVIS-shift] create_shift:', { projectId, shiftDate, st, et })
        const res = await fetch('/api/shifts', {
          method:      'POST',
          headers:     { 'Content-Type': 'application/json' },
          credentials: 'include',
          body:        JSON.stringify({ project_id: projectId, shift_date: shiftDate, start_time: st, end_time: et, notes: notes || null }),
        })
        const data = await res.json()
        // POST /api/shifts → { shift: {} } status 201
        if (!res.ok) return `シフトの登録に失敗しました: ${data.error ?? 'エラー'}`
        const shift = data?.shift
        const sid   = shift?.id ?? '不明'
        console.log('[JARVIS-shift] created shiftId:', sid)
        const projectName = shift?.projects?.name ?? ''
        return `${shiftDate} ${st}〜${et}${projectName ? ' ' + projectName : ''}のシフトを登録しました。shiftId=${sid}。編集はedit_shift、取消はexecute_confirmed_action(cancel_shift,{shiftId:"${sid}"})を使用。`
      },
    }),

    toolFactory({
      // シフト編集 — PUT /api/shifts/[id] → { shift: {} }
      // scheduled状態のみ編集可。shiftDate・startTime・endTimeは変更しない場合も現在値を指定すること。
      name:        'edit_shift',
      description: '「scheduled」状態のシフトを編集する。shiftId・shiftDate・startTime・endTimeは必須（現在値を維持する場合もget_shift_listの値を使って指定）。呼ぶ前に内容確認すること。',
      parameters:  {
        type:       'object',
        properties: {
          shiftId:   { type: 'string', description: '編集対象のシフトID（get_shift_listで取得）' },
          projectId: { type: 'string', description: '案件ID（変更する場合のみ、変更しない場合も現在値を指定）' },
          shiftDate: { type: 'string', description: '日付 YYYY-MM-DD（変更しない場合も現在値を指定）' },
          startTime: { type: 'string', description: '開始時刻 HH:MM（変更しない場合も現在値を指定）' },
          endTime:   { type: 'string', description: '終了時刻 HH:MM（変更しない場合も現在値を指定）' },
          notes:     { type: 'string', description: '備考（任意・省略時はそのまま）' },
        },
        required:             ['shiftId', 'shiftDate', 'startTime', 'endTime'],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { shiftId, projectId, shiftDate, startTime, endTime, notes } = input ?? {}
        if (!shiftId) return '編集するシフトのIDが必要です。get_shift_listで取得してください。'

        const parseTime = (s: string): string | null => {
          if (!s) return null
          const m1 = s.trim().match(/^(\d{1,2}):(\d{2})$/)
          if (m1) return `${m1[1].padStart(2, '0')}:${m1[2]}`
          const m2 = s.trim().match(/^(\d{1,2})時(半|\d{1,2}分?)?/)
          if (m2) {
            const h   = m2[1].padStart(2, '0')
            const min = !m2[2] ? '00' : m2[2] === '半' ? '30' : m2[2].replace(/[分]/g, '').padStart(2, '0')
            return `${h}:${min}`
          }
          return null
        }
        const st = parseTime(startTime)
        const et = parseTime(endTime)
        if (!st) return `開始時刻の形式が不正: ${startTime}。HH:MM形式で指定してください。`
        if (!et) return `終了時刻の形式が不正: ${endTime}。HH:MM形式で指定してください。`
        if (st >= et) return '終了時刻は開始時刻より後にしてください。'

        const body: Record<string, unknown> = { shift_date: shiftDate, start_time: st, end_time: et }
        if (projectId) body.project_id = projectId
        if (notes !== undefined) body.notes = notes || null

        console.log('[JARVIS-shift] edit_shift:', shiftId, body)
        // PUT /api/shifts/[id] → { shift: {} }
        const res = await fetch(`/api/shifts/${shiftId}`, {
          method:      'PUT',
          headers:     { 'Content-Type': 'application/json' },
          credentials: 'include',
          body:        JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) return `シフトの編集に失敗しました: ${data.error ?? 'エラー'}`
        const updated = data?.shift
        if (!updated) return '編集しましたが確認できませんでした。'
        const projectName = updated.projects?.name ?? ''
        return `シフトを更新しました。${updated.shift_date} ${updated.start_time.slice(0, 5)}〜${updated.end_time.slice(0, 5)}${projectName ? ' ' + projectName : ''}。shiftId=${shiftId}`
      },
    }),

    // ─── 勤怠修正申請ツール群 ─────────────────────────────────

    toolFactory({
      // 勤怠修正申請一覧 — GET /api/attendance/corrections → { corrections: [...] }
      name:        'get_correction_list',
      description: '勤怠修正申請の一覧を取得する。correctionIdを含むので「1件目」等の操作に使える。',
      parameters:  { type: 'object', properties: {}, required: [], additionalProperties: false },
      execute:     async () => {
        const data = await apiFetch('/api/attendance/corrections')
        if (!data) return '修正申請一覧を取得できませんでした。'
        const list: any[] = Array.isArray(data?.corrections) ? data.corrections : []
        if (list.length === 0) return '勤怠修正申請はありません。'
        const STATUS: Record<string, string> = {
          submitted: '申請中', approved: '承認済み', rejected: '却下', withdrawn: '取り下げ',
        }
        const fmtT = (t: string | null) => t
          ? new Date(t).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
          : '—'
        const items = list.slice(0, 5).map((c: any, i: number) => {
          const date   = c.attendance_records?.work_date ?? '日付不明'
          const status = STATUS[c.status] ?? c.status
          const parts  = [
            c.requested_clock_in    ? `出勤→${fmtT(c.requested_clock_in)}`    : '',
            c.requested_clock_out   ? `退勤→${fmtT(c.requested_clock_out)}`   : '',
            c.requested_break_start ? `休憩開始→${fmtT(c.requested_break_start)}` : '',
            c.requested_break_end   ? `休憩終了→${fmtT(c.requested_break_end)}`   : '',
          ].filter(Boolean).join('・')
          return `${i + 1}件目: ${date} ${parts} ${status} correctionId=${c.id}`
        }).join(' / ')
        return `修正申請${list.length}件。${items}`
      },
    }),

    toolFactory({
      // 修正申請作成のために対象日の勤怠記録を取得する
      // 今日: GET /api/attendance → { data: single_record | null }
      // 他の日: GET /api/attendance?mode=monthly&year=YYYY&month=MM → { data: records[] }
      name:        'get_attendance_for_correction',
      description: '修正申請を作るために対象日の勤怠記録（attendanceRecordId・現在の打刻時刻）を取得する。',
      parameters:  {
        type:       'object',
        properties: {
          date: {
            type:        'string',
            description: '対象日（YYYY-MM-DD形式）。省略時は今日。',
          },
        },
        required:             [],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const today      = getJSTDateString()
        const targetDate = (input?.date ?? today).trim() as string
        const fmtT = (t: string | null) => t
          ? new Date(t).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
          : '未打刻'

        let rec: any = null
        if (targetDate === today) {
          // GET /api/attendance → { data: single_record | null }
          const data = await apiFetch('/api/attendance')
          rec = data?.data ?? null
        } else {
          // GET /api/attendance?mode=monthly → { data: records[] }
          const d     = new Date(targetDate + 'T00:00:00')
          const year  = d.getFullYear()
          const month = d.getMonth() + 1
          const data  = await apiFetch(`/api/attendance?mode=monthly&year=${year}&month=${month}`)
          const recs: any[] = Array.isArray(data?.data) ? data.data : []
          rec = recs.find((r: any) => r.work_date === targetDate) ?? null
        }

        if (!rec) {
          return `${targetDate}の勤怠記録が見つかりません。打刻されていないか、対象外の日付の可能性があります。`
        }
        console.log('[JARVIS-correction] get_attendance_for_correction id:', rec.id)
        return [
          `${targetDate}の勤怠記録:`,
          `出勤${fmtT(rec.clock_in)} / 退勤${fmtT(rec.clock_out)}`,
          ` / 休憩開始${fmtT(rec.break_start)} / 休憩終了${fmtT(rec.break_end)}。`,
          `attendanceRecordId=${rec.id}。`,
          `create_attendance_correctionのparamsに{ attendanceRecordId:"${rec.id}", workDate:"${targetDate}" }を使用。`,
        ].join('')
      },
    }),

    toolFactory({
      // 勤怠修正申請作成 — POST /api/attendance/corrections → { correction: {} } status 201
      // status: 'submitted'（draftなし。作成=即申請）
      // ★ 呼ぶ前に必ず内容を読み上げてユーザーの確認を取ること
      name:        'create_attendance_correction',
      description: '勤怠修正申請を提出する。attendanceRecordId・workDate・reason必須。変更する時刻をHH:MM形式で指定。必ず事前確認してから呼ぶ。',
      parameters:  {
        type:       'object',
        properties: {
          attendanceRecordId:  { type: 'string', description: 'get_attendance_for_correctionで取得した実ID' },
          workDate:            { type: 'string', description: '対象日 YYYY-MM-DD' },
          requestedClockIn:    { type: 'string', description: '修正後出勤時刻 HH:MM（変更する場合のみ）' },
          requestedClockOut:   { type: 'string', description: '修正後退勤時刻 HH:MM（変更する場合のみ）' },
          requestedBreakStart: { type: 'string', description: '修正後休憩開始時刻 HH:MM（変更する場合のみ）' },
          requestedBreakEnd:   { type: 'string', description: '修正後休憩終了時刻 HH:MM（変更する場合のみ）' },
          reason:              { type: 'string', description: '申請理由（必須・500文字以内）' },
        },
        required:             ['attendanceRecordId', 'workDate', 'reason'],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const {
          attendanceRecordId, workDate,
          requestedClockIn, requestedClockOut, requestedBreakStart, requestedBreakEnd,
          reason,
        } = input ?? {}

        if (!attendanceRecordId) return '勤怠記録IDが必要です。get_attendance_for_correctionで取得してください。'
        if (!workDate)           return '対象日（workDate YYYY-MM-DD）が必要です。'
        if (!reason?.trim())     return '申請理由を入力してください。'

        // HH:MM → ISO UTC 変換（ブラウザローカルタイムゾーン使用・JST環境で正常動作）
        const toISO = (hhmm: string | null | undefined): string | null => {
          if (!hhmm) return null
          const m = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/)
          if (!m) return null
          const dt = new Date(`${workDate}T${m[1].padStart(2, '0')}:${m[2]}:00`)
          return isNaN(dt.getTime()) ? null : dt.toISOString()
        }

        const req_ci = toISO(requestedClockIn)
        const req_co = toISO(requestedClockOut)
        const req_bs = toISO(requestedBreakStart)
        const req_be = toISO(requestedBreakEnd)

        if (!req_ci && !req_co && !req_bs && !req_be) {
          return '修正する時刻を1つ以上指定してください。HH:MM形式（例: 08:50）で指定してください。'
        }
        // 無効フォーマットチェック
        if ((requestedClockIn && !req_ci) || (requestedClockOut && !req_co) ||
            (requestedBreakStart && !req_bs) || (requestedBreakEnd && !req_be)) {
          return '時刻の形式が不正です。HH:MM形式（例: 08:50）で指定してください。'
        }

        console.log('[JARVIS-correction] create_attendance_correction:', attendanceRecordId, { req_ci, req_co, req_bs, req_be })
        const res = await fetch('/api/attendance/corrections', {
          method:      'POST',
          headers:     { 'Content-Type': 'application/json' },
          credentials: 'include',
          body:        JSON.stringify({
            attendance_record_id:  attendanceRecordId,
            requested_clock_in:    req_ci,
            requested_clock_out:   req_co,
            requested_break_start: req_bs,
            requested_break_end:   req_be,
            reason:                reason.trim(),
          }),
        })
        const data = await res.json()
        // POST /api/attendance/corrections → { correction: {} } status 201
        if (!res.ok) return `修正申請に失敗しました: ${data.error ?? 'エラー'}`

        const correction = data?.correction
        const cid = correction?.id ?? '不明'
        console.log('[JARVIS-correction] created correctionId:', cid)
        return `勤怠修正申請を提出しました。correctionId=${cid}。管理者の確認をお待ちください。取り下げる場合はexecute_confirmed_action(withdraw_correction,{correctionId:"${cid}"})を使用。`
      },
    }),
  ]
}

// ─── STT型補完 ───────────────────────────────────────────────
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string
}
type SpeechRecognitionInstance = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number
  start(): void; stop(): void; abort(): void
  onresult:  ((e: SpeechRecognitionEvent) => void) | null
  onerror:   ((e: SpeechRecognitionErrorEvent) => void) | null
  onend:     (() => void) | null
}

interface IntentResult {
  action:     SystemActionName | null
  confidence: number
  params:     Record<string, string>
  voiceReply: string | null
}

export interface SystemVoiceChatMessage {
  role:      'user' | 'assistant'
  text:      string
  timestamp: number
}

// ─── セッション設定 ──────────────────────────────────────────
const SESSION_STOP_RE    = /^(終了|やめて|止めて|ストップ|セッション終了|会話終了|閉じて|おしまい|終わり)$/
// 確認「はい」判定 — 完全一致セット + 特定パターン包含（誤検知リスクの単語を除外）
const CONFIRM_YES_EXACT  = new Set(['はい', 'うん', 'ええ', 'ok', 'OK', 'オーケー', 'そう', 'そうです', 'もちろん', 'わかりました', 'わかった'])
const CONFIRM_YES_STARTS = ['よろし', 'お願いします', 'いいです', 'いいよ', 'それでお願い', '実行して', '進めて', 'そうして', '承認します']
// 'いい'単独・'やって'・'してください'・'お願い'単独 は誤検知リスクが高いため除外

const CONFIRM_NO_EXACT   = new Set(['いいえ', 'いや', 'ノー'])
const CONFIRM_NO_STARTS  = ['やめ', 'キャンセル', 'やっぱり', '違います', '戻して', '実行しない', 'ストップ', '取り消し', '却下']

function isConfirmYes(text: string): boolean {
  const t = text.trim()
  if (!t || t.length > 20) return false
  if (CONFIRM_YES_EXACT.has(t)) return true
  return CONFIRM_YES_STARTS.some(w => t.startsWith(w) || t === w)
}
function isConfirmNo(text: string): boolean {
  const t = text.trim()
  if (!t || t.length > 25) return false
  if (CONFIRM_NO_EXACT.has(t)) return true
  return CONFIRM_NO_STARTS.some(w => t.startsWith(w) || t.includes(w))
}
const STANDBY_MS = 60_000  // 60s 無発話 → Standby表示（Sessionは「終了」発声まで継続）

// ─── Voice Settings localStorage ─────────────────────────────
const LS_KEY = 'hikaru_system_voice_settings'

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  voiceURI: '',
  rate:     1.0,
  pitch:    1.0,
  volume:   1.0,
}

function loadVoiceSettings(): VoiceSettings {
  if (typeof window === 'undefined') return DEFAULT_VOICE_SETTINGS
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return DEFAULT_VOICE_SETTINGS
    return { ...DEFAULT_VOICE_SETTINGS, ...JSON.parse(raw) }
  } catch { return DEFAULT_VOICE_SETTINGS }
}

function saveVoiceSettings(s: VoiceSettings): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)) } catch {}
}

// ─── Voice Engine Mode ────────────────────────────────────────
// 'realtime'            = WebRTC Realtime（標準経路）
// 'realtime-connecting' = Realtime 接続試行中
// 'browser'             = Browser STT fallback
// 'off'                 = Session 未開始
export type VoiceEngineMode = 'realtime' | 'realtime-connecting' | 'browser' | 'off'

// ─── Context型 ───────────────────────────────────────────────
export interface SystemVoiceContextValue {
  mode:               VoiceMode
  isSession:          boolean
  isStandby:          boolean
  transcript:         string
  response:           string
  errorMessage:       string
  messages:           SystemVoiceChatMessage[]
  voiceSettings:      VoiceSettings
  setVoiceSettings:   (s: VoiceSettings) => void
  isSpeechSupported:  boolean
  voiceEngineMode:    VoiceEngineMode
  setVoiceEngineMode: (m: VoiceEngineMode) => void
  connectRealtime:    () => void
  disconnectRealtime: () => void
  startListening:     () => void
  stopAll:            () => void
  startSession:       () => void
  stopSession:        () => void
  handleUtterance:    (text: string) => Promise<void>
  interrupt:          () => void
  currentProjectId:   string | undefined
}

const SystemVoiceContext = React.createContext<SystemVoiceContextValue | null>(null)

// ─── L1 データ取得 ───────────────────────────────────────────
interface L1Result { text: string; data: LastResultData }

async function fetchL1Result(action: SystemActionName, projectId?: string): Promise<L1Result> {
  const none = (text: string): L1Result => ({ text, data: { type: 'none' } })
  try {
    switch (action) {
      case 'system.get_today_jobs': {
        const res = await fetch('/api/home/data', { credentials: 'include' })
        if (!res.ok) return none('今日の作業情報を取得できませんでした。')
        const data = await res.json()
        const projects: Array<{ id: string; name: string }> = data.projects ?? []
        const total = data.summary?.total ?? projects.length
        if (total === 0) return none('今日の担当作業はまだありません。')
        const items = projects.slice(0, 5).map((p, i) => ({ id: p.id, label: `${i + 1}件目: ${p.name}` }))
        const first = projects[0]
        const text = total === 1
          ? `今日は${first.name}の1件です。開きますか？`
          : `今日は${total}件あります。最初は${first.name}です。開きますか？`
        return { text, data: { type: 'job_list', items } }
      }
      case 'system.get_notifications': {
        // GET /api/notifications → { notifications: [...], unread_count: N }
        const res = await fetch('/api/notifications', { credentials: 'include' })
        if (!res.ok) return none('通知を取得できませんでした。')
        const data  = await res.json()
        const unread: number = data?.unread_count ?? 0
        return none(unread === 0 ? '未読の通知はありません。' : `未読の通知が${unread}件あります。読み上げますか？`)
      }
      case 'system.get_schedule': {
        const res = await fetch('/api/schedule', { credentials: 'include' })
        if (!res.ok) return none('スケジュールを取得できませんでした。')
        const data = await res.json()
        const items = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : [])
        return none(items.length === 0 ? '今後の予定はありません。' : `スケジュールに${items.length}件の予定があります。`)
      }
      case 'system.get_shifts': {
        // GET /api/shifts → { shifts: [...] } が正しいResponse Contract
        const today = getJSTDateString()
        const res = await fetch(`/api/shifts?date_from=${today}`, { credentials: 'include' })
        if (!res.ok) return none('シフトを取得できませんでした。')
        const data = await res.json()
        const items = Array.isArray(data?.shifts) ? data.shifts : []
        return none(items.length === 0 ? 'シフトはありません。' : `今後のシフトが${items.length}件あります。`)
      }
      case 'system.get_attendance':
        return none('勤怠画面に詳細を表示します。')
      case 'system.get_expenses': {
        const res = await fetch('/api/expenses', { credentials: 'include' })
        if (!res.ok) return none('経費情報を取得できませんでした。')
        const data = await res.json()
        // GET /api/expenses → { expenses: [...] } が正しいResponse Contract
        const items   = Array.isArray(data?.expenses) ? data.expenses : []
        const pending = items.filter((e: { status?: string }) => e.status === 'draft' || e.status === 'submitted').length
        return none(pending === 0 ? '申請中の経費はありません。' : `申請中の経費が${pending}件あります。`)
      }
      case 'system.get_manuals': {
        if (!projectId) return none('マニュアルを確認するには案件の画面を開いてください。')
        const res = await fetch(`/api/jobs/${projectId}/manuals`, { credentials: 'include' })
        if (!res.ok) return none('マニュアルを取得できませんでした。')
        const data = await res.json()
        const list: Array<{ id: string; title: string }> = data.manuals ?? []
        if (list.length === 0) return none('マニュアルはまだ登録されていません。')
        const items = list.slice(0, 5).map((m, i) => ({ id: m.id, label: `${i + 1}件目: ${m.title}` }))
        const text = list.length === 1
          ? `${list[0].title}のマニュアルがあります。読み上げますか？`
          : `マニュアルが${list.length}件あります。どれを確認しますか？`
        return { text, data: { type: 'manual_list', items } }
      }
      case 'system.get_profile': {
        // GET /api/profile → { profile: { id, name, email, phone, role } }
        const res = await fetch('/api/profile', { credentials: 'include' })
        if (!res.ok) return none('プロフィールを取得できませんでした。')
        const data   = await res.json()
        const p      = data?.profile
        if (!p) return none('プロフィール情報が見つかりませんでした。')
        const ROLE: Record<string, string> = { admin: '管理者', worker: '作業者', client: 'オーナー' }
        const role  = ROLE[p.role] ?? p.role ?? '不明'
        const phone = p.phone ? p.phone : '未登録'
        return none(`${p.name}さんのプロフィールです。メール: ${p.email}。電話番号: ${phone}。権限: ${role}。`)
      }
      case 'system.get_job_detail': {
        if (!projectId) return none('案件の画面を開いてから確認してください。')
        // GET /api/projects/[projectId] → { project: {}, spots: [], todayJob: {}, photos: [] }
        const res = await fetch(`/api/projects/${projectId}`, { credentials: 'include' })
        if (!res.ok) return none('案件情報を取得できませんでした。')
        const data = await res.json()
        const name = data?.project?.name
        return none(name ? `現在の案件は${name}です。作業内容を確認しますか？` : '案件詳細を確認してください。')
      }
      default:
        return none('')
    }
  } catch {
    return none('データの取得中にエラーが発生しました。')
  }
}

// ─── L2 ナビゲーション ────────────────────────────────────────
function executeL2Navigation(
  action: SystemActionName,
  router:    ReturnType<typeof useRouter>,
  projectId?: string
): string {
  switch (action) {
    case 'system.go_home':            router.push('/home');                  return 'ホームに移動します'
    case 'system.go_back':            router.back();                         return '前の画面に戻ります'
    case 'system.open_notifications': router.push('/notifications');         return '通知画面を開きます'
    case 'system.open_schedule':      router.push('/schedule');              return 'スケジュールを開きます'
    case 'system.open_shifts':        router.push('/shifts');                return 'シフト管理画面を開きます'
    case 'system.open_attendance':    router.push('/attendance');            return '勤怠管理画面を開きます'
    case 'system.open_expenses':      router.push('/expenses');              return '経費申請画面を開きます'
    case 'system.open_profile':       router.push('/profile');               return 'プロフィール画面を開きます'
    case 'system.open_jobs_list':     router.push('/jobs');                  return '案件一覧を開きます'
    case 'system.open_job':
      if (!projectId) return '案件が特定できません。案件一覧から選んでください。'
      router.push(`/jobs/${projectId}`);                                     return '案件画面を開きます'
    case 'system.open_chat':
    case 'system.ask_manual':
      if (!projectId) return 'AI質問には案件の画面から入ってください。'
      router.push(`/jobs/${projectId}/chat`);                               return 'AIアシスタントを開きます'
    case 'system.open_manual':
      if (!projectId) return 'マニュアルを開くには案件の画面を開いてください。'
      router.push(`/jobs/${projectId}/manual`);                             return 'マニュアルを開きます'
    case 'system.open_before_camera':
      if (!projectId) return '案件の画面を開いてからBefore写真を撮影してください。'
      router.push(`/jobs/${projectId}/before`);                             return 'Before写真画面を開きます'
    case 'system.open_after_camera':
      if (!projectId) return '案件の画面を開いてからAfter写真を撮影してください。'
      router.push(`/jobs/${projectId}/after`);                              return 'After写真画面を開きます'
    case 'system.open_evaluation':
      if (!projectId) return 'AI評価には案件の画面を開いてください。'
      router.push(`/jobs/${projectId}/evaluation`);                         return 'AI品質評価画面を開きます'
    case 'system.open_report':
      if (!projectId) return '報告書を開くには案件の画面を開いてください。'
      router.push(`/jobs/${projectId}/report`);                             return '報告書画面を開きます'
    default:
      return ''
  }
}

// ─── Provider ────────────────────────────────────────────────
export function SystemVoiceProvider({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()

  // URL から現在のprojectIdを自動抽出
  const screenCtx        = React.useMemo(() => getScreenContext(pathname), [pathname])
  const currentProjectId = screenCtx.currentResourceId

  const [mode,            setMode]             = React.useState<VoiceMode>('idle')
  const [transcript,      setTranscript]       = React.useState('')
  const [response,        setResponse]         = React.useState('')
  const [errorMessage,    setErrorMessage]     = React.useState('')
  const [messages,        setMessages]         = React.useState<SystemVoiceChatMessage[]>([])
  const [isSession,       setIsSession]        = React.useState(false)
  const [isStandby,       setIsStandby]        = React.useState(false)
  const [voiceSettings,   setVoiceSettingsSt]  = React.useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS)
  const [voiceEngineMode, setVoiceEngineMode]  = React.useState<VoiceEngineMode>('off')

  // ─── Realtime refs ────────────────────────────────────────────
  const realtimeSessionRef    = React.useRef<any>(null)
  const voiceEngineModeRef    = React.useRef<VoiceEngineMode>('off')
  const micTrackRef      = React.useRef<MediaStreamTrack | null>(null)
  const isSpeakingRef    = React.useRef(false)
  const resumeTimerRef   = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const streamingTranscriptRef = React.useRef('')

  React.useEffect(() => { voiceEngineModeRef.current = voiceEngineMode }, [voiceEngineMode])

  // localStorage から設定をロード（クライアントサイドのみ）
  React.useEffect(() => { setVoiceSettingsSt(loadVoiceSettings()) }, [])

  const setVoiceSettings = React.useCallback((s: VoiceSettings) => {
    setVoiceSettingsSt(s)
    saveVoiceSettings(s)
  }, [])

  const recognitionRef     = React.useRef<SpeechRecognitionInstance | null>(null)
  const modeRef            = React.useRef<VoiceMode>('idle')
  const isSessionRef       = React.useRef(false)
  const standbyTimerRef    = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const sessionTimerRef    = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const startListeningRef  = React.useRef<() => void>(() => {})
  const connectRealtimeRef = React.useRef<() => void>(() => {})
  const conversationCtxRef = React.useRef<ConversationContext>({})
  const messagesRef        = React.useRef<SystemVoiceChatMessage[]>([])
  const voiceSettingsRef   = React.useRef<VoiceSettings>(DEFAULT_VOICE_SETTINGS)
  const projectIdRef       = React.useRef<string | undefined>(undefined)
  const pathnameRef        = React.useRef(pathname)

  React.useEffect(() => { voiceSettingsRef.current = voiceSettings },  [voiceSettings])
  React.useEffect(() => { projectIdRef.current     = currentProjectId }, [currentProjectId])
  React.useEffect(() => { pathnameRef.current      = pathname },        [pathname])

  const isSpeechSupported = React.useMemo(() => {
    if (typeof window === 'undefined') return false
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
  }, [])

  const setModeSync = React.useCallback((m: VoiceMode) => {
    modeRef.current = m
    setMode(m)
  }, [])

  // ─── Mic / Resume Timer ───────────────────────────────────────
  const clearResumeTimer = React.useCallback(() => {
    if (resumeTimerRef.current) { clearTimeout(resumeTimerRef.current); resumeTimerRef.current = null }
  }, [])

  const findMicTrack = React.useCallback(() => {
    if (micTrackRef.current) return
    try {
      const transport = (realtimeSessionRef.current as any)?.transport
      if (!transport) return
      const pc: RTCPeerConnection | undefined =
        transport.peerConnection ?? transport._peerConnection ?? transport.pc
      if (!pc) return
      for (const sender of pc.getSenders()) {
        if (sender.track?.kind === 'audio') { micTrackRef.current = sender.track; break }
      }
    } catch {}
  }, [])

  // Tool実行中のMute — SDKのmute()のみ使用。WebRTC track直接操作は行わない。
  // semantic_vad+WebRTC環境ではSDKをPrimaryにし、track.enabled競合を排除する。
  const muteMic = React.useCallback((mute: boolean) => {
    try { (realtimeSessionRef.current as any)?.mute?.(mute) } catch {}
  }, [])

  const interrupt = React.useCallback(() => {
    clearResumeTimer()
    try { (realtimeSessionRef.current as any)?.interrupt?.() } catch {}
    isSpeakingRef.current = false
    muteMic(false)
    setModeSync('listening')
  }, [clearResumeTimer, muteMic, setModeSync])

  // ─── Standby / Session Timeout 管理 ─────────────────────────
  const clearActivityTimers = React.useCallback(() => {
    if (standbyTimerRef.current)  clearTimeout(standbyTimerRef.current)
    if (sessionTimerRef.current)  clearTimeout(sessionTimerRef.current)
  }, [])

  const scheduleStandby = React.useCallback(() => {
    clearActivityTimers()
    if (!isSessionRef.current) return
    setIsStandby(false)
    standbyTimerRef.current = setTimeout(() => {
      if (!isSessionRef.current) return
      setIsStandby(true)
      // Standby表示のみ。Sessionはユーザーが「終了」と言うまで継続。
    }, STANDBY_MS)
  }, [clearActivityTimers])

  const addMessage = React.useCallback((role: 'user' | 'assistant', text: string) => {
    setMessages(prev => {
      const next = [...prev.slice(-19), { role, text, timestamp: Date.now() }]
      messagesRef.current = next
      return next
    })
  }, [])

  const speakAndMaybeResume = React.useCallback((text: string) => {
    modeRef.current = 'speaking'
    setMode('speaking')
    browserTTS.speak(text, () => {
      if (isSessionRef.current) {
        setTimeout(() => { if (isSessionRef.current) startListeningRef.current() }, 400)
      } else {
        modeRef.current = 'idle'
        setMode('idle')
      }
    }, voiceSettingsRef.current)
  }, [])

  const stopAll = React.useCallback(() => {
    clearActivityTimers()
    clearResumeTimer()
    isSessionRef.current = false
    isSpeakingRef.current = false
    setIsSession(false)
    setIsStandby(false)
    recognitionRef.current?.abort()
    browserTTS.stop()
    setModeSync('idle')
    setErrorMessage('')
    // Realtime も切断
    try { realtimeSessionRef.current?.close?.() }      catch {}
    try { realtimeSessionRef.current?.disconnect?.() } catch {}
    realtimeSessionRef.current = null
    micTrackRef.current = null
    setVoiceEngineMode('off')
    voiceEngineModeRef.current = 'off'
  }, [clearActivityTimers, clearResumeTimer, setModeSync])

  const stopSession = React.useCallback(() => {
    clearActivityTimers()
    clearResumeTimer()
    isSessionRef.current = false
    isSpeakingRef.current = false
    setIsSession(false)
    setIsStandby(false)
    recognitionRef.current?.abort()
    browserTTS.stop()
    setModeSync('idle')
    setErrorMessage('')
    // Realtime も切断
    try { realtimeSessionRef.current?.close?.() }      catch {}
    try { realtimeSessionRef.current?.disconnect?.() } catch {}
    realtimeSessionRef.current = null
    micTrackRef.current = null
    setVoiceEngineMode('off')
    voiceEngineModeRef.current = 'off'
  }, [clearActivityTimers, clearResumeTimer, setModeSync])

  const finishWithError = React.useCallback((msg: string) => {
    setErrorMessage(msg)
    setModeSync('error')
    setTimeout(() => {
      setModeSync('idle')
      setErrorMessage('')
      if (isSessionRef.current) {
        setTimeout(() => { if (isSessionRef.current) startListeningRef.current() }, 800)
      }
    }, 3500)
  }, [setModeSync])

  const executeAction = React.useCallback(async (result: IntentResult) => {
    const { action, confidence, voiceReply } = result

    if (!action || confidence < 0.6) {
      const msg = '発話の意図を理解できませんでした。もう一度お話しください。'
      setResponse(msg)
      addMessage('assistant', msg)
      speakAndMaybeResume(msg)
      return
    }

    const isNavAction = action === 'system.ask_manual'
      || action === 'system.open_chat'
      || action.startsWith('system.open_')
      || action === 'system.go_home'
      || action === 'system.go_back'

    if (isNavAction) {
      const effectiveProjectId = result.params?.projectId || projectIdRef.current
      const navReply = executeL2Navigation(action, router, effectiveProjectId)
      const reply    = voiceReply ?? navReply
      setResponse(reply)
      addMessage('assistant', reply)
      conversationCtxRef.current = {
        lastIntent:    action,
        lastAction:    action,
        lastResultData: conversationCtxRef.current.lastResultData,
      }
      speakAndMaybeResume(reply)
      return
    }

    const l1    = await fetchL1Result(action, projectIdRef.current)
    const reply = voiceReply ?? l1.text
    setResponse(reply)
    addMessage('assistant', reply)
    conversationCtxRef.current = { lastIntent: action, lastAction: action, lastResultData: l1.data }
    speakAndMaybeResume(reply)
  }, [router, addMessage, speakAndMaybeResume])

  // ─── Confirmed Action 実行 ───────────────────────────────────
  const executeConfirmedAction = React.useCallback(async (pending: PendingConfirmation) => {
    setModeSync('processing')
    try {
      const res = await fetch('/api/ai/confirm-action', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({
          action:      pending.action,
          params:      pending.params,
          safetyLevel: pending.safetyLevel,
          expiresAt:   pending.expiresAt,
        }),
      })
      const data = await res.json()
      const reply = res.ok
        ? (data.voiceReply ?? '完了しました。')
        : (data.error     ?? '実行に失敗しました。')
      setResponse(reply)
      addMessage('assistant', reply)
      conversationCtxRef.current = {
        ...conversationCtxRef.current,
        lastIntent:          pending.action,
        lastAction:          pending.action,
        pendingConfirmation: undefined,
      }
      speakAndMaybeResume(reply)
    } catch {
      finishWithError('実行中にエラーが発生しました。')
    }
  }, [addMessage, speakAndMaybeResume, finishWithError, setModeSync])

  const handleUtterance = React.useCallback(async (utterance: string) => {
    // ─── 期限切れ pendingConfirmation の自動クリア ───────────────
    const expiredPending = conversationCtxRef.current.pendingConfirmation
    if (expiredPending && Date.now() > expiredPending.expiresAt) {
      conversationCtxRef.current = { ...conversationCtxRef.current, pendingConfirmation: undefined }
      if (isConfirmYes(utterance.trim()) || isConfirmNo(utterance.trim())) {
        const msg = '確認の有効期限が切れました。もう一度操作してください。'
        setResponse(msg); addMessage('user', utterance); addMessage('assistant', msg)
        speakAndMaybeResume(msg)
        return
      }
      // 別の発話ならそのまま処理継続
    }

    // セッション停止ワード
    if (isSessionRef.current && SESSION_STOP_RE.test(utterance.trim())) {
      addMessage('user', utterance)
      addMessage('assistant', '会話を終了します')
      isSessionRef.current = false
      setIsSession(false)
      clearActivityTimers()
      setIsStandby(false)
      speakAndMaybeResume('会話を終了します')
      return
    }

    // ─── Confirmation 待ち中の「はい/いいえ」処理 ─────────────
    const pending = conversationCtxRef.current.pendingConfirmation
    if (pending) {
      scheduleStandby()
      setIsStandby(false)
      setTranscript(utterance)
      addMessage('user', utterance)
      if (isConfirmYes(utterance.trim())) {
        await executeConfirmedAction(pending)
        return
      }
      if (isConfirmNo(utterance.trim())) {
        conversationCtxRef.current = { ...conversationCtxRef.current, pendingConfirmation: undefined }
        const msg = 'キャンセルしました。'
        setResponse(msg)
        addMessage('assistant', msg)
        speakAndMaybeResume(msg)
        return
      }
      // 別の発話 → pendingをクリアして通常処理
      conversationCtxRef.current = { ...conversationCtxRef.current, pendingConfirmation: undefined }
    }

    scheduleStandby()
    setIsStandby(false)
    setTranscript(utterance)
    addMessage('user', utterance)
    setModeSync('processing')

    const localResult = resolveLocalIntent(utterance)
    if (localResult?.action && localResult.confidence >= 0.6) {
      await executeAction(localResult)
      return
    }

    // ─── ローカル書き込み提案（AI不要・即時応答）───────────────────
    // 出勤/退勤打刻は毎日使う最頻出操作なのでAI経由を省略
    const text = utterance.trim()
    const hasClockIn  = /出勤|チェックイン|始業|きました|来ました/.test(text) || (text.includes('打刻') && !text.includes('退勤') && !text.includes('帰'))
    const hasClockOut = /退勤|チェックアウト|終業|帰り|帰ります|上がり/.test(text)
    if (hasClockIn && !hasClockOut) {
      const confirm: PendingConfirmation = {
        action: 'system.clock_in', params: {}, safetyLevel: 3,
        message: '出勤を打刻します。よろしいですか？',
        expiresAt: Date.now() + 5 * 60 * 1000,
      }
      conversationCtxRef.current = { ...conversationCtxRef.current, pendingConfirmation: confirm }
      const reply = '出勤を打刻します。よろしいですか？'
      setResponse(reply); addMessage('assistant', reply); speakAndMaybeResume(reply)
      return
    }
    if (hasClockOut) {
      const confirm: PendingConfirmation = {
        action: 'system.clock_out', params: {}, safetyLevel: 3,
        message: '退勤を打刻します。よろしいですか？',
        expiresAt: Date.now() + 5 * 60 * 1000,
      }
      conversationCtxRef.current = { ...conversationCtxRef.current, pendingConfirmation: confirm }
      const reply = '退勤を打刻します。よろしいですか？'
      setResponse(reply); addMessage('assistant', reply); speakAndMaybeResume(reply)
      return
    }

    try {
      const ctx = getScreenContext(pathnameRef.current)
      const recentMessages = messagesRef.current.slice(-6).map(m => ({ role: m.role, content: m.text }))

      const requestBody = {
        utterance,
        currentPath:         pathnameRef.current,
        currentResourceId:   projectIdRef.current ?? ctx.currentResourceId,
        contextType:         ctx.contextType,
        recentMessages,
        lastIntent:          conversationCtxRef.current.lastIntent,
        lastResultData:      conversationCtxRef.current.lastResultData,
        previousResponseId:  conversationCtxRef.current.previousResponseId,
      }

      // SDK経路（Agents SDK + Responses API）を優先
      // 失敗時は既存 /api/ai/agent へfallback
      let result: Record<string, unknown> | null = null
      let usedSdkRoute = false

      try {
        const sdkRes = await fetch('/api/ai/agent-sdk', {
          method:      'POST',
          headers:     { 'Content-Type': 'application/json' },
          credentials: 'include',
          body:        JSON.stringify(requestBody),
        })
        if (sdkRes.ok) {
          result = await sdkRes.json()
          usedSdkRoute = true
        }
      } catch {}

      if (!result || (result as any).error) {
        // SDK失敗 → 既存Agentへfallback
        const fallbackRes = await fetch('/api/ai/agent', {
          method:      'POST',
          headers:     { 'Content-Type': 'application/json' },
          credentials: 'include',
          body:        JSON.stringify(requestBody),
        })
        if (!fallbackRes.ok) { finishWithError('音声アシスタントへの接続に失敗しました。'); return }
        result = await fallbackRes.json()
        usedSdkRoute = false
      }

      if (!result) { finishWithError('音声アシスタントへの接続に失敗しました。'); return }

      // Conversation Contextを更新
      conversationCtxRef.current = {
        ...conversationCtxRef.current,
        ...(result.resultData ? { lastResultData: result.resultData as any } : {}),
        ...(usedSdkRoute && result.previousResponseId
          ? { previousResponseId: result.previousResponseId as string }
          : {}),
        ...(result.pendingConfirmation
          ? { pendingConfirmation: result.pendingConfirmation as PendingConfirmation }
          : {}),
      }

      // Stateless Confirmation: AgentがL3/L4操作を提案している
      if (result.pendingConfirmation && result.voiceReply) {
        const confirmMsg = result.voiceReply as string
        setResponse(confirmMsg)
        addMessage('assistant', confirmMsg)
        speakAndMaybeResume(confirmMsg)
        return
      }

      // action=null + voiceReply → Agentが直接回答
      if (!result.action && result.voiceReply) {
        setResponse(result.voiceReply as string)
        addMessage('assistant', result.voiceReply as string)
        conversationCtxRef.current = {
          ...conversationCtxRef.current,
          lastIntent: 'agent.response',
          lastAction: undefined,
        }
        speakAndMaybeResume(result.voiceReply as string)
        return
      }

      // action あり → 既存 executeAction（Nav 実行）
      await executeAction(result as any)
    } catch {
      finishWithError('音声アシスタントへの接続に失敗しました。')
    }
  }, [executeAction, finishWithError, addMessage, speakAndMaybeResume, clearActivityTimers, scheduleStandby, setModeSync])

  // ─── Realtime 接続（Provider レベルで1つだけ持続）───────────────
  const connectRealtime = React.useCallback(async () => {
    if (realtimeSessionRef.current) return
    if (voiceEngineModeRef.current === 'realtime-connecting') return

    setVoiceEngineMode('realtime-connecting')
    voiceEngineModeRef.current = 'realtime-connecting'

    try {
      const tokenRes = await fetch('/api/ai/realtime-token', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ model: RT_MODEL }),
      })
      if (!tokenRes.ok) {
        const errBody = await tokenRes.text().catch(() => '')
        throw new Error(`token_failed:${tokenRes.status} ${errBody}`)
      }
      const tokenData = await tokenRes.json()
      const clientSecret: string | null = tokenData.clientSecret ?? null
      if (!clientSecret) throw new Error('no_token: clientSecret missing in response')

      // tool() ファクトリを取得 — plain objectではなくFunctionTool(invoke付き)を生成するために必須
      const { RealtimeAgent, RealtimeSession, tool: toolFactory } = await import('@openai/agents/realtime') as any
      const tools   = buildHikaruRealtimeTools(router, projectIdRef, toolFactory, pathnameRef)
      const agent   = new RealtimeAgent({ name: 'JARVIS Worker Realtime', instructions: RT_SYSTEM_PROMPT, tools })
      // transport: 'webrtc' は ephemeral client secret (ek_...) での接続に必須
      // eagerness: 'high' でsemantic_VADのターン検出を高速化（Latency改善）
      const session = new RealtimeSession(agent, {
        transport: 'webrtc',
        model:     RT_MODEL,
        config:    {
          audio: {
            input: {
              turnDetection: { type: 'semantic_vad', eagerness: 'high' },
            },
          },
        },
      } as any)

      // ── @openai/agents-realtime v0.17 正式イベント ──────────────
      // 注: connected/disconnected/agent_start_speech/agent_end_speech/
      //     user_start_speech/user_end_speech/tool_call_start/tool_call_end/
      //     user_transcription_done/agent_transcription_done は v0.17に存在しない。

      // AI処理開始（通常audio_start前に発火するが、高速応答時は逆転することがある）
      // listening/idle時のみprocessingへ遷移。speaking中は上書きしない。
      // Streamingトランスクリプトをリセット（新しいAI回答の準備）
      session.on?.('agent_start', () => {
        if (voiceEngineModeRef.current !== 'realtime') return
        streamingTranscriptRef.current = ''
        setResponse('')
        if (modeRef.current === 'listening' || modeRef.current === 'idle') {
          setModeSync('processing')
        }
        console.log('[JARVIS-latency] agent_start', Date.now())
      })

      // AI音声出力開始
      session.on?.('audio_start', () => {
        if (voiceEngineModeRef.current !== 'realtime') return
        isSpeakingRef.current = true
        clearResumeTimer()
        setModeSync('speaking')
        console.log('[JARVIS-latency] audio_start (first AI audio)', Date.now())
      })

      // AI音声出力終了 → 300ms後にListeningへ
      session.on?.('audio_stopped', () => {
        if (voiceEngineModeRef.current !== 'realtime') return
        isSpeakingRef.current = false
        setModeSync('processing')
        clearResumeTimer()
        console.log('[JARVIS-latency] audio_stopped', Date.now())
        resumeTimerRef.current = setTimeout(() => {
          if (voiceEngineModeRef.current !== 'realtime') return
          if (modeRef.current !== 'processing') return
          setModeSync('listening')
          console.log('[JARVIS-latency] listening_restored', Date.now())
        }, 300)
      })

      // AI回答完了 — 3番目の引数にtext output（v0.17型定義確認済み）
      // Dedupe: 同一turnで同一テキストが二重に追加されないようMessagesRefと照合
      session.on?.('agent_end', (_ctx: unknown, _agent: unknown, output: string) => {
        const text = (output ?? '').trim()
        if (!text) return
        const msgs = messagesRef.current
        const last = msgs[msgs.length - 1]
        if (last?.role === 'assistant' && last.text === text) return
        setResponse(text)
        addMessage('assistant', text)
      })

      // Tool開始
      session.on?.('agent_tool_start', () => {
        if (voiceEngineModeRef.current !== 'realtime') return
        muteMic(true)
        setModeSync('working')
      })

      // Tool終了 — Mic解除してprocessingへ
      session.on?.('agent_tool_end', () => {
        if (voiceEngineModeRef.current !== 'realtime') return
        muteMic(false)
        setModeSync('processing')
      })

      // User Transcript (input_textのみ) — audio transcriptはtransport_eventで取得
      // input_audioはhistory_added時点でtranscript=nullのため、ここでは扱わない
      session.on?.('history_added', (item: any) => {
        if (item?.type !== 'message' || item?.role !== 'user') return
        const content: any[] = Array.isArray(item.content) ? item.content : []
        const textInput = content.find((c: any) => c.type === 'input_text')
        if (textInput?.text) {
          setTranscript(textInput.text)
          addMessage('user', textInput.text)
        }
      })

      // Barge-in（User割り込み）— SDKが音声停止済み、stateをlisteningへ
      session.on?.('audio_interrupted', () => {
        if (voiceEngineModeRef.current !== 'realtime') return
        isSpeakingRef.current = false
        clearResumeTimer()
        streamingTranscriptRef.current = ''
        setModeSync('listening')
        console.log('[JARVIS-latency] audio_interrupted (barge-in)', Date.now())
      })

      // Error — ログのみ。Non-fatalエラーでSessionを終了しない（Infinite Conversation維持）
      // 実際の切断はtransport connection_changeイベントで検知・処理する。
      session.on?.('error', (err: unknown) => {
        const msg = (err as any)?.error?.message ?? (err as Error)?.message ?? String(err)
        console.error('[realtime] session error (non-fatal, session continues):', msg)
      })

      // ── Transport level listeners (v0.17 確認済みAPI) ───────────
      const transport = session.transport as any

      // User音声Transcript確定 — history_addedのinput_audioはtranscript=nullのためここで処理
      // SDKがInputAudioTranscriptionCompletedEventをtransport_eventとして発火する
      session.on?.('transport_event', (event: any) => {
        if (event?.type !== 'conversation.item.input_audio_transcription.completed') return
        const text = (event.transcript ?? '').trim()
        if (!text || voiceEngineModeRef.current !== 'realtime') return
        setTranscript(text)
        addMessage('user', text)
        console.log('[JARVIS-latency] user_transcript_completed', Date.now(), text.slice(0, 20))
      })

      // AI Transcript Streaming Delta — 音声再生と同期してUIテキストを逐次更新
      // Single Source of Truth: deltaを累積し、agent_endで最終確定テキストで上書き
      transport.on?.('audio_transcript_delta', (deltaEvent: any) => {
        if (voiceEngineModeRef.current !== 'realtime') return
        const delta = deltaEvent?.delta ?? ''
        if (!delta) return
        streamingTranscriptRef.current += delta
        setResponse(streamingTranscriptRef.current)
      })

      // 接続状態変化 — 予期せぬ切断時にSession継続のため自動Reconnect（1回）
      transport.on?.('connection_change', (status: any) => {
        if (status !== 'disconnected') return
        if (!isSessionRef.current) return
        if (voiceEngineModeRef.current !== 'realtime') return
        console.warn('[realtime] connection dropped, reconnecting in 1.5s')
        realtimeSessionRef.current = null
        clearResumeTimer()
        isSpeakingRef.current = false
        setVoiceEngineMode('off')
        voiceEngineModeRef.current = 'off'
        setModeSync('processing')
        setTimeout(() => {
          if (!isSessionRef.current) return
          if (voiceEngineModeRef.current !== 'off') return
          connectRealtimeRef.current()
        }, 1500)
      })

      await session.connect({ apiKey: clientSecret } as any)

      // connect()が正常解決 = WebRTC接続確立。イベント待ちせず即座にrealtime状態をセット。
      realtimeSessionRef.current = session
      setVoiceEngineMode('realtime')
      voiceEngineModeRef.current = 'realtime'
      setModeSync('listening')

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[realtime-connect] failed:', msg)
      realtimeSessionRef.current = null
      micTrackRef.current = null
      setVoiceEngineMode('off')
      voiceEngineModeRef.current = 'off'
      // Engine OFF時はSession状態もリセット（UI整合性: 「会話中」+「VOICE ENGINE OFF」矛盾を防ぐ）
      isSessionRef.current = false
      setIsSession(false)
      setIsStandby(false)
      // ユーザーへのエラー表示（原因を特定できるよう詳細を含める）
      const uiMsg = (msg.includes('not-allowed') || msg.includes('NotAllowedError'))
        ? 'マイクへのアクセスを許可してください。ブラウザの設定を確認してください。'
        : msg.includes('token_failed:401')
        ? '認証エラー。ログアウトして再ログインしてください。'
        : msg.includes('no_token') || msg.includes('token_failed')
        ? `Voice接続の準備に失敗しました。(${msg.slice(0, 80)})`
        : msg.includes('ephemeral client key')
        ? 'Voice接続の認証に失敗しました。ページを更新してください。'
        : `Voice Engine接続エラー: ${msg.slice(0, 100)}`
      setErrorMessage(uiMsg)
      setModeSync('error')
      setTimeout(() => {
        if (modeRef.current === 'error') { setModeSync('idle'); setErrorMessage('') }
      }, 6000)
    }
  }, [router, addMessage, setModeSync, muteMic, clearResumeTimer, setResponse,
      setIsSession, setIsStandby, setErrorMessage])

  React.useEffect(() => { connectRealtimeRef.current = connectRealtime }, [connectRealtime])

  const disconnectRealtime = React.useCallback(() => {
    clearResumeTimer()
    try { realtimeSessionRef.current?.close?.() } catch {}
    try { realtimeSessionRef.current?.disconnect?.() } catch {}
    realtimeSessionRef.current = null
    micTrackRef.current = null
    setVoiceEngineMode('off')
    voiceEngineModeRef.current = 'off'
  }, [clearResumeTimer])

  const startListening = React.useCallback(() => {
    // Realtime が接続中または接続試行中ならスキップ（Realtime が Audio を管理）
    if (voiceEngineModeRef.current === 'realtime' || voiceEngineModeRef.current === 'realtime-connecting') return
    if (!isSpeechSupported) { finishWithError('このブラウザでは音声入力を利用できません。'); return }
    if (modeRef.current === 'speaking') { browserTTS.stop(); setModeSync('idle'); return }
    if (modeRef.current === 'processing') return

    setErrorMessage('')
    setTranscript('')
    setModeSync('listening')

    const SpeechRec = ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition) as new () => SpeechRecognitionInstance
    const rec = new SpeechRec()
    rec.lang = 'ja-JP'; rec.continuous = false; rec.interimResults = false; rec.maxAlternatives = 1
    recognitionRef.current = rec

    rec.onresult = (e: SpeechRecognitionEvent) => {
      const text = e.results[0]?.[0]?.transcript ?? ''
      if (!text.trim()) { finishWithError('音声を認識できませんでした。'); return }
      handleUtterance(text.trim())
    }
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'not-allowed' || e.error === 'permission-denied') {
        finishWithError('マイクの使用を許可してください。')
      } else if (e.error === 'no-speech') {
        if (isSessionRef.current) {
          setModeSync('idle')
          setTimeout(() => { if (isSessionRef.current) startListeningRef.current() }, 300)
        } else {
          finishWithError('音声が検出されませんでした。')
        }
      } else if (e.error === 'aborted') {
        // ページ遷移等で中断 → セッション中は黙って再試行
        if (isSessionRef.current) {
          setModeSync('idle')
          setTimeout(() => { if (isSessionRef.current) startListeningRef.current() }, 500)
        } else {
          setModeSync('idle')
        }
      } else {
        if (isSessionRef.current) {
          setModeSync('idle')
          setTimeout(() => { if (isSessionRef.current) startListeningRef.current() }, 800)
        } else {
          finishWithError('音声認識でエラーが発生しました。')
        }
      }
    }
    rec.onend = () => {
      if (modeRef.current === 'listening') {
        if (isSessionRef.current) {
          setModeSync('idle')
          setTimeout(() => { if (isSessionRef.current) startListeningRef.current() }, 300)
        } else {
          setModeSync('idle')
        }
      }
    }
    try { rec.start() } catch { finishWithError('マイクを起動できませんでした。') }
  }, [isSpeechSupported, handleUtterance, finishWithError, setModeSync])

  React.useEffect(() => { startListeningRef.current = startListening }, [startListening])

  const startSession = React.useCallback(() => {
    isSessionRef.current = true
    setIsSession(true)
    setIsStandby(false)
    scheduleStandby()
    // Realtime（WebRTC）を優先接続。失敗時はBrowser STTへ自動fallback。
    connectRealtime()
  }, [scheduleStandby, connectRealtime])

  // ─── Phase P2: ページ遷移後の自然な次Action提案（Browser STT fallback専用）──
  // Realtimeモード中はRealtimeモデル自身がNavigation後の発話を処理するためスキップ。
  // Browser STT fallback時のみbrowserTTSで次Actionを提案する。
  const prevPathRef = React.useRef(pathname)
  React.useEffect(() => {
    const prev = prevPathRef.current
    prevPathRef.current = pathname
    if (!isSessionRef.current) return
    if (prev === pathname) return
    // Realtimeモード中はスキップ（Realtime AgentがNavigation後の応答を担う）
    if (voiceEngineModeRef.current === 'realtime' || voiceEngineModeRef.current === 'realtime-connecting') return

    const ctx = getScreenContext(pathname)
    const lastAction = conversationCtxRef.current.lastAction ?? ''

    // Job ページへ遷移した場合
    if (ctx.contextType === 'job' && ctx.currentResourceId) {
      const items = conversationCtxRef.current.lastResultData?.items ?? []
      const found = items.find(i => i.id === ctx.currentResourceId)
      const name  = found ? found.label.replace(/^\d+件目:\s*/, '') : null
      const msg   = name
        ? `${name}を開きました。作業内容を確認しますか？`
        : '案件を開きました。作業内容を確認しますか？'
      setTimeout(() => {
        if (!isSessionRef.current) return
        if (voiceEngineModeRef.current === 'realtime') return
        addMessage('assistant', msg)
        setResponse(msg)
        speakAndMaybeResume(msg)
      }, 900)
      return
    }

    // マニュアルページへ遷移
    if (ctx.contextType === 'manual' && lastAction === 'system.open_manual') {
      setTimeout(() => {
        if (!isSessionRef.current) return
        if (voiceEngineModeRef.current === 'realtime') return
        const msg = 'マニュアルを開きました。読み上げますか？'
        addMessage('assistant', msg)
        setResponse(msg)
        speakAndMaybeResume(msg)
      }, 900)
      return
    }

    // 通知ページへ遷移
    if (ctx.contextType === 'notifications' && lastAction === 'system.open_notifications') {
      return // 通知へのNavigation replyで十分（過剰にしない）
    }
  }, [pathname, addMessage, speakAndMaybeResume])

  // ─── ページ遷移後のBrowser STT failsafe ────────────────────────
  // Realtime中はSDKがMicを管理するためSpeechRecognitionは不要。
  // Fallback(browser)時のみSpeechRecognitionを再起動する。
  React.useEffect(() => {
    if (!isSessionRef.current) return
    // Realtime接続中はスキップ（startListeningの内部guardと二重保護）
    if (voiceEngineModeRef.current === 'realtime' || voiceEngineModeRef.current === 'realtime-connecting') return
    const timer = setTimeout(() => {
      if (!isSessionRef.current) return
      if (voiceEngineModeRef.current === 'realtime' || voiceEngineModeRef.current === 'realtime-connecting') return
      if (modeRef.current === 'idle') {
        startListeningRef.current()
      }
    }, 700)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // ─── Watchdog: Realtime stuck → 10秒後にState+Mic強制復旧 ────
  // tool_start後にtool_endが発火しなかった場合のSafety net。
  // muteMic(false)でSDK muteも解除し、確実にListening状態へ復帰する。
  React.useEffect(() => {
    if (voiceEngineMode !== 'realtime') return
    if (mode !== 'processing' && mode !== 'working' && mode !== 'speaking') return
    const t = setTimeout(() => {
      if (voiceEngineModeRef.current !== 'realtime') return
      if (modeRef.current !== 'processing' && modeRef.current !== 'working' && modeRef.current !== 'speaking') return
      if (!realtimeSessionRef.current) return
      isSpeakingRef.current = false
      clearResumeTimer()
      muteMic(false)
      setModeSync('listening')
    }, 10_000)
    return () => clearTimeout(t)
  }, [mode, voiceEngineMode, clearResumeTimer, setModeSync, muteMic])

  // ─── Logout時のクリーンアップ ─────────────────────────────────
  React.useEffect(() => {
    const handleLogout = () => {
      stopAll()
      setMessages([])
      messagesRef.current = []
      conversationCtxRef.current = {}
    }
    window.addEventListener('hikaru:logout', handleLogout)
    return () => window.removeEventListener('hikaru:logout', handleLogout)
  }, [stopAll])

  const value = React.useMemo<SystemVoiceContextValue>(() => ({
    mode, isSession, isStandby, transcript, response, errorMessage, messages,
    voiceSettings, setVoiceSettings, isSpeechSupported,
    voiceEngineMode, setVoiceEngineMode,
    connectRealtime, disconnectRealtime,
    startListening, stopAll, startSession, stopSession, handleUtterance,
    interrupt,
    currentProjectId,
  }), [
    mode, isSession, isStandby, transcript, response, errorMessage, messages,
    voiceSettings, setVoiceSettings, isSpeechSupported,
    voiceEngineMode, setVoiceEngineMode,
    connectRealtime, disconnectRealtime,
    startListening, stopAll, startSession, stopSession, handleUtterance,
    interrupt,
    currentProjectId,
  ])

  return (
    <SystemVoiceContext.Provider value={value}>
      {children}
    </SystemVoiceContext.Provider>
  )
}

// ─── Consumer hook ────────────────────────────────────────────
export function useSystemJarvis(): SystemVoiceContextValue {
  const ctx = React.useContext(SystemVoiceContext)
  if (!ctx) throw new Error('useSystemJarvis must be used within SystemVoiceProvider')
  return ctx
}
