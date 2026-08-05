import { createClient } from '@/lib/supabase/client'

export interface PhotoRow {
  id: string
  job_id: string
  spot_id: string | null
  photo_type: 'before' | 'after'
  storage_path: string
  url: string | null
  created_at: string
}

const BUCKET = 'photos'

export async function uploadPhoto(
  jobId: string,
  spotId: string,
  type: 'before' | 'after',
  file: File
): Promise<PhotoRow | null> {
  const supabase = createClient()

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${jobId}/${type}/${spotId}_${Date.now()}.${ext}`

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: true })

  if (uploadError) {
    console.error('[photos] upload error:', uploadError.message)
    return null
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)

  // Upsert photo record (update if spot+type already exists for this job)
  const { data, error } = await supabase
    .from('photos')
    .upsert(
      {
        job_id:       jobId,
        spot_id:      spotId,
        photo_type:   type,
        storage_path: path,
        url:          publicUrl,
      },
      { onConflict: 'job_id,spot_id,photo_type' }
    )
    .select()
    .single()

  if (error) {
    console.error('[photos] upsert error:', error.message)
    return null
  }
  return data as PhotoRow
}

export async function getJobPhotos(jobId: string): Promise<PhotoRow[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('photos')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true })
  return (data as PhotoRow[]) ?? []
}

export async function getSpotPhoto(
  jobId: string,
  spotId: string,
  type: 'before' | 'after'
): Promise<PhotoRow | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('photos')
    .select('*')
    .eq('job_id', jobId)
    .eq('spot_id', spotId)
    .eq('photo_type', type)
    .maybeSingle()
  return data as PhotoRow | null
}

export async function deletePhoto(photoId: string): Promise<boolean> {
  const supabase = createClient()
  // Get path first
  const { data: photo } = await supabase
    .from('photos')
    .select('storage_path')
    .eq('id', photoId)
    .single()

  if (photo?.storage_path) {
    await supabase.storage.from(BUCKET).remove([photo.storage_path])
  }

  const { error } = await supabase.from('photos').delete().eq('id', photoId)
  return !error
}
