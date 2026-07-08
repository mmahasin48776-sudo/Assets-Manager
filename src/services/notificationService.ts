import { supabase } from '../lib/supabase';
import { assetService } from './assetService';
import { licenseService } from './licenseService';
import { telecomService } from './telecomService';

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  type: string;
  action_type: string;
  link: string;
  is_read: number;
  expires_at: string | null;
  created_at: string;
}

function getDaysDifference(dateStr: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  
  const today = new Date();
  const dateObj = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const todayObj = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  
  const diffTime = dateObj.getTime() - todayObj.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export const notificationService = {
  async getNotifications(): Promise<NotificationItem[]> {
    let dbNotifications: NotificationItem[] = [];
    
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('id', { ascending: false });

      if (error) throw error;
      dbNotifications = data || [];
    } catch (err: any) {
      console.error('Error fetching notifications from Supabase:', err);
    }

    const dynamicAlerts: NotificationItem[] = [];
    const dismissedIds: number[] = JSON.parse(localStorage.getItem('dismissed_notifications') || '[]');

    try {
      const [assets, licenses, services] = await Promise.all([
        assetService.getAssets().catch(() => []),
        licenseService.getLicenses().catch(() => []),
        telecomService.getTelecomServices().catch(() => [])
      ]);

      // Process Assets (Warranty End)
      for (const asset of assets) {
        if (asset.expire_end) {
          const diffDays = getDaysDifference(asset.expire_end);
          if (diffDays !== null && diffDays >= -30 && diffDays <= 30) {
            const dynamicId = 100000 + asset.id;
            if (!dismissedIds.includes(dynamicId)) {
              let message = "";
              if (diffDays === 0) {
                message = `Asset "${asset.name}" (${asset.sn || 'N/A'})'s Warranty End is today!`;
              } else if (diffDays < 0) {
                message = `Asset "${asset.name}" (${asset.sn || 'N/A'})'s Warranty expired ${Math.abs(diffDays)} days ago (${asset.expire_end}).`;
              } else {
                message = `Asset "${asset.name}" (${asset.sn || 'N/A'})'s Warranty End will be in ${diffDays} days (${asset.expire_end}).`;
              }
              dynamicAlerts.push({
                id: dynamicId,
                title: "Warranty End Alert",
                message,
                type: "warning",
                action_type: "pending",
                link: `/assets?id=${asset.id}`,
                is_read: 0,
                expires_at: asset.expire_end,
                created_at: new Date().toISOString()
              });
            }
          }
        }
      }

      // Process Licenses (Expiry End)
      for (const lic of licenses) {
        if (lic.expire_end) {
          const diffDays = getDaysDifference(lic.expire_end);
          if (diffDays !== null && diffDays >= -30 && diffDays <= 30) {
            const dynamicId = 200000 + lic.id;
            if (!dismissedIds.includes(dynamicId)) {
              let message = "";
              if (diffDays === 0) {
                message = `License "${lic.name}" (${lic.sn || 'N/A'})'s Warranty End is today!`;
              } else if (diffDays < 0) {
                message = `License "${lic.name}" (${lic.sn || 'N/A'}) expired ${Math.abs(diffDays)} days ago (${lic.expire_end}).`;
              } else {
                message = `License "${lic.name}" (${lic.sn || 'N/A'})'s Warranty End will be in ${diffDays} days (${lic.expire_end}).`;
              }
              dynamicAlerts.push({
                id: dynamicId,
                title: "Warranty End Alert",
                message,
                type: "warning",
                action_type: "pending",
                link: `/licenses?id=${lic.id}`,
                is_read: 0,
                expires_at: lic.expire_end,
                created_at: new Date().toISOString()
              });
            }
          }
        }
      }

      // Process Telecom Services (Contract End)
      for (const svc of services) {
        if (svc.end_date) {
          const diffDays = getDaysDifference(svc.end_date);
          if (diffDays !== null && diffDays >= -30 && diffDays <= 30) {
            const dynamicId = 300000 + svc.id;
            if (!dismissedIds.includes(dynamicId)) {
              let message = "";
              if (diffDays === 0) {
                message = `Telecom Service "${svc.name}"'s Warranty End is today!`;
              } else if (diffDays < 0) {
                message = `Telecom Service "${svc.name}"'s contract expired ${Math.abs(diffDays)} days ago (${svc.end_date}).`;
              } else {
                message = `Telecom Service "${svc.name}"'s Warranty End will be in ${diffDays} days (${svc.end_date}).`;
              }
              dynamicAlerts.push({
                id: dynamicId,
                title: "Warranty End Alert",
                message,
                type: "warning",
                action_type: "pending",
                link: `/telecom-services?id=${svc.id}`,
                is_read: 0,
                expires_at: svc.end_date,
                created_at: new Date().toISOString()
              });
            }
          }
        }
      }
    } catch (e) {
      console.error("Error creating dynamic expiring alerts:", e);
    }

    return [...dynamicAlerts, ...dbNotifications];
  },

  async updateNotification(id: number, actionType: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ action_type: actionType, is_read: 1 })
        .eq('id', id);

      if (error) throw error;
    } catch (err: any) {
      console.error('Error updating notification on Supabase:', err);
      throw err;
    }
  },

  async deleteNotification(id: number): Promise<void> {
    const dismissed = JSON.parse(localStorage.getItem('dismissed_notifications') || '[]');
    if (!dismissed.includes(id)) {
      dismissed.push(id);
      localStorage.setItem('dismissed_notifications', JSON.stringify(dismissed));
    }

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (err: any) {
      console.error('Error deleting notification on Supabase:', err);
      throw err;
    }
  }
};
