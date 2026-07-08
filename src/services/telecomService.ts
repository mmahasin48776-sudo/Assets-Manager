import { supabase } from '../lib/supabase';
import { storageService } from './storageService';

export interface TelecomService {
  id: number;
  name: string;
  provider: string;
  account_number: string;
  cost: number;
  status: string;
  contract_start_date: string;
  end_date: string;
  facility: string;
  po_number: string;
  contact_info: string;
  location_id: number | null;
  notes: string;
  file_url: string | null;
  file_name: string | null;
  created_at: string;
}

function cleanTelecomPayload(service: Partial<TelecomService> & { [key: string]: any }): any {
  const allowedKeys = [
    'name',
    'provider',
    'account_number',
    'cost',
    'status',
    'contract_start_date',
    'end_date',
    'facility',
    'po_number',
    'contact_info',
    'location_id',
    'notes',
    'file_url',
    'file_name'
  ];

  const payload: any = {};
  for (const key of allowedKeys) {
    if (service[key] !== undefined) {
      let value = service[key];
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '' || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') {
          if (key === 'name' || key === 'provider' || key === 'account_number') {
            value = trimmed;
          } else {
            value = null;
          }
        }
      }

      if (key === 'location_id' && value !== null) {
        const parsed = parseInt(value, 10);
        value = isNaN(parsed) ? null : parsed;
      }

      if (key === 'cost' && value !== null) {
        const parsed = parseFloat(value);
        value = isNaN(parsed) ? null : parsed;
      }

      payload[key] = value;
    }
  }

  return payload;
}

export const telecomService = {
  async getTelecomServices(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('telecom_services')
        .select('*')
        .order('id', { ascending: false });

      if (error) throw error;
      return (data || []).map((t: any) => {
        let files: any[] = [];
        if (t.file_url) {
          if (t.file_url.startsWith('[')) {
            try {
              files = JSON.parse(t.file_url);
            } catch (e) {
              files = [{ id: 1, file_name: t.file_name || 'Attachment', file_path: t.file_url }];
            }
          } else {
            files = [{ id: 1, file_name: t.file_name || 'Attachment', file_path: t.file_url }];
          }
        }
        return {
          ...t,
          cost: Number(t.cost || 0),
          files
        };
      });
    } catch (err: any) {
      console.error('Error fetching telecom services from Supabase:', err);
      throw err;
    }
  },

  async addTelecomService(service: Partial<TelecomService>, filesToUpload?: File | File[]): Promise<TelecomService> {
    let fileMeta: { file_url: string | null, file_name: string | null } = { file_url: null, file_name: null };

    if (filesToUpload) {
      const fileArray = Array.isArray(filesToUpload) ? filesToUpload : [filesToUpload];
      const uploadedFilesList: any[] = [];

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        const fileName = `${Date.now()}_${i}_telecom_${file.name}`;
        try {
          const uploadResult = await storageService.uploadFile('telecom-files', fileName, file);
          if (uploadResult.success) {
            uploadedFilesList.push({
              id: Date.now() + i,
              file_name: file.name,
              file_path: uploadResult.filePath || uploadResult.fileUrl
            });
          }
        } catch (uploadErr) {
          console.error(`File upload failed for ${file.name}:`, uploadErr);
        }
      }

      if (uploadedFilesList.length > 0) {
        fileMeta = {
          file_url: JSON.stringify(uploadedFilesList),
          file_name: uploadedFilesList[0].file_name
        };
      }
    }

    const cleaned = cleanTelecomPayload(service);
    const payload = {
      ...cleaned,
      ...fileMeta,
      cost: Number(cleaned.cost || 0),
      status: cleaned.status || 'Active',
      created_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabase
        .from('telecom_services')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;
      
      // Parse files back for UI consumption
      let files: any[] = [];
      if (data && data.file_url) {
        if (data.file_url.startsWith('[')) {
          try {
            files = JSON.parse(data.file_url);
          } catch (e) {
            files = [{ id: 1, file_name: data.file_name || 'Attachment', file_path: data.file_url }];
          }
        } else {
          files = [{ id: 1, file_name: data.file_name || 'Attachment', file_path: data.file_url }];
        }
      }

      return {
        ...data,
        files
      };
    } catch (err: any) {
      console.error('Error creating telecom service on Supabase:', err);
      throw err;
    }
  },

  async updateTelecomService(id: number, service: Partial<TelecomService>, filesToUpload?: File | File[]): Promise<void> {
    let fileMeta: { file_url?: string | null, file_name?: string | null } = {};

    let existingFileList: any[] = [];
    try {
      const { data: record } = await supabase
        .from('telecom_services')
        .select('file_url, file_name')
        .eq('id', id)
        .single();
      if (record && record.file_url) {
        if (record.file_url.startsWith('[')) {
          existingFileList = JSON.parse(record.file_url);
        } else {
          existingFileList = [{ id: 1, file_name: record.file_name || 'Attachment', file_path: record.file_url }];
        }
      }
    } catch (e) {
      console.warn('Failed to fetch existing files for update:', e);
    }

    if (filesToUpload) {
      const fileArray = Array.isArray(filesToUpload) ? filesToUpload : [filesToUpload];
      const uploadedFilesList: any[] = [...existingFileList];

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        const fileName = `${Date.now()}_${i}_telecom_${file.name}`;
        try {
          const uploadResult = await storageService.uploadFile('telecom-files', fileName, file);
          if (uploadResult.success) {
            uploadedFilesList.push({
              id: Date.now() + 1000 + i,
              file_name: file.name,
              file_path: uploadResult.filePath || uploadResult.fileUrl
            });
          }
        } catch (uploadErr) {
          console.error(`File upload failed for ${file.name}:`, uploadErr);
        }
      }

      fileMeta = {
        file_url: JSON.stringify(uploadedFilesList),
        file_name: uploadedFilesList.length > 0 ? uploadedFilesList[0].file_name : null
      };
    }

    const cleaned = cleanTelecomPayload(service);
    const updPayload = {
      ...cleaned,
      ...fileMeta
    };

    try {
      const { error } = await supabase
        .from('telecom_services')
        .update(updPayload)
        .eq('id', id);

      if (error) throw error;
    } catch (err: any) {
      console.error('Error updating telecom on Supabase:', err);
      throw err;
    }
  },

  async deleteTelecomService(id: number): Promise<void> {
    try {
      // Fetch file info to remove storage asset
      const { data: record } = await supabase
        .from('telecom_services')
        .select('*')
        .eq('id', id)
        .single();

      if (record && record.file_url) {
        let filesToDelete: any[] = [];
        if (record.file_url.startsWith('[')) {
          try {
            filesToDelete = JSON.parse(record.file_url);
          } catch (e) {
            filesToDelete = [{ file_path: record.file_url }];
          }
        } else {
          filesToDelete = [{ file_path: record.file_url }];
        }

        for (const f of filesToDelete) {
          if (f.file_path) {
            try {
              const parts = f.file_path.split('/');
              const fileName = parts[parts.length - 1];
              await storageService.deleteFile('telecom-files', fileName);
            } catch (storageErr) {
              console.warn('Could not delete storage file payload:', storageErr);
            }
          }
        }
      }

      const { error } = await supabase
        .from('telecom_services')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (err: any) {
      console.error('Error deleting telecom service from Supabase:', err);
      throw err;
    }
  },

  async deleteFile(id: number): Promise<void> {
    await this.updateTelecomService(id, {
      file_url: null,
      file_name: null
    });
  }
};
