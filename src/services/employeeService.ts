import { supabase } from '../lib/supabase';
import { storageService } from './storageService';

export interface Employee {
  id: number;
  sn: string;
  name: string;
  email: string;
  position: string;
  department: string;
  mobile: string;
  location: string;
  location_id: number;
  status: string;
  notes: string;
  reporting_manager: string;
  company_name: string;
}

export interface FileRecord {
  id: number;
  employee_id?: number;
  file_name: string;
  file_path: string;
  uploaded_at: string;
}

export const employeeService = {
  async getEmployees(): Promise<Employee[]> {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('id', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err: any) {
      console.error('Error getting employees from Supabase:', err);
      throw err;
    }
  },

  async addEmployee(employee: Partial<Employee>): Promise<Employee> {
    try {
      const { data, error } = await supabase
        .from('employees')
        .insert([employee])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err: any) {
      console.error('Error adding employee to Supabase:', err);
      throw err;
    }
  },

  async updateEmployee(id: number, employee: Partial<Employee>): Promise<void> {
    try {
      const { error } = await supabase
        .from('employees')
        .update(employee)
        .eq('id', id);

      if (error) throw error;
    } catch (err: any) {
      console.error('Error updating employee on Supabase:', err);
      throw err;
    }
  },

  async deleteEmployee(id: number): Promise<void> {
    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (err: any) {
      console.error('Error deleting employee on Supabase:', err);
      throw err;
    }
  },

  async getEmployeeFiles(employeeId: number): Promise<FileRecord[]> {
    try {
      const { data, error } = await supabase
        .from('employee_files')
        .select('*')
        .eq('employee_id', employeeId);

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error getting employee files:', err);
      throw err;
    }
  },

  async uploadEmployeeFile(employeeId: number, file: File): Promise<FileRecord> {
    const fileName = `${Date.now()}_${file.name}`;
    const storageResult = await storageService.uploadFile('employee-files', fileName, file);

    const record: Partial<FileRecord> = {
      employee_id: employeeId,
      file_name: file.name,
      file_path: storageResult.fileUrl || `/uploads/${fileName}`,
      uploaded_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabase
        .from('employee_files')
        .insert([record])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error storing file metadata in Supabase:', err);
      throw err;
    }
  },

  async deleteEmployeeFile(fileId: number): Promise<void> {
    try {
      // Fetch file info first
      const { data: record, error: findError } = await supabase
        .from('employee_files')
        .select('*')
        .eq('id', fileId)
        .single();

      if (findError) throw findError;

      if (record) {
        // Parse fileName from path
        const fileParts = record.file_path.split('/');
        const fileName = fileParts[fileParts.length - 1];
        await storageService.deleteFile('employee-files', fileName);
      }

      const { error: deleteError } = await supabase
        .from('employee_files')
        .delete()
        .eq('id', fileId);

      if (deleteError) throw deleteError;
    } catch (err) {
      console.error('Error deleting employee file from Supabase:', err);
      throw err;
    }
  }
};
