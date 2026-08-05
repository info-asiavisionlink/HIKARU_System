import { NextRequest, NextResponse } from 'next/server'
import type { ApiResponse, Photo } from '@hikaru/types'

// TODO: 写真アップロード → Supabase Storage保存 → DB記録
// POST /api/photos → 写真アップロード
export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<Photo>>> {
  return NextResponse.json(
    { success: false, error: { code: 'NOT_IMPLEMENTED', message: '未実装' } },
    { status: 501 }
  )
}
