import { supabase } from '../lib/supabase';

export interface LookupItem {
  id: number;
  name: string;
}

const lookupKeyMap: { [key: string]: string } = {
  'categories': 'categories',
  'models': 'models',
  'manufacturers': 'manufacturers',
  'vendors': 'vendors',
  'license-types': 'license_types',
  'locations': 'locations',
  'departments': 'departments',
  'positions': 'positions',
  'features': 'features',
  'asset-names': 'asset_names',
  'license-names': 'license_names'
};

const localKeys: { [key: string]: string } = {
  'categories': 'categories',
  'models': 'models',
  'manufacturers': 'manufacturers',
  'vendors': 'vendors',
  'license-types': 'licenseTypes',
  'locations': 'locations',
  'departments': 'departments',
  'positions': 'positions',
  'features': 'features',
  'asset-names': 'assetNames',
  'license-names': 'licenseNames'
};

export const lookupService = {
  async getLookup(type: string): Promise<LookupItem[]> {
    const table = lookupKeyMap[type] || type;

    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order('id', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error(`Error loading lookup ${type}:`, err);
      throw err;
    }
  },

  async getAllMasterData(): Promise<{ [key: string]: LookupItem[] }> {
    const types = Object.keys(lookupKeyMap);
    const result: { [key: string]: LookupItem[] } = {};
    
    for (const key of types) {
      const storageKey = localKeys[key];
      try {
        result[storageKey] = await this.getLookup(key);
      } catch (e) {
        console.error(`Error fetching master data for key ${key}:`, e);
        result[storageKey] = [];
      }
    }

    return result;
  },

  async addLookupItem(type: string, name: string): Promise<LookupItem> {
    const table = lookupKeyMap[type] || type;

    try {
      const { data, error } = await supabase
        .from(table)
        .insert([{ name }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err: any) {
      console.error(`Error adding lookup value in ${type}:`, err);
      throw err;
    }
  },

  async updateLookupItem(type: string, id: number, name: string): Promise<void> {
    const table = lookupKeyMap[type] || type;

    try {
      const { error } = await supabase
        .from(table)
        .update({ name })
        .eq('id', id);

      if (error) throw error;
    } catch (err: any) {
      console.error(`Error updating lookup ID ${id} in ${type}:`, err);
      throw err;
    }
  },

  async deleteLookupItem(type: string, id: number): Promise<void> {
    const table = lookupKeyMap[type] || type;

    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (err: any) {
      console.error(`Error deleting lookup ID ${id} in ${type}:`, err);
      throw err;
    }
  }
};
