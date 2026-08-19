// ============================================================
// System Voice Action Registry — L0-L2のみ
// L3以上（DB書き込み）は登録しない
// ============================================================

export const SYSTEM_ACTIONS = {
  // --------------------------------------------------------
  // L0: Conversation（DB操作なし、AI質問のみ）
  // --------------------------------------------------------
  'system.ask_manual': {
    level: 0 as const,
    description: 'AIアシスタントへの質問・現場の相談',
  },

  // --------------------------------------------------------
  // L1: Read-only（既存APIからデータ取得のみ）
  // --------------------------------------------------------
  'system.get_today_jobs': {
    level: 1 as const,
    description: '今日の作業・担当案件一覧を確認する',
  },
  'system.get_job_detail': {
    level: 1 as const,
    description: '現在表示中の案件・Job詳細情報を確認する',
  },
  'system.get_schedule': {
    level: 1 as const,
    description: '今後のスケジュール・予定を確認する',
  },
  'system.get_shifts': {
    level: 1 as const,
    description: 'シフト一覧を確認する',
  },
  'system.get_attendance': {
    level: 1 as const,
    description: '勤怠情報・出退勤状況を確認する',
  },
  'system.get_expenses': {
    level: 1 as const,
    description: '経費申請一覧・状況を確認する',
  },
  'system.get_notifications': {
    level: 1 as const,
    description: '通知・お知らせを確認する',
  },
  'system.get_manuals': {
    level: 1 as const,
    description: '案件マニュアル一覧を確認する',
  },
  'system.get_profile': {
    level: 1 as const,
    description: 'プロフィール・自分の情報を確認する',
  },

  // --------------------------------------------------------
  // L2: Navigation（UI移動のみ・データ変更なし）
  // --------------------------------------------------------
  'system.go_home': {
    level: 2 as const,
    description: 'ホーム画面・トップに移動する',
  },
  'system.go_back': {
    level: 2 as const,
    description: '前の画面・ひとつ前のページに戻る',
  },
  'system.open_job': {
    level: 2 as const,
    description: '案件・Job詳細画面を開く',
  },
  'system.open_chat': {
    level: 2 as const,
    description: 'AIチャット・AI作業アシスタントを開く',
  },
  'system.open_manual': {
    level: 2 as const,
    description: 'マニュアル・手順書を開く',
  },
  'system.open_before_camera': {
    level: 2 as const,
    description: 'Before写真・作業前写真の撮影画面を開く',
  },
  'system.open_after_camera': {
    level: 2 as const,
    description: 'After写真・作業後写真の撮影画面を開く',
  },
  'system.open_evaluation': {
    level: 2 as const,
    description: 'AI品質評価・品質チェック画面を開く',
  },
  'system.open_notifications': {
    level: 2 as const,
    description: '通知画面・お知らせ一覧を開く',
  },
  'system.open_schedule': {
    level: 2 as const,
    description: 'スケジュール・予定カレンダーを開く',
  },
  'system.open_shifts': {
    level: 2 as const,
    description: 'シフト管理・勤務シフト一覧を開く',
  },
  'system.open_attendance': {
    level: 2 as const,
    description: '勤怠管理・出退勤記録画面を開く',
  },
  'system.open_expenses': {
    level: 2 as const,
    description: '経費申請・経費一覧画面を開く',
  },
  'system.open_profile': {
    level: 2 as const,
    description: 'プロフィール・自分の情報画面を開く',
  },
  'system.open_report': {
    level: 2 as const,
    description: '報告書・作業報告画面を開く',
  },
  'system.open_jobs_list': {
    level: 2 as const,
    description: '案件一覧・担当案件リストを開く',
  },

  // --------------------------------------------------------
  // L3: Reversible Write（Confirmation必須）
  // --------------------------------------------------------
  'system.start_job': {
    level: 3 as const,
    description: '案件・作業を開始する',
  },
  'system.clock_in': {
    level: 3 as const,
    description: '勤怠打刻：出勤を記録する',
  },
  'system.clock_out': {
    level: 3 as const,
    description: '勤怠打刻：退勤を記録する',
  },
  'system.mark_notification_read': {
    level: 3 as const,
    description: '通知を既読にする',
  },

  // --------------------------------------------------------
  // L4: Important Write（Confirmation必須・本人担当確認）
  // --------------------------------------------------------
  'system.complete_job': {
    level: 4 as const,
    description: '案件・作業を完了にする',
  },
  'system.submit_expense': {
    level: 4 as const,
    description: '経費申請を提出する',
  },
} as const

export type SystemActionName = keyof typeof SYSTEM_ACTIONS

export function isValidAction(name: string): name is SystemActionName {
  return Object.prototype.hasOwnProperty.call(SYSTEM_ACTIONS, name)
}

export function getActionLevel(name: SystemActionName): 0 | 1 | 2 | 3 | 4 {
  return SYSTEM_ACTIONS[name].level
}

// API側でも使えるサーバーサイド用リスト文字列
export function buildActionListForPrompt(): string {
  return Object.entries(SYSTEM_ACTIONS)
    .map(([name, def]) => `- ${name} (L${def.level}): ${def.description}`)
    .join('\n')
}
