import { supabase } from '@/src/lib/supabase'

export async function uploadImage(uri, bucket = 'menu-images') {
  const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg'
  const fileName = `${Date.now()}.${ext}`
  const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`

  const formData = new FormData()
  formData.append('file', { uri, name: fileName, type: mimeType })

  const { error } = await supabase.storage
    .from(bucket)
    .upload(fileName, formData, { contentType: mimeType })

  if (error) throw error

  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(fileName)

  return urlData.publicUrl
}
