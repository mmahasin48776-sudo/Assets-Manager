import { supabase } from '../lib/supabase';
import { assetService } from './assetService';

export interface IncidentReport {
  id: number;
  title: string;
  description: string;
  reporter_id: number | null;
  reporter_name: string;
  type: string; // 'IT', 'Security', 'Safety', 'Facilities', 'Other'
  severity: string; // 'Low', 'Medium', 'High', 'Critical'
  status: string; // 'Open', 'In Progress', 'Resolved', 'Closed'
  asset_id: number | null;
  asset_name?: string;
  action_taken: string | null;
  created_at: string;
  updated_at: string;
  
  // New specific corporate form fields:
  employee_name?: string;
  employee_id?: string;
  department?: string;
  reporting_manager?: string;
  incident_number?: string;
  incident_date?: string;
  incident_time?: string;
  incident_taken_by?: string;
  incident_old_ref?: string;
  incident_definition?: string;
  impact_of_incident?: string;
  corrective_action?: string;
  corrective_action_date?: string;
  preventive_action?: string;
  prepared_by_name?: string;
  prepared_by_position?: string;
  prepared_by_location?: string;
  approval_file_url?: string;
  approval_file_name?: string;
}

const incidentSeeds: IncidentReport[] = [];

export const incidentService = {
  async getIncidentReports(): Promise<IncidentReport[]> {
    let list: IncidentReport[] = [];
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('incident_reports')
          .select('*')
          .order('id', { ascending: false });

        if (!error && data) {
          list = data;
        } else {
          list = this.getLocalIncidents();
        }
      } else {
        list = this.getLocalIncidents();
      }
    } catch {
      list = this.getLocalIncidents();
    }

    // Resolve asset names
    try {
      const assets = await assetService.getAssets();
      return list.map(item => {
        const asset = assets.find(a => a.id === item.asset_id);
        return {
          ...item,
          asset_name: asset ? `${asset.name} (${asset.sn})` : undefined
        };
      });
    } catch {
      return list;
    }
  },

  getLocalIncidents(): IncidentReport[] {
    const raw = localStorage.getItem('mock_incident_reports');
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      return parsed.filter((l: any) => l.title !== "Malware Intrusion at Asdam Projects Office" && l.id !== 1);
    } catch {
      return [];
    }
  },

  async addIncidentReport(report: Partial<IncidentReport>): Promise<IncidentReport> {
    const payload = {
      title: report.title || 'Untitled Incident',
      description: report.description || '',
      reporter_id: report.reporter_id || null,
      reporter_name: report.reporter_name || 'Anonymous',
      type: report.type || 'Other',
      severity: report.severity || 'Low',
      status: report.status || 'Open',
      asset_id: report.asset_id || null,
      action_taken: report.action_taken || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      
      employee_name: report.employee_name || '',
      employee_id: report.employee_id || '',
      department: report.department || '',
      reporting_manager: report.reporting_manager || '',
      incident_number: report.incident_number || '',
      incident_date: report.incident_date || new Date().toISOString().split('T')[0],
      incident_time: report.incident_time || '',
      incident_taken_by: report.incident_taken_by || '',
      incident_old_ref: report.incident_old_ref || '',
      incident_definition: report.incident_definition || '',
      impact_of_incident: report.impact_of_incident || '',
      corrective_action: report.corrective_action || '',
      corrective_action_date: report.corrective_action_date || new Date().toISOString().split('T')[0],
      preventive_action: report.preventive_action || '',
      prepared_by_name: report.prepared_by_name || '',
      prepared_by_position: report.prepared_by_position || '',
      prepared_by_location: report.prepared_by_location || '',
      approval_file_url: report.approval_file_url || '',
      approval_file_name: report.approval_file_name || ''
    };

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('incident_reports')
          .insert([payload])
          .select()
          .single();

        if (error) throw error;
        if (data) {
          // Sync local
          const local = this.getLocalIncidents();
          localStorage.setItem('mock_incident_reports', JSON.stringify([data, ...local]));
          return data;
        }
      } catch (err) {
        console.warn('Supabase incident insert failed, tracking locally:', err);
      }
    }

    // Local Insert Fallback
    const local = this.getLocalIncidents();
    const newId = local.length > 0 ? Math.max(...local.map(l => l.id)) + 1 : 1;
    const clientRecord: IncidentReport = {
      ...payload,
      id: newId
    };
    localStorage.setItem('mock_incident_reports', JSON.stringify([clientRecord, ...local]));
    return clientRecord;
  },

  async updateIncidentReport(id: number, report: Partial<IncidentReport>): Promise<void> {
    const payload = {
      ...report,
      updated_at: new Date().toISOString()
    };

    // Strip presentation fields
    delete payload.id;
    delete payload.asset_name;

    if (supabase) {
      try {
        const { error } = await supabase
          .from('incident_reports')
          .update(payload)
          .eq('id', id);

        if (error) throw error;
      } catch (err) {
        console.warn('Supabase incident update failed, updating locally:', err);
      }
    }

    // Always update local fallback so states remain fully in sync
    const local = this.getLocalIncidents();
    const idx = local.findIndex(l => l.id === id);
    if (idx > -1) {
      local[idx] = {
        ...local[idx],
        ...payload,
        updated_at: new Date().toISOString()
      };
      localStorage.setItem('mock_incident_reports', JSON.stringify(local));
    }
  },

  async deleteIncidentReport(id: number): Promise<void> {
    if (supabase) {
      try {
        const { error } = await supabase
          .from('incident_reports')
          .delete()
          .eq('id', id);

        if (error) throw error;
      } catch (err) {
        console.warn('Supabase incident delete failed, deleting locally:', err);
      }
    }

    // Always update local fallback
    const local = this.getLocalIncidents();
    const filtered = local.filter(l => l.id !== id);
    localStorage.setItem('mock_incident_reports', JSON.stringify(filtered));
  }
};
