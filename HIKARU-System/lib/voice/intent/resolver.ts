// ============================================================
// ローカルIntent解決（gpt-4o-mini不使用・高速・低コスト）
// 明確な固定表現はここで先に解決する
// ============================================================

import type { SystemActionName } from '@/lib/voice/registry/system.actions'

export interface IntentResult {
  action:     SystemActionName | null
  confidence: number
  params:     Record<string, string>
  voiceReply: string | null
}

interface LocalRule {
  patterns:   RegExp[]
  action:     SystemActionName
  voiceReply: string
}

const LOCAL_RULES: LocalRule[] = [
  {
    patterns:   [/^ホーム$/, /^トップ$/, /^ホームに戻/, /^トップに戻/, /^最初の?画面/],
    action:     'system.go_home',
    voiceReply: 'ホームに移動します',
  },
  {
    patterns:   [/^戻って?$/, /^前(の?画面)?に?戻/, /^前へ$/, /^もどって$/],
    action:     'system.go_back',
    voiceReply: '前の画面に戻ります',
  },
  {
    patterns:   [/^通知$/, /^通知(を)?開いて/, /^お知らせ$/],
    action:     'system.open_notifications',
    voiceReply: '通知画面を開きます',
  },
  {
    patterns:   [/^スケジュール$/, /^予定$/, /^スケジュール(を)?開いて/],
    action:     'system.open_schedule',
    voiceReply: 'スケジュールを開きます',
  },
  {
    patterns:   [/^マニュアル$/, /^マニュアル(を)?開いて/, /^手順書/],
    action:     'system.open_manual',
    voiceReply: 'マニュアルを開きます',
  },
  {
    patterns:   [/^AI(に)?質問/, /^チャット$/, /^アシスタント$/, /^質問したい/, /^聞きたい/],
    action:     'system.open_chat',
    voiceReply: 'AIアシスタントを開きます',
  },
  {
    patterns:   [/^Before/, /^ビフォー/, /^作業前写真/],
    action:     'system.open_before_camera',
    voiceReply: 'Before写真画面を開きます',
  },
  {
    patterns:   [/^After/, /^アフター/, /^作業後写真/],
    action:     'system.open_after_camera',
    voiceReply: 'After写真画面を開きます',
  },
  {
    patterns:   [/^(AI)?品質評価/, /^評価画面/, /^品質チェック/],
    action:     'system.open_evaluation',
    voiceReply: 'AI品質評価画面を開きます',
  },
  {
    patterns:   [/^今日の?(仕事|作業|現場|予定)/, /^今日なに(する|やる)/],
    action:     'system.get_today_jobs',
    voiceReply: '今日の作業を確認します',
  },
  {
    patterns:   [/^シフト(管理|を開いて|一覧)?$/, /^シフト確認/, /^勤務シフト/],
    action:     'system.open_shifts',
    voiceReply: 'シフト管理画面を開きます',
  },
  {
    patterns:   [/^勤怠(管理|を開いて|確認)?$/, /^出退勤/, /^勤怠記録/],
    action:     'system.open_attendance',
    voiceReply: '勤怠管理画面を開きます',
  },
  {
    patterns:   [/^経費(申請|一覧|を開いて)?$/, /^経費確認/, /^立替/],
    action:     'system.open_expenses',
    voiceReply: '経費申請画面を開きます',
  },
  {
    patterns:   [/^プロフィール$/, /^自分の情報/, /^プロフィールを開いて/],
    action:     'system.open_profile',
    voiceReply: 'プロフィール画面を開きます',
  },
  {
    patterns:   [/^報告書$/, /^作業報告/, /^報告書を開いて/, /^レポート$/],
    action:     'system.open_report',
    voiceReply: '報告書画面を開きます',
  },
  {
    patterns:   [/^案件一覧$/, /^案件リスト/, /^担当案件/, /^案件(を)?見せて/],
    action:     'system.open_jobs_list',
    voiceReply: '案件一覧を開きます',
  },
]

/**
 * ローカルルールでIntentを解決。
 * マッチしなければ null を返し、呼び出し元が gpt-4o-mini API へ渡す。
 */
export function resolveLocalIntent(utterance: string): IntentResult | null {
  const text = utterance.trim()
  for (const rule of LOCAL_RULES) {
    if (rule.patterns.some((p) => p.test(text))) {
      return {
        action:     rule.action,
        confidence: 1.0,
        params:     {},
        voiceReply: rule.voiceReply,
      }
    }
  }
  return null
}
