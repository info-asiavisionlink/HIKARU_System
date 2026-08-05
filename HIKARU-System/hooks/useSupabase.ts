'use client'

import { useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

// ============================================================
// Supabaseクライアントフック（クライアントサイド用）
// メモ化してインスタンスの再生成を防ぐ
// ============================================================

export function useSupabase() {
  const supabase = useMemo(() => createClient(), [])
  return supabase
}
