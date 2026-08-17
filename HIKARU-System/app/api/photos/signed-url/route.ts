import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const BUCKET        = 'photos'
const ALLOWED_TYPES = new Set(['before', 'after'])
const ALLOWED_EXTS  = new Set(['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp'])

// POST /api/photos/signed-url
// ワーカーがBefore/After写真をStorage直接アップロードするためのSigned Upload URLを発行する。
// ブラウザ側でSupabase auth.getSession()を一切呼ばない方式（refreshingDeferredハング回避）。
export async function POST(req: NextRequest) {
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { jobId?: string; spotId?: string; photoType?: string; ext?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const { jobId, spotId, photoType, ext: rawExt } = body

  if (!jobId || !spotId || !photoType) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.has(photoType)) {
    return NextResponse.json({ error: 'invalid photoType' }, { status: 400 })
  }

  const ext = ALLOWED_EXTS.has(rawExt?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? '')
    ? rawExt!.toLowerCase().replace(/[^a-z0-9]/g, '')
    : 'jpg'

  const admin = createAdminClient()

  try {
    // 1. job ownership確認: worker_id = 認証済みUID
    const { data: job } = await admin
      .from('jobs')
      .select('id, project_id, worker_id')
      .eq('id', jobId)
      .eq('worker_id', uid)
      .neq('status', 'cancelled')
      .maybeSingle()

    if (!job) return NextResponse.json({ error: 'job not found' }, { status: 404 })

    // 2. spot ownership確認: spot.project_id = job.project_id（他案件のspotIDを使えない）
    const { data: spot } = await admin
      .from('photo_spots')
      .select('id')
      .eq('id', spotId)
      .eq('project_id', job.project_id)
      .maybeSingle()

    if (!spot) return NextResponse.json({ error: 'spot not found' }, { status: 404 })

    // 3. storageパスをサーバー側で生成（クライアントからのpath指定を一切受け付けない）
    const path = `${jobId}/${photoType}/${spotId}_${Date.now()}.${ext}`

    // 4. Signed Upload URL発行（upsert: true = 撮り直し対応）
    const { data, error } = await admin.storage
      .from(BUCKET)
      .createSignedUploadUrl(path, { upsert: true })

    if (error || !data) {
      console.error('[photos/signed-url] storage error:', error?.message)
      return NextResponse.json({ error: 'storage error' }, { status: 500 })
    }

    return NextResponse.json({ signedUrl: data.signedUrl, path: data.path, token: data.token })
  } catch (e) {
    console.error('[photos/signed-url] server error:', e)
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}
