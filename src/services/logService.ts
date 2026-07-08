import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { authService } from './authService';

export interface ActivityLog {
  id: number;
  entity_type: string;
  entity_id: number | null;
  entity_name: string;
  entity_identity: string;
  action: string;
  user_name: string;
  details: string;
  created_at: string;
}

export const logService = {
  async pruneOldLogs(): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const isoString = thirtyDaysAgo.toISOString();

    console.log('[Log Cleanup] Running automatic 30-day logs cleanup. Cutoff:', isoString);

    // 1. Clean up activity_logs in Supabase (if configured)
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('activity_logs')
          .delete()
          .lt('created_at', isoString);
        if (error) {
          console.warn('[Log Cleanup] Supabase activity_logs cleanup error:', error);
        } else {
          console.log('[Log Cleanup] Supabase activity_logs cleanup complete.');
        }
      } catch (err) {
        console.warn('[Log Cleanup] Supabase activity_logs exception:', err);
      }
    }

    // 2. Clean up login_logs in Supabase (if configured)
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('login_logs')
          .delete()
          .lt('login_time', isoString);
        if (error) {
          console.warn('[Log Cleanup] Supabase login_logs cleanup error:', error);
        } else {
          console.log('[Log Cleanup] Supabase login_logs cleanup complete.');
        }
      } catch (err) {
        console.warn('[Log Cleanup] Supabase login_logs exception:', err);
      }
    }

    // 3. Clean up login_logs in mock/localStorage (if exists)
    try {
      let mockLogs = JSON.parse(localStorage.getItem('mock_login_logs') || '[]');
      if (Array.isArray(mockLogs) && mockLogs.length > 0) {
        const initialCount = mockLogs.length;
        mockLogs = mockLogs.filter((log: any) => {
          const logDate = new Date(log.login_time || log.created_at || log.loginTime || log.login_log_time);
          return logDate >= thirtyDaysAgo;
        });
        if (mockLogs.length !== initialCount) {
          localStorage.setItem('mock_login_logs', JSON.stringify(mockLogs));
          console.log(`[Log Cleanup] Local mock_login_logs cleaned up. Removed ${initialCount - mockLogs.length} logs.`);
        }
      }
    } catch (err) {
      console.warn('[Log Cleanup] Local mock_login_logs exception:', err);
    }
  },

  async getActivityLogs(limit?: number): Promise<ActivityLog[]> {
    try {
      // Automatically prune logs older than 30 days
      try {
        await this.pruneOldLogs();
      } catch (e) {
        console.error('[Log Cleanup] Error in log pruning:', e);
      }

      // Exclude logs with entity_type = 'System' or entity_name = 'Auth' or action in (Login, Logout, MFA)
      let query = supabase
        .from('activity_logs')
        .select('*')
        .not('entity_type', 'eq', 'System')
        .not('entity_name', 'eq', 'Auth')
        .not('action', 'in', '("Login","Logout","MFA")')
        .order('created_at', { ascending: false });

      if (limit) {
        query = query.limit(Math.max(limit * 3, 50));
      }

      const { data, error } = await query;
      if (error) throw error;

      // In-memory filter to absolutely guarantee that no login, logout, or auth details are shown
      const filtered = (data || []).filter((log: ActivityLog) => {
        const type = (log.entity_type || '').toLowerCase();
        const name = (log.entity_name || '').toLowerCase();
        const action = (log.action || '').toLowerCase();
        const details = (log.details || '').toLowerCase();

        if (type === 'system' || name === 'auth') return false;
        if (['login', 'logout', 'mfa'].includes(action)) return false;
        if (
          details.includes('login') || 
          details.includes('logout') || 
          details.includes('two-factor') || 
          details.includes('mfa') || 
          details.includes('logged in') || 
          details.includes('logged out') || 
          details.includes('otp')
        ) {
          return false;
        }

        return true;
      });

      if (limit) {
        return filtered.slice(0, limit);
      }
      return filtered;
    } catch (err: any) {
      console.error('Error fetching logs from Supabase:', err);
      throw err;
    }
  },

  async addActivityLog(
    type: string,
    entityId: number | null,
    entityName: string,
    entityIdentity: string,
    action: string,
    details: string
  ): Promise<void> {
    const user = await authService.getCurrentUser();
    const payload = {
      entity_type: type,
      entity_id: entityId,
      entity_name: entityName || '–',
      entity_identity: entityIdentity || '–',
      action,
      user_name: user?.username || 'system_admin',
      details,
      created_at: new Date().toISOString()
    };

    try {
      const { error } = await supabase
        .from('activity_logs')
        .insert([payload]);
      if (error) throw error;
    } catch (err: any) {
      console.error('Error recording activity log in Supabase:', err);
      throw err;
    }
  },

  async getLogUsers(): Promise<string[]> {
    try {
      const logs = await this.getActivityLogs();
      const usernames = logs.map(l => l.user_name).filter(Boolean);
      return Array.from(new Set(usernames));
    } catch {
      return [];
    }
  }
};
