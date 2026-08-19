// ============================================================
// 現在のURLからVoice画面コンテキストを取得
// HIKARU_System URL仕様:
//   /jobs/[jobId] の jobId = 実態は projectId
// ============================================================

import type { ContextType } from '@/lib/voice/state/types'

export interface ScreenContext {
  contextType:        ContextType
  currentResourceId?: string  // /jobs/[id] → id（= projectId）
}

export function getScreenContext(pathname: string): ScreenContext {
  // Home
  if (pathname === '/home' || pathname === '/') {
    return { contextType: 'home' }
  }

  // Job sub-pages（/jobs/[id]/xxx は先にマッチさせる）
  const jobSubMatch = pathname.match(/^\/jobs\/([^/]+)\/([^/]+)/)
  if (jobSubMatch) {
    const resourceId = jobSubMatch[1]
    const sub        = jobSubMatch[2]
    const typeMap: Record<string, ContextType> = {
      chat:       'chat',
      manual:     'manual',
      before:     'before',
      after:      'after',
      evaluation: 'evaluation',
      report:     'other',
    }
    return { contextType: typeMap[sub] ?? 'other', currentResourceId: resourceId }
  }

  // Job detail
  const jobMatch = pathname.match(/^\/jobs\/([^/]+)$/)
  if (jobMatch) return { contextType: 'job', currentResourceId: jobMatch[1] }

  // Other pages
  if (pathname.startsWith('/schedule'))     return { contextType: 'schedule' }
  if (pathname.startsWith('/shifts'))       return { contextType: 'schedule' }
  if (pathname.startsWith('/attendance'))   return { contextType: 'attendance' }
  if (pathname.startsWith('/expenses'))     return { contextType: 'expenses' }
  if (pathname.startsWith('/notifications'))return { contextType: 'notifications' }
  if (pathname.startsWith('/profile'))      return { contextType: 'profile' }

  return { contextType: 'other' }
}
