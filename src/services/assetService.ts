import { supabase } from '../lib/supabase';
import { employeeService } from './employeeService';
import { lookupService } from './lookupService';

export interface Asset {
  id: number;
  sn: string;
  name: string;
  asset_name: string;
  asset_name_id: number | null;
  model_id: number | null;
  manufacturer_id: number | null;
  category_id: number | null;
  asset_tag: string;
  hostname: string;
  feature: string;
  cost: number;
  vendor_id: number | null;
  po_number: string;
  purchase_date: string;
  expire_start: string;
  expire_end: string;
  depreciation_period: number;
  status: string;
  assigned_employee_id: number | null;
  pdf_path: string | null;
  location_id: number | null;
  created_at?: string;
}

export interface HistoryLog {
  id: number;
  asset_id?: number | null;
  license_id?: number | null;
  employee_id: number | null;
  action_type: string;
  action_date: string;
  notes: string;
  pdf_path?: string | null;
  employee_name?: string;
  employee_sn?: string;
}

const assetSeeds: Asset[] = [
  { id: 1, sn: "SN-MAC-01", name: "MacBook Pro M3 Max", asset_name: "Primary Workstation", asset_name_id: 1, model_id: 1, manufacturer_id: 1, category_id: 1, asset_tag: "AST-1001", hostname: "OTAIBI-MAC", feature: "64GB RAM, 2TB SSD", cost: 14500.00, vendor_id: 3, po_number: "PO-2026-001", purchase_date: "2026-01-15", expire_start: "2026-01-15", expire_end: "2029-01-15", depreciation_period: 36, status: "Assigned", assigned_employee_id: 1, location_id: 1, pdf_path: null },
  { id: 2, sn: "SN-THINK-02", name: "ThinkPad X1 Carbon Gen 12", asset_name: "Primary Workstation", asset_name_id: 1, model_id: 2, manufacturer_id: 2, category_id: 1, asset_tag: "AST-1002", hostname: "ASMARI-THINK", feature: "32GB RAM, 1TB SSD", cost: 8200.00, vendor_id: 2, po_number: "PO-2026-002", purchase_date: "2026-02-10", expire_start: "2026-02-10", expire_end: "2029-02-10", depreciation_period: 36, status: "Assigned", assigned_employee_id: 2, location_id: 2, pdf_path: null },
  { id: 3, sn: "SN-IPAD-03", name: "iPad Pro 12.9 M2", asset_name: "Mobile Terminal", asset_name_id: 3, model_id: 3, manufacturer_id: 1, category_id: 3, asset_tag: "AST-1003", hostname: "SARAH-IPAD", feature: "Wi-Fi + Cellular", cost: 4800.00, vendor_id: 3, po_number: "PO-2026-003", purchase_date: "2026-03-01", expire_start: "2026-03-01", expire_end: "2028-03-01", depreciation_period: 24, status: "Available", assigned_employee_id: null, location_id: 1, pdf_path: null },
  { id: 4, sn: "SN-LAT-04", name: "Dell Latitude 5440", asset_name: "Primary Workstation", asset_name_id: 1, model_id: 4, manufacturer_id: 4, category_id: 1, asset_tag: "AST-1004", hostname: "DELL-LAT-04", feature: "16GB RAM, 512GB SSD", cost: 5400.00, vendor_id: 3, po_number: "PO-2026-004", purchase_date: "2026-03-10", expire_start: "2026-03-10", expire_end: "2029-03-10", depreciation_period: 36, status: "Available", assigned_employee_id: null, location_id: 1, pdf_path: null },
  { id: 5, sn: "SN-IPHONE-05", name: "iPhone 15 Pro Max", asset_name: "Mobile Terminal", asset_name_id: 3, model_id: 4, manufacturer_id: 1, category_id: 3, asset_tag: "AST-1005", hostname: "TARIQ-PHONE", feature: "Wi-Fi + Cellular", cost: 5200.00, vendor_id: 3, po_number: "PO-2026-005", purchase_date: "2026-03-12", expire_start: "2026-03-12", expire_end: "2028-03-12", depreciation_period: 24, status: "Assigned", assigned_employee_id: 4, location_id: 3, pdf_path: null },
  { id: 6, sn: "SN-CISCO-06", name: "Cisco Catalyst 9300", asset_name: "Network Switch", asset_name_id: 2, model_id: 5, manufacturer_id: 3, category_id: 2, asset_tag: "AST-1006", hostname: "CISCO-NET-06", feature: "48-Port PoE+", cost: 18500.00, vendor_id: 1, po_number: "PO-2026-006", purchase_date: "2026-01-20", expire_start: "2026-01-20", expire_end: "2031-01-20", depreciation_period: 60, status: "Assigned", assigned_employee_id: 3, location_id: 1, pdf_path: null }
];

