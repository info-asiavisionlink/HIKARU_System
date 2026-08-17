import { NextRequest, NextResponse } from 'next/server'

// ============================================================
// HIKARU-System 写真 API
//
// 【重要】写真のアップロード・取得は services/photos.service.ts を通じて
// Supabase Browser Client で直接行っている。このルートは現在未使用。
//
// - 写真アップロード: services/photos.service.ts → uploadPhoto()
//   → Supabase Storage 'photos' バケット → photos テーブル upsert
// - 写真取得:       services/photos.service.ts → getJobPhotos()
//   → Supabase Browser Client (RLS: worker_id = auth.uid())
//
// 将来的にサーバーサイドに移行する場合はここに実装する。
// ============================================================

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'USE_SERVICE_DIRECTLY',
        message: '写真は services/photos.service.ts 経由で Supabase に直接アップロードしてください',
      },
    },
    { status: 501 }
  )
}

export async function GET(_req: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'USE_SERVICE_DIRECTLY',
        message: '写真は services/photos.service.ts 経由で Supabase から直接取得してください',
      },
    },
    { status: 501 }
  )
}
