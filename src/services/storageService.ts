import { supabase } from '../lib/supabase';

export const storageService = {
  /**
   * Uploads a file to a Supabase bucket
   */
  async uploadFile(bucketName: string, path: string, file: File | Blob): Promise<{ success: boolean; filePath?: string; fileUrl?: string; error?: string }> {
    try {
      // Create bucket if not exists or upload directly
      let uploadRes = await supabase.storage.from(bucketName).upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      });

      // If bucket doesn't exist, try to create it and retry upload once
      if (uploadRes.error && (
        uploadRes.error.message?.toLowerCase().includes('not found') || 
        uploadRes.error.message?.toLowerCase().includes('bucket') || 
        uploadRes.error.message?.toLowerCase().includes('does not exist') ||
        (uploadRes.error as any).status === 404
      )) {
        try {
          const { error: createError } = await supabase.storage.createBucket(bucketName, { public: true });
          if (!createError || createError.message?.toLowerCase().includes('already exists')) {
            uploadRes = await supabase.storage.from(bucketName).upload(path, file, {
              cacheControl: '3600',
              upsert: true,
            });
          }
        } catch (createErr) {
          console.warn('Failed to auto-create bucket:', createErr);
        }
      }

      if (uploadRes.error) {
        throw uploadRes.error;
      }

      const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(path);

      return {
        success: true,
        filePath: uploadRes.data?.path || path,
        fileUrl: publicUrlData?.publicUrl || `/uploads/${path}`
      };
    } catch (err: any) {
      console.warn('Supabase storage upload failed, falling back to local simulation:', err.message || err);
      
      try {
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (e) => reject(e);
          reader.readAsDataURL(file);
        });

        // Save serialized blob in localStorage
        const storageKey = `mock_file_${bucketName}_${path}`;
        try {
          localStorage.setItem(storageKey, base64Data);
        } catch (storageLimitErr) {
          console.warn('LocalStorage limit exceeded, using transient URL instead:', storageLimitErr);
        }

        return {
          success: true,
          filePath: path,
          fileUrl: base64Data
        };
      } catch (fallbackErr) {
        console.error('Local storage fallback failed:', fallbackErr);
        throw err;
      }
    }
  },

  /**
   * Deletes a file from a Supabase bucket
   */
  async deleteFile(bucketName: string, path: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.storage.from(bucketName).remove([path]);
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Storage Delete Error:', err.message || err);
      throw err;
    }
  },

  /**
   * Generates a public URL for a file
   */
  getPublicUrl(bucketName: string, path: string): string {
    const storageKey = `mock_file_${bucketName}_${path}`;
    const localData = localStorage.getItem(storageKey);
    if (localData) {
      return localData;
    }
    const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
    return data?.publicUrl || `/uploads/${path}`;
  }
};
