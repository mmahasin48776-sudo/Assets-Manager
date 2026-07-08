import { supabase } from '../lib/supabase';
import { employeeService } from './employeeService';
import { lookupService } from './lookupService';
import { HistoryLog } from './assetService';

export interface License {
  id: number;
  sn: string;
  name: string;
  license_name: string;
  type_id: number | null;
  validity_type: string;
  license_tag: string;
  serial_key: string;
  cost: number;
  vendor_id: number | null;
  po_number: string;
  expire_start: string;
  expire_end: string;
  status: string;
  assigned_employee_id: number | null;
  pdf_path: string | null;
  location_id: number | null;
  created_at?: string;
  type_name?: string;
  vendor_name?: string;
  location_name?: string;
  employee_name?: string;
}

function cleanLicensePayload(license: Partial<License> & { [key: string]: any }): any {
  const allowedKeys = [
    'sn',
    'name',
    'license_name',
    'type_id',
    'validity_type',
    'license_tag',
    'serial_key',
    'cost',
    'vendor_id',
    'po_number',
    'expire_start',
    'expire_end',
    'status',
    'assigned_employee_id',
    'pdf_path',
    'location_id'
  ];

  const payload: any = {};
  for (const key of allowedKeys) {
    if (license[key] !== undefined) {
      let value = license[key];
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '' || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') {
          if (key === 'sn' || key === 'name' || key === 'license_name') {
            value = trimmed;
          } else {
            value = null;
          }
        }
      }

      const integerKeys = [
        'type_id',
        'vendor_id',
        'assigned_employee_id',
        'location_id'
      ];
      if (integerKeys.includes(key) && value !== null) {
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

export const licenseService = {
  async getLicenses(): Promise<License[]> {
    let rawLicenses: License[] = [];
    try {
      const { data, error } = await supabase
        .from('licenses')
        .select('*')
        .order('id', { ascending: false });

      if (error) throw error;
      rawLicenses = (data || []).map((l: any) => ({ ...l, cost: Number(l.cost || 0) }));
    } catch (err: any) {
      console.error('Error fetching licenses from Supabase:', err);
      throw err;
    }

    try {
      const [employees, locations, vendors, licenseTypes] = await Promise.all([
        employeeService.getEmployees(),
        lookupService.getLookup('locations'),
        lookupService.getLookup('vendors'),
        lookupService.getLookup('license-types')
      ]);

      return rawLicenses.map(lic => {
        const emp = employees.find(e => e.id === lic.assigned_employee_id);
        const loc = locations.find(l => l.id === lic.location_id);
        const ven = vendors.find(v => v.id === lic.vendor_id);
        const typeItem = licenseTypes.find(t => t.id === lic.type_id);

        return {
          ...lic,
          employee_name: emp ? emp.name : undefined,
          location_name: loc ? loc.name : undefined,
          vendor_name: ven ? ven.name : undefined,
          type_name: typeItem ? typeItem.name : undefined
        };
      });
    } catch (e) {
      console.error("Error populating license relationship names:", e);
      return rawLicenses;
    }
  },

  async addLicense(license: Partial<License>): Promise<License> {
    const licPayload = cleanLicensePayload(license);

    if (licPayload.name && !licPayload.license_name) {
      licPayload.license_name = licPayload.name;
    }

    try {
      const { data, error } = await supabase
        .from('licenses')
        .insert([licPayload])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err: any) {
      console.error('Error adding license to Supabase:', err);
      throw err;
    }
  },

  async updateLicense(id: number, license: Partial<License>): Promise<void> {
    const updPayload = cleanLicensePayload(license);

    if (updPayload.name && !updPayload.license_name) {
      updPayload.license_name = updPayload.name;
    }

    try {
      const { error } = await supabase
        .from('licenses')
        .update(updPayload)
        .eq('id', id);

      if (error) throw error;
    } catch (err: any) {
      console.error('Error updating license on Supabase:', err);
      throw err;
    }
  },

  async deleteLicense(id: number): Promise<void> {
    try {
      const { error } = await supabase
        .from('licenses')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (err: any) {
      console.error('Error deleting license from Supabase:', err);
      throw err;
    }
  },

  async getLicenseHistory(licenseId: number): Promise<HistoryLog[]> {
    const employees = await employeeService.getEmployees();

    try {
      const { data, error } = await supabase
        .from('history_logs')
        .select('*')
        .eq('license_id', licenseId)
        .order('id', { ascending: false });

      if (error) throw error;

      return (data || []).map((h: any) => {
        const emp = employees.find(e => e.id === h.employee_id);
        return {
          ...h,
          employee_name: emp ? emp.name : 'Unknown Employee',
          employee_sn: emp ? emp.sn : ''
        };
      });
    } catch (err: any) {
      console.error('Error fetching license history:', err);
      throw err;
    }
  },

  async assignLicense(licenseId: number, employeeId: number, notes: string, pdfPath?: string | null): Promise<void> {
    await this.updateLicense(licenseId, {
      assigned_employee_id: employeeId,
      status: 'Assigned'
    });

    const historyRecord = {
      license_id: licenseId,
      employee_id: employeeId,
      action_type: 'Assigned',
      action_date: new Date().toISOString(),
      notes: notes || '',
      pdf_path: pdfPath || null
    };

    try {
      const { error } = await supabase
        .from('history_logs')
        .insert([historyRecord]);

      if (error) throw error;
    } catch (err: any) {
      console.error('Error logging license assignment history:', err);
      throw err;
    }
  },

  async transferLicense(licenseId: number, targetEmployeeId: number, notes: string, pdfPath?: string | null): Promise<void> {
    const licenses = await this.getLicenses();
    const license = licenses.find(l => l.id === licenseId);
    const sourceEmployeeId = license ? license.assigned_employee_id : null;

    await this.updateLicense(licenseId, {
      assigned_employee_id: targetEmployeeId,
      status: 'Assigned'
    });

    const employees = await employeeService.getEmployees();
    const targetEmpObj = employees.find(e => e.id === targetEmployeeId);
    const sourceEmpObj = sourceEmployeeId ? employees.find(e => e.id === sourceEmployeeId) : null;

    const targetEmpName = targetEmpObj ? targetEmpObj.name : `Employee ID ${targetEmployeeId}`;
    const sourceEmpName = sourceEmpObj ? sourceEmpObj.name : 'Stock';

    const receiverHistoryRecord = {
      license_id: licenseId,
      employee_id: targetEmployeeId,
      action_type: 'Transfer',
      action_date: new Date().toISOString(),
      notes: notes || `Transferred from ${sourceEmpName}`,
      pdf_path: pdfPath || null
    };

    const senderHistoryRecord = sourceEmployeeId ? {
      license_id: licenseId,
      employee_id: sourceEmployeeId,
      action_type: 'Returned',
      action_date: new Date().toISOString(),
      notes: `Transferred to ${targetEmpName}. ${notes || ''}`.trim(),
      pdf_path: pdfPath || null
    } : null;

    const recordsToInsert = [receiverHistoryRecord];
    if (senderHistoryRecord) {
      recordsToInsert.push(senderHistoryRecord);
    }

    try {
      const { error } = await supabase
        .from('history_logs')
        .insert(recordsToInsert);
      if (error) throw error;
    } catch (err: any) {
      console.error('Error logging license transfer history:', err);
      throw err;
    }
  },

  async returnLicense(licenseId: number, notes: string, pdfPath?: string | null): Promise<void> {
    const licenses = await this.getLicenses();
    const license = licenses.find(l => l.id === licenseId);
    const assignedEmpId = license ? license.assigned_employee_id : null;

    await this.updateLicense(licenseId, {
      assigned_employee_id: null,
      status: 'Available'
    });

    const historyRecord = {
      license_id: licenseId,
      employee_id: assignedEmpId,
      action_type: 'Returned',
      action_date: new Date().toISOString(),
      notes: notes || '',
      pdf_path: pdfPath || null
    };

    try {
      const { error } = await supabase
        .from('history_logs')
        .insert([historyRecord]);
      if (error) throw error;
    } catch (err: any) {
      console.error('Error logging license return history:', err);
      throw err;
    }
  }
};
