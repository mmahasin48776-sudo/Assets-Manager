import { supabase } from '../lib/supabase';

export interface LocationItem {
  id: number;
  location_id: number;
  category: string;
  name: string;
  model: string;
  ip_address: string;
  username: string;
  password: string;
  access_password: string;
  serial: string;
  identify_address: string;
  notes: string;
  created_at?: string;
}

export const infrastructureService = {
  async getLocationItems(locationId?: number): Promise<LocationItem[]> {
    try {
      let query = supabase.from('location_items').select('*').order('id', { ascending: true });
      if (locationId) {
        query = query.eq('location_id', locationId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (err: any) {
      console.error('Error fetching location-items from Supabase:', err);
      throw err;
    }
  },

  async addLocationItem(item: Partial<LocationItem>): Promise<LocationItem> {
    const payload = {
      ...item,
      location_id: Number(item.location_id),
      created_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabase
        .from('location_items')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err: any) {
      console.error('Error creating location-item on Supabase:', err);
      throw err;
    }
  },

  async updateLocationItem(id: number, item: Partial<LocationItem>): Promise<void> {
    const payload = {
      ...item,
      ...(item.location_id !== undefined ? { location_id: Number(item.location_id) } : {})
    };

    try {
      const { error } = await supabase
        .from('location_items')
        .update(payload)
        .eq('id', id);

      if (error) throw error;
    } catch (err: any) {
      console.error('Error updating location-item on Supabase:', err);
      throw err;
    }
  },

  async deleteLocationItem(id: number): Promise<void> {
    try {
      const { error } = await supabase
        .from('location_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (err: any) {
      console.error('Error deleting location-item from Supabase:', err);
      throw err;
    }
  }
};
