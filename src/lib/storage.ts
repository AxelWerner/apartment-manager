import { supabase } from './supabase';

const BUCKET_NAME = 'apartment-media';

/**
 * Upload an image file (from desktop file picker or mobile camera)
 * to Supabase Storage. Falls back to base64 data URL if storage is offline.
 */
export async function uploadMedia(file: File, folder: 'receipts' | 'damages'): Promise<string> {
  const fileExt = file.name.split('.').pop() || 'jpg';
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.warn('Supabase storage upload failed, using local Data URL fallback:', error.message);
      return fileToDataUrl(file);
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.warn('Network error uploading to Supabase, fallback to Data URL:', err);
    return fileToDataUrl(file);
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
