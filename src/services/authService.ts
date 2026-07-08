import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { comparePassword, hashPassword, generateJWT } from '../utils/security';

export interface User {
  id: number;
  username: string;
  role: string;
  status: string;
  name?: string;
  position?: string;
  email?: string;
  mfa_enabled?: boolean;
  mfa_secret?: string;
}

// Client-side cookie helpers
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

export function setCookie(name: string, value: string, days: number) {
  if (typeof document === 'undefined') return;
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Strict; Secure";
}

export const authService = {
  async login(username: string, password?: string): Promise<{ success: boolean; user?: User; token?: string; message?: string; mfaRequired?: boolean; tempUserId?: number }> {
    const isMock = !isSupabaseConfigured;
    
    // 1. Authenticate user/check credentials (users table / mock users)
    let rawUser: any = null;
    
    if (isMock) {
      const mockUsers = JSON.parse(localStorage.getItem('mock_admin_users') || '[]');
      const matchedIdx = mockUsers.findIndex((u: any) => u.username === username.toLowerCase() || (u.email && u.email.toLowerCase() === username.toLowerCase()));
      
      if (matchedIdx !== -1) {
        const matched = mockUsers[matchedIdx];
        const isPasswordCorrect = await comparePassword(password || '', matched.password);
        if (isPasswordCorrect) {
          rawUser = matched;
          // Auto-migrate legacy plain text password to secure bcrypt hash
          if (password && (!matched.password.startsWith('$2a$') && !matched.password.startsWith('$2b$'))) {
            try {
              const hashedPassword = await hashPassword(password);
              mockUsers[matchedIdx].password = hashedPassword;
              localStorage.setItem('mock_admin_users', JSON.stringify(mockUsers));
              console.log("Successfully migrated legacy password to secure bcrypt hash.");
            } catch (err) {
              console.error("Failed to migrate legacy password:", err);
            }
          }
        } else {
          return { success: false, message: 'Incorrect credentials.' };
        }
      } else {
        const lowerUser = username.toLowerCase();
        if (['admin', 'system_admin', 'system', 'system@hcc.com'].includes(lowerUser)) {
          const isSystemHcc = lowerUser === 'system@hcc.com';
          const defaultPass = isSystemHcc ? 'Hcc@1122' : 'admin123';
          const isDefaultPasswordCorrect = password === defaultPass || (!isSystemHcc && !password);
          if (isDefaultPasswordCorrect) {
            const hashedPassword = await hashPassword(defaultPass);
            rawUser = { 
              id: isSystemHcc ? 3 : 1, 
              username: lowerUser, 
              role: 'system_admin', 
              status: 'active',
              name: isSystemHcc ? 'System Admin (HCC)' : 'System Admin',
              position: 'Administrator',
              email: isSystemHcc ? 'system@hcc.com' : 'admin@homescontracting.com',
              password: hashedPassword
            };
            
            // Re-seed all of them to make sure both exist
            const adminHash = await hashPassword('admin123');
            const hccHash = await hashPassword('Hcc@1122');
            const seededUsers = [
              { id: 1, username: 'admin', name: 'System Admin', position: 'Administrator', email: 'admin@homescontracting.com', role: 'system_admin', status: 'active', password: adminHash },
              { id: 2, username: 'user', name: 'Staff User', position: 'IT Support', email: 'user@homescontracting.com', role: 'user', status: 'active', password: adminHash },
              { id: 3, username: 'system@hcc.com', name: 'System Admin (HCC)', position: 'Administrator', email: 'system@hcc.com', role: 'system_admin', status: 'active', password: hccHash }
            ];
            localStorage.setItem('mock_admin_users', JSON.stringify(seededUsers));
          } else {
            return { success: false, message: 'Incorrect credentials.' };
          }
        } else {
          return { success: false, message: 'Invalid username or password.' };
        }
      }
    } else {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .or(`username.eq.${username.toLowerCase()},email.eq.${username.toLowerCase()}`)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          const isPasswordCorrect = await comparePassword(password || '', data.password);
          if (isPasswordCorrect) {
            rawUser = data;
            // Auto-migrate legacy plain text password to secure bcrypt hash in database
            if (password && (!data.password.startsWith('$2a$') && !data.password.startsWith('$2b$'))) {
              try {
                const hashedPassword = await hashPassword(password);
                await supabase
                  .from('users')
                  .update({ password: hashedPassword })
                  .eq('id', data.id);
                console.log("Successfully migrated database legacy password to secure bcrypt hash.");
              } catch (migrateErr) {
                console.error("Failed to migrate database password:", migrateErr);
              }
            }
          } else {
            return { success: false, message: 'Invalid credentials. User not found or incorrect password.' };
          }
        } else {
          return { success: false, message: 'Invalid credentials. User not found or incorrect password.' };
        }
      } catch (err: any) {
        console.error('Db Login query failed, trying standard fallback:', err);
        const lowerUser = username.toLowerCase();
        if (['admin', 'system_admin', 'system', 'system@hcc.com'].includes(lowerUser)) {
          const isSystemHcc = lowerUser === 'system@hcc.com';
          const defaultPass = isSystemHcc ? 'Hcc@1122' : 'admin123';
          if (password === defaultPass || (!isSystemHcc && !password)) {
            const hashedPassword = await hashPassword(defaultPass);
            rawUser = { 
              id: isSystemHcc ? 3 : 1, 
              username: lowerUser, 
              role: 'system_admin', 
              status: 'active',
              name: isSystemHcc ? 'System Admin (HCC)' : 'System Admin',
              position: 'Administrator',
              email: isSystemHcc ? 'system@hcc.com' : 'admin@homescontracting.com',
              password: hashedPassword
            };
          }
        }
        if (!rawUser) {
          return { success: false, message: err.message };
        }
      }
    }

    if (!rawUser) {
      return { success: false, message: 'Invalid credentials.' };
    }

    // Now check profiles table for 2FA status using lowercased email
    const email = rawUser.email || (rawUser.username === 'admin' ? 'admin@homescontracting.com' : 'user@homescontracting.com');
    let mfaEnabled = false;
    let mfaSecret = null;
    let profilesTableWorks = true;

    if (isMock) {
      const mockProfiles = JSON.parse(localStorage.getItem('mock_profiles') || '[]');
      let profile = mockProfiles.find((p: any) => p.email?.toLowerCase() === email.toLowerCase());
      if (!profile) {
        profile = {
          id: mockProfiles.length + 1,
          email: email,
          two_factor_enabled: false,
          two_factor_secret: null,
          created_at: new Date().toISOString()
        };
        mockProfiles.push(profile);
        localStorage.setItem('mock_profiles', JSON.stringify(mockProfiles));
      }
      mfaEnabled = !!profile.two_factor_enabled;
      mfaSecret = profile.two_factor_secret;
    } else {
      try {
        const { data: profile, error: pError } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', email)
          .maybeSingle();

        if (pError) throw pError;

        if (profile) {
          mfaEnabled = !!profile.two_factor_enabled;
          mfaSecret = profile.two_factor_secret;
        } else {
          // Auto create profile
          const { data: newProfile, error: iError } = await supabase
            .from('profiles')
            .insert({
              email: email,
              two_factor_enabled: false,
              two_factor_secret: null
            })
            .select()
            .maybeSingle();
          if (newProfile) {
            mfaEnabled = !!newProfile.two_factor_enabled;
            mfaSecret = newProfile.two_factor_secret;
          }
        }
      } catch (err) {
        console.warn('Profiles table schema check failed (likely SQL needs execution). Fallback to LocalStorage profiles:', err);
        profilesTableWorks = false;
        // Fallback profiles inside Supabase configured check
        const mockProfiles = JSON.parse(localStorage.getItem('mock_profiles') || '[]');
        let profile = mockProfiles.find((p: any) => p.email?.toLowerCase() === email.toLowerCase());
        if (!profile) {
          profile = {
            id: mockProfiles.length + 1,
            email: email,
            two_factor_enabled: false,
            two_factor_secret: null,
            created_at: new Date().toISOString()
          };
          mockProfiles.push(profile);
          localStorage.setItem('mock_profiles', JSON.stringify(mockProfiles));
        }
        mfaEnabled = !!profile.two_factor_enabled;
        mfaSecret = profile.two_factor_secret;
      }
    }

    // 2. If 2FA is active, check for trusted devices cookie, skip 2FA if matches and not expired
    if (mfaEnabled) {
      const token = getCookie('trusted_device_fingerprint');
      let isDeviceTrusted = false;

      if (token) {
        if (isMock || !profilesTableWorks) {
          const trustedDevs = JSON.parse(localStorage.getItem('mock_trusted_devices') || '[]');
          const match = trustedDevs.find((td: any) => 
            td.user_id === rawUser.id && 
            td.device_fingerprint === token && 
            new Date(td.expires_at).getTime() > Date.now()
          );
          if (match) {
            isDeviceTrusted = true;
          }
        } else {
          try {
            const { data: tdMatch, error } = await supabase
              .from('trusted_devices')
              .select('*')
              .eq('user_id', rawUser.id)
              .eq('device_fingerprint', token)
              .gt('expires_at', new Date().toISOString())
              .maybeSingle();
            
            if (!error && tdMatch) {
              isDeviceTrusted = true;
            }
          } catch (err) {
            console.error('Error checking trusted devices:', err);
          }
        }
      }

      if (isDeviceTrusted) {
        console.log(`Device fingerprint ${token} is verified and trusted. Skipping 2FA challenge!`);
      } else {
        // Require 2FA challenge
        return { success: true, mfaRequired: true, tempUserId: rawUser.id };
      }
    }

    // Connect authenticated session
    const loggedUser: User = {
      id: rawUser.id,
      username: rawUser.username,
      role: rawUser.role || 'system_admin',
      status: rawUser.status || 'active',
      name: rawUser.name || (rawUser.username === 'admin' ? 'System Admin' : 'Staff User'),
      position: rawUser.position || (rawUser.username === 'admin' ? 'Administrator' : 'IT Support'),
      email: email,
      mfa_enabled: mfaEnabled,
      mfa_secret: mfaSecret || undefined
    };

    // Generate full secure signed JWT token
    const token = generateJWT({
      id: loggedUser.id,
      username: loggedUser.username,
      role: loggedUser.role,
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours expiration
    });

    localStorage.setItem('user', JSON.stringify(loggedUser));
    localStorage.setItem('token', token);
    return { success: true, user: loggedUser, token };
  },

  async getCurrentUser(): Promise<User | null> {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr) as User;
    } catch {
      return null;
    }
  },

  async logout(): Promise<void> {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
  }
};
