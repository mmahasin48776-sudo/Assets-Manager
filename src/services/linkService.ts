import { supabase } from '../lib/supabase';

export interface LinkItem {
  id: number;
  title: string;
  url: string;
  description: string;
  created_at?: string;
}

export const linkService = {
  async getLinks(): Promise<LinkItem[]> {
    try {
      const { data, error } = await supabase
        .from('links')
        .select('*')
        .order('id', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err: any) {
      console.error('Error fetching links from Supabase:', err);
      throw err;
    }
  },

  async addLink(link: Partial<LinkItem>): Promise<LinkItem> {
    const payload = {
      ...link,
      created_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabase
        .from('links')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err: any) {
      console.error('Error creating link on Supabase:', err);
      throw err;
    }
  },

  async updateLink(id: number, link: Partial<LinkItem>): Promise<void> {
    try {
      const { error } = await supabase
        .from('links')
        .update(link)
        .eq('id', id);

      if (error) throw error;
    } catch (err: any) {
      console.error('Error updating link on Supabase:', err);
      throw err;
    }
  },

  async deleteLink(id: number): Promise<void> {
    try {
      const { error } = await supabase
        .from('links')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (err: any) {
      console.error('Error deleting link from Supabase:', err);
      throw err;
    }
  }
};
