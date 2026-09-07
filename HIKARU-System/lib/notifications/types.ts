// ============================================================
// Notification type whitelists (System / Worker)
//
// Worker 向け通知の許可 type 一覧。
// 通知一覧 GET / 既読 PATCH / 一括既読 PATCH の全てで
// 同一 whitelist を共有する。
//
// 追加ルール:
//   - 削除禁止 (既存 Production 通知が消える)
//   - rename 禁止 (Console 側 insert が対応 rename されない限り不一致)
//   - Admin 向け type (attendance_correction_submitted 等) をここに混ぜない
// ============================================================

export const WORKER_NOTIFICATION_TYPES = [
  'attendance_correction_approved',
  'attendance_correction_rejected',
  'expense_approved',
  'expense_rejected',
  'expense_settled',
  'shift_created',
  'shift_updated',
  'shift_cancelled',
  'shift_confirmed',
  'project_assigned',
  'project_unassigned',
  'project_cancelled',
  'project_paused',
  'project_completed',
  'project_details_changed',
] as const

export type WorkerNotificationType = typeof WORKER_NOTIFICATION_TYPES[number]
