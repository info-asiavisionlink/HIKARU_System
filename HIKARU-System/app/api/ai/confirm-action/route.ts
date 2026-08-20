import { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isValidAction, getActionLevel } from '@/lib/voice/registry/system.actions'
import { logVoiceAudit }  from '@/lib/voice/agent/audit'

// ============================================================
// POST /api/ai/confirm-action — System JARVIS Confirmed Action
// ユーザーが「はい」で承認した後、Serverで全権限を再検証して実行。
// クライアントから受け取るaction/paramsのみ。
// company_id / worker_id / role はCookieから取得（Client値信用禁止）。
// ============================================================

export const maxDuration = 15

const CONFIRMATION_EXPIRY_MS = 5 * 60 * 1000  // 5分

export async function POST(req: NextRequest) {
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    action?:       string
    params?:       Record<string, string>
    safetyLevel?:  number
    expiresAt?:    number
  }
  try { body = await req.json() }
  catch { return Response.json({ error: 'invalid JSON' }, { status: 400 }) }

  const { action, params = {}, safetyLevel, expiresAt } = body

  if (!action) return Response.json({ error: 'action required' }, { status: 400 })
  if (!isValidAction(action)) return Response.json({ error: 'invalid action' }, { status: 400 })

  // L2以下はConfirmation不要（直接実行ルートを使うべき）
  const level = getActionLevel(action)
  if (level < 3) return Response.json({ error: 'no confirmation required' }, { status: 400 })

  // L5は Voice 実行禁止
  if (level >= 5) {
    logVoiceAudit({
      source: 'jarvis_voice', actor: uid, actorType: 'worker',
      action, safetyLevel: level, confirmed: true,
      result: 'rejected', reason: 'L5 blocked',
    })
    return Response.json({
      error: 'この操作は音声では実行できません。管理画面から操作してください。',
      blocked: true,
    }, { status: 403 })
  }

  // 有効期限チェック
  if (expiresAt && Date.now() > expiresAt) {
    return Response.json({
      error: '確認の有効期限が切れました。もう一度操作してください。',
      expired: true,
    }, { status: 400 })
  }

  // 最大有効期限チェック（Clientが長すぎる期限を指定した場合の防御）
  if (expiresAt && expiresAt > Date.now() + CONFIRMATION_EXPIRY_MS) {
    return Response.json({ error: '無効なexpiresAt' }, { status: 400 })
  }

  try {
    const supabase    = await createClient()
    const adminClient = createAdminClient()

    // Server側でprofile取得（claimの検証）
    const { data: profile } = await adminClient
      .from('profiles')
      .select('company_id, entity_type, entity_id, role, hourly_rate')
      .eq('id', uid)
      .single()

    if (!profile?.company_id) {
      return Response.json({ error: 'forbidden' }, { status: 403 })
    }

    switch (action) {
      // ─── L3: start_job ────────────────────────────────────
      case 'system.start_job': {
        const { projectId } = params
        if (!projectId) return Response.json({ error: 'projectId required' }, { status: 400 })

        // 担当確認（IDOR対策）
        const { data: assignment } = await adminClient
          .from('project_assignments')
          .select('project_id')
          .eq('assignee_type', profile.entity_type)
          .eq('assignee_id', profile.entity_id)
          .eq('project_id', projectId)
          .maybeSingle()

        if (!assignment) {
          logVoiceAudit({
            source: 'jarvis_voice', actor: uid, actorType: 'worker',
            companyId: profile.company_id, action, safetyLevel: level,
            confirmed: true, result: 'rejected', reason: 'not assigned',
            resourceType: 'job', resourceId: projectId,
          })
          return Response.json({ error: 'この案件は担当対象ではありません。', forbidden: true }, { status: 403 })
        }

        // 既存job確認（二重作成防止）
        const today = new Date().toISOString().split('T')[0]
        const { data: existing } = await supabase
          .from('jobs')
          .select('id, status')
          .eq('project_id', projectId)
          .eq('worker_id', uid)
          .eq('work_date', today)
          .neq('status', 'cancelled')
          .maybeSingle()

        if (existing) {
          logVoiceAudit({
            source: 'jarvis_voice', actor: uid, actorType: 'worker',
            companyId: profile.company_id, action, safetyLevel: level,
            confirmed: true, result: 'success', reason: 'already exists',
            resourceType: 'job', resourceId: existing.id,
          })
          return Response.json({ success: true, job: existing, alreadyStarted: true })
        }

        const { data: job, error } = await supabase
          .from('jobs')
          .insert({
            project_id:  projectId,
            worker_id:   uid,
            company_id:  profile.company_id,
            work_date:   today,
            status:      'in_progress',
            started_at:  new Date().toISOString(),
          })
          .select()
          .single()

        if (error || !job) {
          logVoiceAudit({
            source: 'jarvis_voice', actor: uid, actorType: 'worker',
            companyId: profile.company_id, action, safetyLevel: level,
            confirmed: true, result: 'failed', reason: error?.message,
            resourceType: 'job',
          })
          return Response.json({ error: '作業の開始に失敗しました。', details: error?.message }, { status: 500 })
        }

        logVoiceAudit({
          source: 'jarvis_voice', actor: uid, actorType: 'worker',
          companyId: profile.company_id, action, safetyLevel: level,
          confirmed: true, result: 'success',
          resourceType: 'job', resourceId: job.id,
        })
        return Response.json({ success: true, job, voiceReply: '作業を開始しました。' })
      }

      // ─── L4: complete_job ─────────────────────────────────
      case 'system.complete_job': {
        const { jobId, projectId } = params
        if (!jobId && !projectId) {
          return Response.json({ error: 'jobId または projectId が必要です。' }, { status: 400 })
        }

        // jobId が直接渡された場合 / projectId から今日の in_progress job を探す
        let resolvedJobId = jobId
        if (!resolvedJobId && projectId) {
          const today = new Date().toISOString().split('T')[0]
          const { data: found } = await adminClient
            .from('jobs')
            .select('id, status')
            .eq('project_id', projectId)
            .eq('worker_id', uid)
            .eq('company_id', profile.company_id)
            .eq('work_date', today)
            .eq('status', 'in_progress')
            .single()
          if (!found) {
            return Response.json({ error: '進行中の作業が見つかりません。先に作業を開始してください。' }, { status: 404 })
          }
          resolvedJobId = found.id
        }

        const { data: job } = await adminClient
          .from('jobs')
          .select('id, status, worker_id, company_id')
          .eq('id', resolvedJobId!)
          .eq('worker_id', uid)
          .eq('company_id', profile.company_id)
          .single()

        if (!job) {
          logVoiceAudit({
            source: 'jarvis_voice', actor: uid, actorType: 'worker',
            companyId: profile.company_id, action, safetyLevel: level,
            confirmed: true, result: 'rejected', reason: 'not found or unauthorized',
            resourceType: 'job', resourceId: resolvedJobId,
          })
          return Response.json({ error: 'この作業が見つかりません。', forbidden: true }, { status: 403 })
        }

        if (job.status === 'completed') {
          return Response.json({ success: true, job, alreadyCompleted: true, voiceReply: 'すでに完了済みです。' })
        }

        if (job.status !== 'in_progress') {
          return Response.json({ error: `作業状態が「進行中」ではありません（現在: ${job.status}）。` }, { status: 400 })
        }

        const { data: updated, error } = await supabase
          .from('jobs')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', resolvedJobId!)
          .eq('worker_id', uid)
          .select()
          .single()

        logVoiceAudit({
          source: 'jarvis_voice', actor: uid, actorType: 'worker',
          companyId: profile.company_id, action, safetyLevel: level,
          confirmed: true, result: error ? 'failed' : 'success', reason: error?.message,
          resourceType: 'job', resourceId: resolvedJobId,
        })
        if (error) return Response.json({ error: '完了処理に失敗しました。' }, { status: 500 })
        return Response.json({ success: true, job: updated, voiceReply: '作業を完了しました。お疲れさまでした。' })
      }

      // ─── L3: break_start ──────────────────────────────────
      case 'system.break_start': {
        const res = await fetch(`${req.nextUrl.origin}/api/attendance/punch`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Cookie: req.headers.get('cookie') ?? '' },
          body:    JSON.stringify({ type: 'break_start' }),
        })
        const data = await res.json()
        logVoiceAudit({ source: 'jarvis_voice', actor: uid, actorType: 'worker',
          companyId: profile.company_id, action, safetyLevel: level,
          confirmed: true, result: res.ok ? 'success' : 'failed', reason: data.error })
        if (!res.ok) {
          const msg = data.error === 'not_clocked_in'    ? '出勤打刻がありません。先に出勤してください。'
                    : data.error === 'already_on_break'  ? 'すでに休憩中です。'
                    : '休憩開始に失敗しました。'
          return Response.json({ error: msg }, { status: res.status })
        }
        const now = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
        return Response.json({ success: true, voiceReply: `${now}に休憩を開始しました。` })
      }

      // ─── L3: break_end ────────────────────────────────────
      case 'system.break_end': {
        const res = await fetch(`${req.nextUrl.origin}/api/attendance/punch`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Cookie: req.headers.get('cookie') ?? '' },
          body:    JSON.stringify({ type: 'break_end' }),
        })
        const data = await res.json()
        logVoiceAudit({ source: 'jarvis_voice', actor: uid, actorType: 'worker',
          companyId: profile.company_id, action, safetyLevel: level,
          confirmed: true, result: res.ok ? 'success' : 'failed', reason: data.error })
        if (!res.ok) {
          const msg = data.error === 'no_break_started' ? '休憩が開始されていません。' : '休憩終了に失敗しました。'
          return Response.json({ error: msg }, { status: res.status })
        }
        const now = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
        return Response.json({ success: true, voiceReply: `${now}に休憩を終了しました。お疲れ様です。` })
      }

      // ─── L3: clock_in ─────────────────────────────────────
      // 内部fetchではなくadminClientで直接DB操作（Auth Cookie問題を回避）
      case 'system.clock_in': {
        const now   = new Date().toISOString()
        const today = now.split('T')[0]

        // 今日の打刻記録確認
        const { data: existing } = await adminClient
          .from('attendance_records')
          .select('id, clock_in')
          .eq('worker_id', uid)
          .eq('work_date', today)
          .maybeSingle()

        if (existing?.clock_in) {
          const alreadyTime = new Date(existing.clock_in).toLocaleTimeString('ja-JP', {
            hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo',
          })
          logVoiceAudit({ source: 'jarvis_voice', actor: uid, actorType: 'worker',
            companyId: profile.company_id, action, safetyLevel: level,
            confirmed: true, result: 'success', reason: 'already clocked in' })
          return Response.json({ success: true, voiceReply: `すでに${alreadyTime}に出勤済みです。` })
        }

        const hourlyRate = (profile as any)?.hourly_rate ?? 0

        let clockInError: string | undefined
        if (!existing) {
          const { error } = await adminClient
            .from('attendance_records')
            .insert({
              worker_id:   uid,
              company_id:  profile.company_id,
              work_date:   today,
              clock_in:    now,
              hourly_rate: hourlyRate,
              updated_at:  now,
            })
          clockInError = error?.message
        } else {
          const { error } = await adminClient
            .from('attendance_records')
            .update({ clock_in: now, updated_at: now })
            .eq('id', existing.id)
          clockInError = error?.message
        }

        logVoiceAudit({ source: 'jarvis_voice', actor: uid, actorType: 'worker',
          companyId: profile.company_id, action, safetyLevel: level,
          confirmed: true, result: clockInError ? 'failed' : 'success', reason: clockInError })

        if (clockInError) {
          return Response.json({ error: '出勤打刻に失敗しました。もう一度試してください。' }, { status: 500 })
        }

        // DB成功確認後にのみ時刻を発話
        const clockInTime = new Date(now).toLocaleTimeString('ja-JP', {
          hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo',
        })
        return Response.json({ success: true, voiceReply: `${clockInTime}に出勤を打刻しました。` })
      }

      // ─── L3: clock_out ────────────────────────────────────
      case 'system.clock_out': {
        const now   = new Date().toISOString()
        const today = now.split('T')[0]

        const { data: existing } = await adminClient
          .from('attendance_records')
          .select('id, clock_in, clock_out, break_start, break_end')
          .eq('worker_id', uid)
          .eq('work_date', today)
          .maybeSingle()

        if (!existing?.clock_in) {
          return Response.json({ error: 'まだ出勤打刻がありません。先に出勤打刻をしてください。' }, { status: 400 })
        }
        if (existing?.clock_out) {
          const alreadyTime = new Date(existing.clock_out).toLocaleTimeString('ja-JP', {
            hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo',
          })
          return Response.json({ success: true, voiceReply: `すでに${alreadyTime}に退勤済みです。` })
        }

        // 実働時間計算
        const hourlyRate  = (profile as any)?.hourly_rate ?? 0
        const totalMins   = Math.round((new Date(now).getTime() - new Date(existing.clock_in).getTime()) / 60000)
        const breakMins   = existing.break_end && existing.break_start
          ? Math.round((new Date(existing.break_end).getTime() - new Date(existing.break_start).getTime()) / 60000)
          : 0
        const workMins    = Math.max(0, totalMins - breakMins)
        const dailyPay    = Math.round((workMins / 60) * hourlyRate)

        const { error } = await adminClient
          .from('attendance_records')
          .update({
            clock_out:    now,
            break_minutes: breakMins,
            work_minutes:  workMins,
            hourly_rate:   hourlyRate,
            daily_pay:     dailyPay,
            updated_at:    now,
          })
          .eq('id', existing.id)

        logVoiceAudit({ source: 'jarvis_voice', actor: uid, actorType: 'worker',
          companyId: profile.company_id, action, safetyLevel: level,
          confirmed: true, result: error ? 'failed' : 'success', reason: error?.message })

        if (error) {
          return Response.json({ error: '退勤打刻に失敗しました。もう一度試してください。' }, { status: 500 })
        }

        // DB成功確認後にのみ発話
        const clockOutTime = new Date(now).toLocaleTimeString('ja-JP', {
          hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo',
        })
        const workH = Math.floor(workMins / 60), workM = workMins % 60
        const workText = workH > 0 ? `${workH}時間${workM}分` : `${workM}分`
        return Response.json({ success: true, voiceReply: `${clockOutTime}に退勤を打刻しました。本日の実働時間は${workText}です。お疲れさまでした。` })
      }

      // ─── L4: submit_expense ───────────────────────────────
      case 'system.submit_expense': {
        const { expenseId } = params
        if (!expenseId) return Response.json({ error: 'expenseId required' }, { status: 400 })

        const res = await fetch(`${req.nextUrl.origin}/api/expenses/${expenseId}/submit`, {
          method:  'POST',
          headers: { Cookie: req.headers.get('cookie') ?? '' },
        })
        const data = await res.json()
        logVoiceAudit({
          source: 'jarvis_voice', actor: uid, actorType: 'worker',
          companyId: profile.company_id, action, safetyLevel: level,
          confirmed: true, result: res.ok ? 'success' : 'failed',
          resourceType: 'expense', resourceId: expenseId,
        })
        if (!res.ok) return Response.json({ error: data?.error ?? '経費申請の提出に失敗しました。' }, { status: res.status })
        return Response.json({ success: true, voiceReply: '経費申請を提出しました。' })
      }

      // ─── L3: mark_notification_read ───────────────────────
      case 'system.mark_notification_read': {
        const { notificationId } = params
        if (!notificationId) return Response.json({ error: 'notificationId required' }, { status: 400 })
        const res = await fetch(`${req.nextUrl.origin}/api/notifications/${notificationId}/read`, {
          method:  'PATCH',
          headers: { Cookie: req.headers.get('cookie') ?? '' },
        })
        logVoiceAudit({
          source: 'jarvis_voice', actor: uid, actorType: 'worker',
          companyId: profile.company_id, action, safetyLevel: level,
          confirmed: true, result: res.ok ? 'success' : 'failed',
          resourceType: 'notification', resourceId: notificationId,
        })
        if (!res.ok) return Response.json({ error: '既読処理に失敗しました。' }, { status: res.status })
        return Response.json({ success: true, voiceReply: '既読にしました。' })
      }

      default:
        return Response.json({ error: 'unsupported action' }, { status: 400 })
    }
  } catch (err) {
    console.error('[confirm-action]', err)
    return Response.json({ error: '処理中にエラーが発生しました。' }, { status: 500 })
  }
}
