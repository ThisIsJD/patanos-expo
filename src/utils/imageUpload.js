import { supabase } from '@/src/lib/supabase'

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export async function uploadImage(uri, bucket = 'menu-images') {
  const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg'
  const fileName = `${generateUUID()}.${ext}`
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