function cleanAssetPayload(asset: Partial<Asset> & { [key: string]: any }): any {
  const allowedKeys = [
    'sn',
    'name',
    'asset_name',
    'asset_name_id',
    'model_id',
    'manufacturer_id',
    'category_id',
    'asset_tag',
    'hostname',
    'feature',
    'cost',
    'vendor_id',
    'po_number',
    'purchase_date',
    'expire_start',
    'expire_end',
    'depreciation_period',
    'status',
    'assigned_employee_id',
    'pdf_path',
    'location_id'
  ];

  const payload: any = {};
  for (const key of allowedKeys) {
    if (asset[key] !== undefined) {
      let value = asset[key];
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimToNull(trimmed) === null) {
          if (key === 'sn' || key === 'name' || key === 'asset_name' || key === 'asset_tag' || key === 'hostname') {
            value = trimmed;
          } else {
            value = null;
          }
        }
      }

      const integerKeys = [
        'asset_name_id',
        'model_id',
        'manufacturer_id',
        'category_id',
        'vendor_id',
        'assigned_employee_id',
        'location_id',
        'depreciation_period'
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

function trimToNull(str: string): string | null {
  if (!str) return null;
  const trimmed = str.trim();
  if (trimmed === '' || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') {
    return null;
  }
  return trimmed;
}

export const assetService = {
  async getAssets(): Promise<Asset[]> {
    let rawAssets: Asset[] = [];
    try {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .order('id', { ascending: false });

      if (error) throw error;
      rawAssets = (data || []).map((a: any) => ({ ...a, cost: Number(a.cost || 0) }));
    } catch (err: any) {
      console.error('Error fetching assets from Supabase:', err);
      throw err;
    }

    try {
      const [employees, categories, locations, vendors, manufacturers, models, assetNames] = await Promise.all([
        employeeService.getEmployees(),
        lookupService.getLookup('categories'),
        lookupService.getLookup('locations'),
        lookupService.getLookup('vendors'),
        lookupService.getLookup('manufacturers'),
        lookupService.getLookup('models'),
        lookupService.getLookup('asset-names')
      ]);

      return rawAssets.map(asset => {
        const emp = employees.find(e => e.id === asset.assigned_employee_id);
        const cat = categories.find(c => c.id === asset.category_id);
        const loc = locations.find(l => l.id === asset.location_id);
        const ven = vendors.find(v => v.id === asset.vendor_id);
        const mfg = manufacturers.find(m => m.id === asset.manufacturer_id);
        const mdl = models.find(m => m.id === asset.model_id);
        const asName = assetNames.find(an => an.id === asset.asset_name_id);

        return {
          ...asset,
          employee_name: emp ? emp.name : undefined,
          category_name: cat ? cat.name : undefined,
          location_name: loc ? loc.name : undefined,
          vendor_name: ven ? ven.name : undefined,
          manufacturer_name: mfg ? mfg.name : undefined,
          model_name: mdl ? mdl.name : undefined,
          asset_name: asName ? asName.name : asset.asset_name
        };
      });
    } catch (e) {
      console.error("Error populating asset relationship names:", e);
      return rawAssets;
    }
  },

  async addAsset(asset: Partial<Asset>): Promise<Asset> {
    const assetPayload = cleanAssetPayload(asset);

    if (assetPayload.name && !assetPayload.asset_name) {
      assetPayload.asset_name = assetPayload.name;
    }
    if (assetPayload.asset_name && !assetPayload.asset_name_id) {
      try {
        const { data: nameData } = await supabase
          .from('asset_names')
          .select('id')
          .eq('name', assetPayload.asset_name)
          .limit(1);
        if (nameData && nameData.length > 0) {
          assetPayload.asset_name_id = nameData[0].id;
        }
      } catch (e) {
        console.warn("Failed to lookup asset_name_id", e);
      }
    }

    try {
      const { data, error } = await supabase
        .from('assets')
        .insert([assetPayload])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err: any) {
      console.error('Error inserting asset to Supabase:', err);
      throw err;
    }
  },

  async updateAsset(id: number, asset: Partial<Asset>): Promise<void> {
    const updPayload = cleanAssetPayload(asset);

    if (updPayload.name && !updPayload.asset_name) {
      updPayload.asset_name = updPayload.name;
    }
    if (updPayload.asset_name && !updPayload.asset_name_id) {
      try {
        const { data: nameData } = await supabase
          .from('asset_names')
          .select('id')
          .eq('name', updPayload.asset_name)
          .limit(1);
        if (nameData && nameData.length > 0) {
          updPayload.asset_name_id = nameData[0].id;
        }
      } catch (e) {
        console.warn("Failed to lookup asset_name_id", e);
      }
    }

    try {
      const { error } = await supabase
        .from('assets')
        .update(updPayload)
        .eq('id', id);

      if (error) throw error;
    } catch (err: any) {
      console.error('Error updating asset in Supabase:', err);
      throw err;
    }
  },

  async deleteAsset(id: number): Promise<void> {
    try {
      const { error } = await supabase
        .from('assets')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (err: any) {
      console.error('Error deleting asset from Supabase:', err);
      throw err;
    }
  },

  async getAssetHistory(assetId: number): Promise<HistoryLog[]> {
    const employees = await employeeService.getEmployees();

    try {
      const { data, error } = await supabase
        .from('history_logs')
        .select('*')
        .eq('asset_id', assetId)
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
      console.error('Error fetching asset history logs from Supabase:', err);
      throw err;
    }
  },

  async assignAsset(assetId: number, employeeId: number, notes: string, pdfPath?: string | null): Promise<void> {
    await this.updateAsset(assetId, {
      assigned_employee_id: employeeId,
      status: 'Assigned'
    });

    const historyRecord = {
      asset_id: assetId,
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
      console.error('Error logging asset assignment history:', err);
      throw err;
    }
  },

  async transferAsset(assetId: number, targetEmployeeId: number, notes: string, pdfPath?: string | null): Promise<void> {
    const assets = await this.getAssets();
    const asset = assets.find(a => a.id === assetId);
    const sourceEmployeeId = asset ? asset.assigned_employee_id : null;

    await this.updateAsset(assetId, {
      assigned_employee_id: targetEmployeeId,
      status: 'Assigned'
    });

    const employees = await employeeService.getEmployees();
    const targetEmpObj = employees.find(e => e.id === targetEmployeeId);
    const sourceEmpObj = sourceEmployeeId ? employees.find(e => e.id === sourceEmployeeId) : null;

    const targetEmpName = targetEmpObj ? targetEmpObj.name : `Employee ID ${targetEmployeeId}`;
    const sourceEmpName = sourceEmpObj ? sourceEmpObj.name : 'Stock';

    const receiverHistoryRecord = {
      asset_id: assetId,
      employee_id: targetEmployeeId,
      action_type: 'Transfer',
      action_date: new Date().toISOString(),
      notes: notes || `Transferred from ${sourceEmpName}`,
      pdf_path: pdfPath || null
    };

    const senderHistoryRecord = sourceEmployeeId ? {
      asset_id: assetId,
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
      console.error('Error logging asset transfer history:', err);
      throw err;
    }
  },

  async returnAsset(assetId: number, notes: string, pdfPath?: string | null): Promise<void> {
    const assets = await this.getAssets();
    const asset = assets.find(a => a.id === assetId);
    const assignedEmpId = asset ? asset.assigned_employee_id : null;

    await this.updateAsset(assetId, {
      assigned_employee_id: null,
      status: 'Available'
    });

    const historyRecord = {
      asset_id: assetId,
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
      console.error('Error logging asset return history:', err);
      throw err;
    }
  },

  async seedTenSampleAssets(): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      const assetsToInsert = assetSeeds.map(asset => {
        const { id, ...rest } = asset;
        return rest;
      });

      const { data, error } = await supabase
        .from('assets')
        .insert(assetsToInsert)
        .select();

      if (error) throw error;
      return { success: true, count: data?.length || assetsToInsert.length };
    } catch (err: any) {
      console.error('Error seeding assets to Supabase:', err);
      return { success: false, count: 0, error: err.message || String(err) };
    }
  }
};
