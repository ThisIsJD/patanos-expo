import { useState, useCallback, useEffect } from 'react'
import { Alert } from 'react-native'
import { supabase } from '@/src/lib/supabase'
import { uploadImage } from '@/src/utils/imageUpload'

export function useGallery() {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchPhotos = useCallback(async () => {
    const { data } = await supabase
      .from('gallery_photos')
      .select('*')
      .order('sort_order', { ascending: true })

    if (data) setPhotos(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchPhotos()

    const channel = supabase
      .channel('gallery-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gallery_photos' }, () => {
        fetchPhotos()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchPhotos])

  const deletePhoto = async (id) => {
    const { error } = await supabase.from('gallery_photos').delete().eq('id', id)
    if (error) Alert.alert('Error', error.message)
  }

  const savePhoto = async ({ form, editingPhoto, localImageUri }) => {
    let imageUrl = form.image_url

    if (localImageUri) {
      imageUrl = await uploadImage(localImageUri, 'gallery-images')
    }

    if (editingPhoto) {
      const { error } = await supabase
        .from('gallery_photos')
        .update({
          image_url: imageUrl,
          caption: form.caption.trim(),
          link_url: form.link_url.trim() || null,
          sort_order: parseInt(form.sort_order) || 0,
        })
        .eq('id', editingPhoto.id)

      if (error) throw error
    } else {
      const { error } = await supabase
        .from('gallery_photos')
        .insert({
          image_url: imageUrl,
          caption: form.caption.trim(),
          link_url: form.link_url.trim() || null,
          sort_order: parseInt(form.sort_order) || photos.length + 1,
          status: 'published',
        })

      if (error) throw error
    }
  }

  return {
    photos,
    loading,
    deletePhoto,
    savePhoto,
  }
}
