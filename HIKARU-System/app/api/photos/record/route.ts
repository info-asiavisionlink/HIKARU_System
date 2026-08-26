import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const BUCKET        = 'photos'
const ALLOWED_TYPES = new Set(['before', 'after'])

// POST /api/photos/record
// Storage直接アップロード完了後にpublic.photosへ記録する。
// partial unique index問題を回避するためSELECT → UPDATE/INSERTで保存。
export async function POST(req: NextRequest) {
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { jobId?: string; spotId?: string; photoType?: string; storagePath?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const { jobId, spotId, photoType, storagePath } = body

  if (!jobId || !spotId || !photoType || !storagePath) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.has(photoType)) {
    return NextResponse.json({ error: 'invalid photoType' }, { status: 400 })
  }

  // storagePathの形式検証: {jobId}/{photoType}/{spotId}_ で始まること（IDOR対策）
  const expectedPrefix = `${jobId}/${photoType}/${spotId}_`
  if (!storagePath.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: 'invalid storagePath' }, { status: 400 })
  }

  const admin = createAdminClient()

  try {
    // 1. job ownership再確認
    const { data: job } = await admin
      .from('jobs')
      .select('id, project_id, worker_id, status')
      .eq('id', jobId)
      .eq('worker_id', uid)
      .neq('status', 'cancelled')
      .maybeSingle()

    if (!job) return NextResponse.json({ error: 'job not found' }, { status: 404 })

    // JOB-C6A: completed Jobへの写真record保存をブロック（ownership確認後、DB書込前）
    if (job.status === 'completed') {
      return NextResponse.json({ error: 'job already completed' }, { status: 409 })
    }

    // 2. spot ownership再確認
    const { data: spot } = await admin
      .from('photo_spots')
      .select('id')
      .eq('id', spotId)
      .eq('project_id', job.project_id)
      .maybeSingle()

    if (!spot) return NextResponse.json({ error: 'spot not found' }, { status: 404 })

    // 3. public URL取得
    const { data: { publicUrl } } = admin.storage.from(BUCKET).getPublicUrl(storagePath)

    // 4. SELECT → UPDATE/INSERT（partial unique index問題を回避）
    const { data: existing } = await admin
      .from('photos')
      .select('id, storage_path')
      .eq('job_id', jobId)
      .eq('spot_id', spotId)
      .eq('photo_type', photoType)
      .maybeSingle()

    let photo
    if (existing) {
      const oldPath = existing.storage_path

      const { data: updated, error: updateErr } = await admin
        .from('photos')
        .update({ storage_path: storagePath, url: publicUrl })
        .eq('id', existing.id)
        .select()
        .single()

      if (updateErr) {
        console.error('[photos/record] update error:', updateErr.message)
        return NextResponse.json({ error: 'db error' }, { status: 500 })
      }
      photo = updated

      // 撮り直し: 旧Storageオブジェクト削除（新保存成功後のみ）
      if (oldPath && oldPath !== storagePath) {
        await admin.storage.from(BUCKET).remove([oldPath]).catch(() => {})
      }
    } else {
      const { data: inserted, error: insertErr } = await admin
        .from('photos')
        .insert({
          job_id:       jobId,
          spot_id:      spotId,
          photo_type:   photoType,
          storage_path: storagePath,
          url:          publicUrl,
        })
        .select()
        .single()

      if (insertErr) {
        console.error('[photos/record] insert error:', insertErr.message)
        return NextResponse.json({ error: 'db error' }, { status: 500 })
      }
      photo = inserted
    }

    return NextResponse.json({ photo })
  } catch (e) {
    console.error('[photos/record] server error:', e)
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}
