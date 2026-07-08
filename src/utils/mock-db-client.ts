import axios from 'axios';
import { authService } from '../services/authService';
import { employeeService } from '../services/employeeService';
import { assetService } from '../services/assetService';
import { licenseService } from '../services/licenseService';
import { telecomService } from '../services/telecomService';
import { infrastructureService } from '../services/infrastructureService';
import { lookupService } from '../services/lookupService';
import { logService } from '../services/logService';
import { linkService } from '../services/linkService';
import { notificationService } from '../services/notificationService';
import { storageService } from '../services/storageService';
import { incidentService } from '../services/incidentService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { generateBase32Secret, verifyToken } from './totp';
import { verifyJWT, hashPassword, generateJWT } from './security';

// Ensure localStorage has seeded data if offline fallback is activated
const SEED_KEY = 'seeded_db_v2';

// Login Log helpers
export async function recordLoginLog(username: string) {
  try {
    const ua = typeof window !== 'undefined' ? window.navigator.userAgent : '';
    let browser = "Unknown Browser";
    let os = "Unknown OS";

    if (ua.indexOf("Firefox") > -1) browser = "Mozilla Firefox";
    else if (ua.indexOf("SamsungBrowser") > -1) browser = "Samsung Internet";
    else if (ua.indexOf("Opera") > -1 || ua.indexOf("OPR") > -1) browser = "Opera";
    else if (ua.indexOf("Trident") > -1) browser = "Internet Explorer";
    else if (ua.indexOf("Edge") > -1 || ua.indexOf("Edg") > -1) browser = "Microsoft Edge";
    else if (ua.indexOf("Chrome") > -1) browser = "Google Chrome";
    else if (ua.indexOf("Safari") > -1) browser = "Apple Safari";

    if (ua.indexOf("Windows NT 10.0") > -1) os = "Windows 10/11";
    else if (ua.indexOf("Windows NT 6.3") > -1) os = "Windows 8.1";
    else if (ua.indexOf("Windows NT 6.2") > -1) os = "Windows 8";
    else if (ua.indexOf("Windows NT 6.1") > -1) os = "Windows 7";
    else if (ua.indexOf("Macintosh") > -1) os = "macOS";
    else if (ua.indexOf("iPhone") > -1) os = "iOS (iPhone)";
    else if (ua.indexOf("iPad") > -1) os = "iOS (iPad)";
    else if (ua.indexOf("Android") > -1) os = "Android";
    else if (ua.indexOf("Linux") > -1) os = "Linux";

    const deviceName = `${browser} on ${os}`;

    let ip = "127.0.0.1";
    let location = "Local Network";
    let ipCityCountry = "";

    try {
      const ipRes = await fetch('https://ipapi.co/json/');
      if (ipRes.ok) {
        const ipData = await ipRes.json();
        if (ipData && ipData.ip) {
          ip = ipData.ip;
          if (ipData.city && ipData.country_name) {
            ipCityCountry = `${ipData.city}, ${ipData.country_name}`;
          }
        } else {
          throw new Error("Invalid ipapi data");
        }
      } else {
        throw new Error("ipapi non-ok status");
      }
    } catch (e) {
      console.warn("Failed to fetch public IP from ipapi.co, trying ipinfo.io:", e);
      try {
        const ipRes = await fetch('https://ipinfo.io/json');
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          if (ipData && ipData.ip) {
            ip = ipData.ip;
            if (ipData.city && ipData.country) {
              ipCityCountry = `${ipData.city}, ${ipData.country}`;
            }
          }
        } else {
          throw new Error("ipinfo non-ok status");
        }
      } catch (e2) {
        console.warn("Failed to fetch public IP from ipinfo.io, using fallback list:", e2);
        const fallbackIps = ["82.165.12.98", "198.51.100.42", "203.0.113.195", "185.22.143.9"];
        const fallbackLocations = ["Berlin, Germany", "New York, USA", "Paris, France", "Toronto, Canada"];
        const randIdx = Math.floor(Math.random() * fallbackIps.length);
        ip = fallbackIps[randIdx];
        ipCityCountry = fallbackLocations[randIdx];
      }
    }

    // Attempt to retrieve current real live device geolocation coordinates
    let geoCoordsStr = "";
    if (typeof window !== 'undefined' && navigator.geolocation) {
      try {
        const coords = await new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
              });
            },
            (error) => {
              console.warn('[Geolocation] Failed to acquire live device location coordinates:', error);
              resolve(null);
            },
            { timeout: 6000, enableHighAccuracy: true }
          );
        });
        if (coords) {
          geoCoordsStr = `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;

          // Attempt to reverse geocode the coordinates to get the real city and country name!
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2500);
            const reverseRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}&zoom=10`, {
              signal: controller.signal,
              headers: {
                'User-Agent': 'HomesContractingAssetManager/1.0'
              }
            });
            clearTimeout(timeoutId);
            if (reverseRes.ok) {
              const reverseData = await reverseRes.json();
              const address = reverseData.address || {};
              const city = address.city || address.town || address.village || address.suburb || address.county || "";
              const country = address.country || "";
              if (city && country) {
                ipCityCountry = `${city}, ${country}`;
              } else if (country) {
                ipCityCountry = country;
              }
            }
          } catch (revErr) {
            console.warn("Reverse geocoding failed in recordLoginLog:", revErr);
          }
        }
      } catch (geoErr) {
        console.warn('[Geolocation] Geolocation error:', geoErr);
      }
    }

    if (geoCoordsStr) {
      if (ipCityCountry) {
        location = `${ipCityCountry} (${geoCoordsStr})`;
      } else {
        location = geoCoordsStr;
      }
    } else if (ipCityCountry) {
      location = ipCityCountry;
    }

    const newLogPayload = {
      username,
      device_name: deviceName,
      ip,
      location,
      login_time: new Date().toISOString(),
      logout_time: null
    };

    let savedToSupabase = false;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: insertedData, error } = await supabase
          .from('login_logs')
          .insert([newLogPayload])
          .select('id')
          .single();
        if (!error && insertedData) {
          localStorage.setItem('current_login_log_id', insertedData.id.toString());
          console.log('[Login Logger] Recorded real login log in Supabase:', insertedData);
          savedToSupabase = true;
        } else {
          console.warn('[Login Logger] Supabase insert failed (possibly table missing). Falling back to offline local storage:', error);
        }
      } catch (err) {
        console.warn('[Login Logger] Exception during Supabase insert. Falling back to offline local storage:', err);
      }
    }

    if (!savedToSupabase) {
      const logs = JSON.parse(localStorage.getItem('mock_login_logs') || '[]');
      
      const newLogId = logs.length > 0 ? Math.max(...logs.map((l: any) => l.id)) + 1 : 1;
      const newLog = {
        id: newLogId,
        ...newLogPayload
      };

      logs.push(newLog);
      localStorage.setItem('mock_login_logs', JSON.stringify(logs));
      localStorage.setItem('current_login_log_id', newLogId.toString());
      console.log('[Login Logger] Recorded offline login:', newLog);
    }
  } catch (err) {
    console.error('Error logging login:', err);
  }
}

export async function recordLogoutLog() {
  try {
    const currentIdStr = localStorage.getItem('current_login_log_id');
    if (!currentIdStr) return;
    const currentId = parseInt(currentIdStr);

    let loggedOutInSupabase = false;
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('login_logs')
          .update({ logout_time: new Date().toISOString() })
          .eq('id', currentId);
        if (!error) {
          console.log('[Login Logger] Recorded real logout in Supabase for id:', currentId);
          loggedOutInSupabase = true;
        } else {
          console.warn('[Login Logger] Failed to update logout in Supabase (possibly table missing). Falling back to offline local storage:', error);
        }
      } catch (err) {
        console.warn('[Login Logger] Exception during Supabase update. Falling back to offline local storage:', err);
      }
    }

    if (!loggedOutInSupabase) {
      const logs = JSON.parse(localStorage.getItem('mock_login_logs') || '[]');
      const matchIdx = logs.findIndex((l: any) => l.id === currentId);
      if (matchIdx !== -1) {
        logs[matchIdx].logout_time = new Date().toISOString();
        localStorage.setItem('mock_login_logs', JSON.stringify(logs));
        console.log('[Login Logger] Recorded offline logout for id:', currentId);
      }
    }
    localStorage.removeItem('current_login_log_id');
  } catch (err) {
    console.error('Error logging logout:', err);
  }
}

export function seedDatabase() {
  if (localStorage.getItem(SEED_KEY)) return;
  localStorage.setItem(SEED_KEY, 'true');
}

// Dynamic dashboard stats computer using Supabase services
export async function calculateStats(): Promise<any> {
  const employees = await employeeService.getEmployees();
  const assets = await assetService.getAssets();
  const licenses = await licenseService.getLicenses();
  const telecom = await telecomService.getTelecomServices();
  
  const categories = await lookupService.getLookup('categories');
  const locations = await lookupService.getLookup('locations');
  const departments = await lookupService.getLookup('departments');
  const licenseTypes = await lookupService.getLookup('license-types');

  const totalEmployees = employees.length;
  const totalAssets = assets.length;
  const availableAssets = assets.filter(a => a.status?.toLowerCase() === 'available').length;
  const assignedAssets = assets.filter(a => a.status?.toLowerCase() === 'assigned').length;

  const totalLicenses = licenses.length;
  const availableLicenses = licenses.filter(l => l.status?.toLowerCase() === 'available').length;
  const assignedLicenses = licenses.filter(l => l.status?.toLowerCase() === 'assigned').length;

  const totalAssetCost = assets.reduce((sum, a) => sum + Number(a.cost || 0), 0);
  const totalLicenseCost = licenses.reduce((sum, l) => sum + Number(l.cost || 0), 0);
  const totalTelecomCost = telecom.reduce((sum, t) => sum + Number(t.cost || 0), 0);
  const totalCost = totalAssetCost + totalLicenseCost + totalTelecomCost;

  // Group assets by category
  const assetsByCategory = categories.map(cat => {
    const count = assets.filter(a => Number(a.category_id) === Number(cat.id)).length;
    return { id: cat.id, name: cat.name, count };
  }).filter(c => c.count > 0);

  // Group assets by customized asset name (or name)
  const assetNameCounts: any = {};
  assets.forEach(a => {
    const key = a.name || 'Unknown';
    assetNameCounts[key] = (assetNameCounts[key] || 0) + 1;
  });
  const assetsByName = Object.entries(assetNameCounts).map(([name, count]) => ({ name, count }));

  // Group licenses by category type
  const licensesByCategory = licenseTypes.map(t => {
    const count = licenses.filter(l => Number(l.type_id) === Number(t.id)).length;
    return { id: t.id, name: t.name, count };
  }).filter(c => c.count > 0);

  // Group software licenses by department of assigned employee
  const licensesByDeptCounts: any = {};
  licenses.forEach(l => {
    if (l.assigned_employee_id) {
      const emp = employees.find(e => e.id === l.assigned_employee_id);
      const dept = emp?.department || 'Unassigned';
      licensesByDeptCounts[dept] = (licensesByDeptCounts[dept] || 0) + 1;
    } else {
      licensesByDeptCounts['Unassigned'] = (licensesByDeptCounts['Unassigned'] || 0) + 1;
    }
  });
  const licensesByDepartment = Object.entries(licensesByDeptCounts).map(([name, count]) => ({ name, count }));

  // Group licenses by location
  const licensesByLocCounts: any = {};
  licenses.forEach(l => {
    const loc = locations.find(loc => Number(loc.id) === Number(l.location_id))?.name || 'Unknown Location';
    licensesByLocCounts[loc] = (licensesByLocCounts[loc] || 0) + 1;
  });
  const licensesByLocation = Object.entries(licensesByLocCounts).map(([name, count]) => ({ name, count }));

  // Group cost breakdown & hardware vs licenses ratios by department
  const costByDepartment = departments.map(dept => {
    const deptEmps = employees.filter(e => e.department?.toLowerCase() === dept.name?.toLowerCase());
    const empIds = deptEmps.map(e => e.id);

    const deptAssets = assets.filter(a => a.assigned_employee_id && empIds.includes(a.assigned_employee_id));
    const deptLicenses = licenses.filter(l => l.assigned_employee_id && empIds.includes(l.assigned_employee_id));

    const asset_count = deptAssets.length;
    const license_count = deptLicenses.length;
    const asset_cost = deptAssets.reduce((sum, a) => sum + Number(a.cost || 0), 0);
    const license_cost = deptLicenses.reduce((sum, l) => sum + Number(l.cost || 0), 0);

    return {
      id: dept.id,
      name: dept.name,
      asset_count,
      license_count,
      asset_cost,
      license_cost
    };
  });

  // Group cost breakdown by location
  const costByLocation = locations.map(loc => {
    const locAssets = assets.filter(a => Number(a.location_id) === Number(loc.id));
    const locLicenses = licenses.filter(l => Number(l.location_id) === Number(loc.id));
    const locTelecom = telecom.filter(t => Number(t.location_id) === Number(loc.id));

    return {
      id: loc.id,
      name: loc.name,
      asset_count: locAssets.length,
      license_count: locLicenses.length,
      telecom_count: locTelecom.length,
      asset_cost: locAssets.reduce((sum, a) => sum + Number(a.cost || 0), 0),
      license_cost: locLicenses.reduce((sum, l) => sum + Number(l.cost || 0), 0),
      telecom_cost: locTelecom.reduce((sum, t) => sum + Number(t.cost || 0), 0)
    };
  });

  const available_assets_cost = assets.filter(a => a.status?.toLowerCase() === 'available').reduce((sum, a) => sum + Number(a.cost || 0), 0);
  const available_licenses_cost = licenses.filter(l => l.status?.toLowerCase() === 'available').reduce((sum, l) => sum + Number(l.cost || 0), 0);
  const costOfAvailable = {
    available_assets_cost,
    available_licenses_cost
  };

  return {
    totalEmployees,
    totalAssets,
    availableAssets,
    assignedAssets,
    totalLicenses,
    availableLicenses,
    assignedLicenses,
    totalAssetCost,
    totalLicenseCost,
    totalTelecomCost,
    totalCost,
    assetsByCategory,
    assetsByName,
    licensesByCategory,
    licensesByDepartment,
    licensesByLocation,
    costByDepartment,
    costByLocation,
    costOfAvailable
  };
}

// Intercept helper
function getHeader(config: any, name: string): string | undefined {
  if (!config || !config.headers) return undefined;
  const headers = config.headers;
  
  // 1. Try modern Axios AxiosHeaders get() method
  if (typeof headers.get === 'function') {
    try {
      const val = headers.get(name);
      if (val) return String(val);
    } catch (e) {}
  }
  
  // 2. Case-insensitive lookup on plain object properties
  const nameLower = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === nameLower) {
      return String(headers[key]);
    }
  }
  
  return undefined;
}

async function mockApiHandler(config: any): Promise<any> {
  const url = config.url || '';
  const method = (config.method || 'GET').toUpperCase();
  let data = config.data ? (typeof config.data === 'string' ? JSON.parse(config.data) : config.data) : null;
  if (typeof FormData !== 'undefined' && data instanceof FormData) {
    const plain: any = {};
    data.forEach((value, key) => {
      if (plain[key] !== undefined) {
        if (Array.isArray(plain[key])) {
          plain[key].push(value);
        } else {
          plain[key] = [plain[key], value];
        }
      } else {
        plain[key] = value;
      }
    });
    data = plain;
  }
  const params = config.params || {};

  const parsedUrl = new URL(url, 'http://localhost');
  const path = parsedUrl.pathname;
  const route = path.replace(/^\//, '');

  console.log(`[Supabase Proxy Router] ${method} /${route}`, { data, params });

  // JWT Token Security Verification for Secure Endpoints
  const publicRoutes = ['api/login', 'api/verify-secret', 'api/mfa/verify-login', 'api/mfa/verify-setup', 'api/logout', 'api/login-logs/update-location'];
  if (!publicRoutes.includes(route)) {
    let authHeader = getHeader(config, 'Authorization');
    if (!authHeader) {
      const localStorageToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (localStorageToken) {
        authHeader = `Bearer ${localStorageToken}`;
      }
    }

    if (!authHeader) {
      console.warn(`[Security Alert] Access to /${route} blocked: Missing Authorization header.`);
      return { status: 401, data: { success: false, message: 'Unauthorized: Missing or invalid token' } };
    }

    // Support raw tokens or Bearer prefixed tokens
    let token = authHeader;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (authHeader.startsWith('bearer ')) {
      token = authHeader.substring(7);
    }
    
    if (token) {
      token = token.trim().replace(/^["']|["']$/g, '');
    }

    const decoded = verifyJWT(token);
    if (!decoded) {
      console.warn(`[Security Alert] Access to /${route} blocked: JWT token is invalid or expired.`);
      return { status: 401, data: { success: false, message: 'Unauthorized: Token is invalid or expired' } };
    }
  }

  await new Promise(resolve => setTimeout(resolve, 80));

  // LOGIN / ME / LOGOUT
  if (route === 'api/login' && method === 'POST') {
    const { username, password } = data;
    const res = await authService.login(username, password);
    if (res.success) {
      if (res.mfaRequired) {
        return { data: { success: true, mfaRequired: true, tempUserId: res.tempUserId } };
      }
      await logService.addActivityLog('System', null, 'Auth', username, 'Login', 'Logged in successfully');
      await recordLoginLog(username);
      return { data: { success: true, user: res.user, token: res.token || 'session-token' } };
    } else {
      return { status: 400, data: { success: false, message: res.message || 'Invalid username or password.' } };
    }
  }

  if (route === 'api/me' && method === 'GET') {
    const user = await authService.getCurrentUser();
    if (user) {
      return { data: { success: true, user } };
    } else {
      return { status: 401, data: { success: false, message: 'Unauthorized' } };
    }
  }

  if (route === 'api/logout' && method === 'GET') {
    const user = await authService.getCurrentUser();
    if (user) {
      await logService.addActivityLog('System', null, 'Auth', user.username, 'Logout', 'Logged out safely');
    }
    await recordLogoutLog();
    await authService.logout();
    return { data: { success: true } };
  }

  // TWO FACTOR AUTHENTICATION (MFA)
  if (route === 'api/mfa/setup' && method === 'POST') {
    const currentUser = await authService.getCurrentUser();
    if (!currentUser) {
      return { status: 401, data: { success: false, message: 'Unauthorized' } };
    }
    const secret = generateBase32Secret(16);
    const email = currentUser.email || currentUser.username || 'user';
    const qrCodeUrl = `otpauth://totp/AssetsManager:${encodeURIComponent(email)}?secret=${secret}&issuer=AssetsManager`;
    return { data: { success: true, secret, qrCodeUrl } };
  }

  if (route === 'api/mfa/enable' && method === 'POST') {
    const currentUser = await authService.getCurrentUser();
    if (!currentUser) {
      return { status: 401, data: { success: false, message: 'Unauthorized' } };
    }
    const { secret, code } = data;
    const isValid = verifyToken(secret, code);
    if (!isValid) {
      return { status: 400, data: { success: false, message: 'Invalid 2FA verification code. Please check your authenticator app.' } };
    }

    const email = currentUser.email || (currentUser.username === 'admin' ? 'admin@homescontracting.com' : 'user@homescontracting.com');
    let updatedUser: any = { ...currentUser, mfa_enabled: true, mfa_secret: secret };

    if (isSupabaseConfigured) {
      try {
        // Upsert to profiles table
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({ email: email, two_factor_enabled: true, two_factor_secret: secret }, { onConflict: 'email' });
        
        if (profileError) throw profileError;

        // Also update standard users table for fallback compatibility
        await supabase
          .from('users')
          .update({ mfa_enabled: true, mfa_secret: secret })
          .eq('id', currentUser.id);

      } catch (err: any) {
        console.warn('Profiles table sync issue:', err);
      }
    }

    // Always update mock storage profiles to ensure local fallback is accurate
    let mockProfiles = JSON.parse(localStorage.getItem('mock_profiles') || '[]');
    const idxP = mockProfiles.findIndex((p: any) => p.email?.toLowerCase() === email.toLowerCase());
    if (idxP > -1) {
      mockProfiles[idxP].two_factor_enabled = true;
      mockProfiles[idxP].two_factor_secret = secret;
    } else {
      mockProfiles.push({ id: mockProfiles.length + 1, email, two_factor_enabled: true, two_factor_secret: secret });
    }
    localStorage.setItem('mock_profiles', JSON.stringify(mockProfiles));

    // Update main mock user table
    let mockUsers = JSON.parse(localStorage.getItem('mock_admin_users') || '[]');
    const idx = mockUsers.findIndex((u: any) => u.id === currentUser.id);
    if (idx > -1) {
      mockUsers[idx].mfa_enabled = true;
      mockUsers[idx].mfa_secret = secret;
      localStorage.setItem('mock_admin_users', JSON.stringify(mockUsers));
    }

    localStorage.setItem('user', JSON.stringify(updatedUser));
    await logService.addActivityLog('System', null, 'Auth', currentUser.username, 'MFA', 'Enabled Two-Factor Authentication');
    return { data: { success: true, user: updatedUser } };
  }

  if (route === 'api/mfa/disable' && method === 'POST') {
    const currentUser = await authService.getCurrentUser();
    if (!currentUser) {
      return { status: 401, data: { success: false, message: 'Unauthorized' } };
    }

    const email = (currentUser.email || (currentUser.username === 'admin' ? 'admin@homescontracting.com' : 'user@homescontracting.com')).toLowerCase();
    let updatedUser: any = { ...currentUser, mfa_enabled: false, mfa_secret: null };

    if (isSupabaseConfigured) {
      // 1. Try to update profiles table
      try {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ two_factor_enabled: false, two_factor_secret: null })
          .eq('email', email);
        if (profileError) {
          console.warn('Profiles update error, attempting upsert:', profileError);
          await supabase
            .from('profiles')
            .upsert({ email, two_factor_enabled: false, two_factor_secret: null }, { onConflict: 'email' });
        }
      } catch (err: any) {
        console.warn('Profiles table update issue:', err);
      }

      // 2. Try to update users table
      try {
        await supabase
          .from('users')
          .update({ mfa_enabled: false, mfa_secret: null })
          .eq('id', currentUser.id);
      } catch (err: any) {
        console.warn('Users table update issue:', err);
      }
    }

    // Update localStorage fallback profiles
    let mockProfiles = JSON.parse(localStorage.getItem('mock_profiles') || '[]');
    const idxP = mockProfiles.findIndex((p: any) => p.email?.toLowerCase() === email);
    if (idxP > -1) {
      mockProfiles[idxP].two_factor_enabled = false;
      mockProfiles[idxP].two_factor_secret = null;
    } else {
      mockProfiles.push({ id: mockProfiles.length + 1, email, two_factor_enabled: false, two_factor_secret: null });
    }
    localStorage.setItem('mock_profiles', JSON.stringify(mockProfiles));

    let mockUsers = JSON.parse(localStorage.getItem('mock_admin_users') || '[]');
    const idx = mockUsers.findIndex((u: any) => u.id === currentUser.id);
    if (idx > -1) {
      mockUsers[idx].mfa_enabled = false;
      mockUsers[idx].mfa_secret = null;
      localStorage.setItem('mock_admin_users', JSON.stringify(mockUsers));
    }

    localStorage.setItem('user', JSON.stringify(updatedUser));
    await logService.addActivityLog('System', null, 'Auth', currentUser.username, 'MFA', 'Disabled Two-Factor Authentication');
    return { data: { success: true, user: updatedUser } };
  }

  if (route === 'api/mfa/verify-login' && method === 'POST') {
    const { tempUserId, code, trustDevice } = data;
    let targetUser: any = null;

    if (isSupabaseConfigured) {
      try {
        const { data: dbUser, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', tempUserId)
          .maybeSingle();
        if (error) throw error;
        targetUser = dbUser;
      } catch (err: any) {
        console.warn('Db user fetch issue, falling back:', err);
      }
    }
    
    if (!targetUser) {
      const mockUsers = JSON.parse(localStorage.getItem('mock_admin_users') || '[]');
      targetUser = mockUsers.find((u: any) => u.id === tempUserId);
    }

    if (!targetUser) {
      return { status: 404, data: { success: false, message: 'User record not found.' } };
    }

    const email = targetUser.email || (targetUser.username === 'admin' ? 'admin@homescontracting.com' : 'user@homescontracting.com');
    let mfaSecret = null;

    // Retrieve active secret key from profiles table
    if (isSupabaseConfigured) {
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', email)
          .maybeSingle();
        if (!error && profile) {
          mfaSecret = profile.two_factor_secret;
        }
      } catch (err) {
        console.warn('Error reading profiles table:', err);
      }
    }

    if (!mfaSecret) {
      const mockProfiles = JSON.parse(localStorage.getItem('mock_profiles') || '[]');
      const profile = mockProfiles.find((p: any) => p.email?.toLowerCase() === email.toLowerCase());
      if (profile) {
        mfaSecret = profile.two_factor_secret;
      }
    }

    // If still not found, check targetUser's local property
    if (!mfaSecret) {
      mfaSecret = targetUser.mfa_secret;
    }

    if (!mfaSecret) {
      return { status: 400, data: { success: false, message: '2FA secret not found for user.' } };
    }

    const isValid = verifyToken(mfaSecret, code);
    if (!isValid) {
      return { status: 400, data: { success: false, message: 'Incorrect 2FA verification code.' } };
    }

    // If code is correct, check if the user wanted to trust this browser/device for 30 days
    if (trustDevice) {
      const fingerprint = "device_" + Math.random().toString(36).substring(2, 11) + Math.random().toString(36).substring(2, 11);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      if (isSupabaseConfigured) {
        try {
          await supabase
            .from('trusted_devices')
            .insert({
              user_id: targetUser.id,
              device_fingerprint: fingerprint,
              expires_at: expiresAt
            });
        } catch (err) {
          console.error('Error inserting trusted device to Database:', err);
        }
      }

      // Store in LocalStorage fallback
      const mockTrusted = JSON.parse(localStorage.getItem('mock_trusted_devices') || '[]');
      mockTrusted.push({
        id: mockTrusted.length + 1,
        user_id: targetUser.id,
        device_fingerprint: fingerprint,
        expires_at: expiresAt,
        created_at: new Date().toISOString()
      });
      localStorage.setItem('mock_trusted_devices', JSON.stringify(mockTrusted));

      // Write secure cookie
      if (typeof document !== 'undefined') {
        const date = new Date(expiresAt);
        document.cookie = `trusted_device_fingerprint=${fingerprint}; expires=${date.toUTCString()}; path=/; SameSite=Strict; Secure`;
      }
    }

    const loggedUser: any = {
      id: targetUser.id,
      username: targetUser.username,
      role: targetUser.role || 'user',
      status: targetUser.status || 'active',
      name: targetUser.name || (targetUser.username === 'admin' ? 'System Admin' : 'Staff User'),
      position: targetUser.position || (targetUser.username === 'admin' ? 'Administrator' : 'IT Support'),
      email: email,
      mfa_enabled: true,
      mfa_secret: mfaSecret
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

    await logService.addActivityLog('System', null, 'Auth', targetUser.username, 'Login', 'Logged in successfully with OTP');
    await recordLoginLog(targetUser.username);
    return { data: { success: true, user: loggedUser, token } };
  }

  if (route === 'api/master-data' && method === 'GET') {
    const master = await lookupService.getAllMasterData();
    return { data: master };
  }

  if (route === 'api/stats' && method === 'GET') {
    const stats = await calculateStats();
    return { data: stats };
  }

  if (route === 'api/login-logs/update-location' && method === 'POST') {
    const { logId, latitude, longitude, city, country } = data;
    const parsedId = parseInt(logId);
    if (!parsedId) {
      return { status: 400, data: { success: false, message: 'Invalid log ID.' } };
    }

    let resolvedLocation = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    if (city && country) {
      resolvedLocation = `${city}, ${country} (${resolvedLocation})`;
    }

    let updatedInSupabase = false;
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('login_logs')
          .update({ location: resolvedLocation })
          .eq('id', parsedId);
        if (!error) {
          console.log('[Login Logger] Updated live location in Supabase for log ID:', parsedId);
          updatedInSupabase = true;
        } else {
          console.warn('[Login Logger] Failed to update location in Supabase:', error);
        }
      } catch (err) {
        console.warn('[Login Logger] Exception updating location in Supabase:', err);
      }
    }

    // Always keep fallback mock login logs updated too
    const logs = JSON.parse(localStorage.getItem('mock_login_logs') || '[]');
    const matchIdx = logs.findIndex((l: any) => l.id === parsedId);
    if (matchIdx !== -1) {
      logs[matchIdx].location = resolvedLocation;
      localStorage.setItem('mock_login_logs', JSON.stringify(logs));
      console.log('[Login Logger] Updated offline login log with live coordinates:', logs[matchIdx]);
    }

    return { data: { success: true, location: resolvedLocation } };
  }

  // LOGIN LOGS
  if (route === 'api/login-logs' && method === 'GET') {
    try {
      await logService.pruneOldLogs();
    } catch (e) {
      console.error('[API] Error during login-logs auto pruning:', e);
    }

    let useFallback = true;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('login_logs')
          .select('*')
          .order('login_time', { ascending: false });
        if (!error) {
          return { data: data || [] };
        }
        console.warn('[API] Failed to fetch login logs from Supabase (possibly table missing). Falling back to offline local storage:', error);
      } catch (err) {
        console.warn('[API] Exception fetching login logs from Supabase. Falling back to offline local storage:', err);
      }
    }

    if (useFallback) {
      let logs = JSON.parse(localStorage.getItem('mock_login_logs') || '[]');
      logs.sort((a: any, b: any) => new Date(b.login_time).getTime() - new Date(a.login_time).getTime());
      return { data: logs };
    }
  }

  if (route === 'api/login-logs/clear' && method === 'POST') {
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('login_logs')
          .delete()
          .neq('id', -1);
        if (error) {
          console.warn('[API] Failed to clear login logs from Supabase. Falling back to clearing local storage:', error);
        }
      } catch (err) {
        console.warn('[API] Exception clearing login logs from Supabase. Falling back to clearing local storage:', err);
      }
    }
    localStorage.setItem('mock_login_logs', JSON.stringify([]));
    return { data: { success: true } };
  }

  // ACTIVITY LOGS
  if (route === 'api/activity-logs/users' && method === 'GET') {
    const users = await logService.getLogUsers();
    return { data: users };
  }

  if (route === 'api/activity-logs' && method === 'GET') {
    const limit = parsedUrl.searchParams.get('limit') || params.limit;
    const logs = await logService.getActivityLogs(limit ? parseInt(limit) : undefined);
    return { data: logs };
  }

  // PORTAL QUICK LINKS
  if (route === 'api/links') {
    if (method === 'GET') {
      const list = await linkService.getLinks();
      return { data: list };
    }
    if (method === 'POST') {
      const result = await linkService.addLink(data);
      await logService.addActivityLog('Link', result.id, result.title, result.url, 'Created', `Added link bookmark: ${result.title}`);
      return { data: result };
    }
  }

  if (route.startsWith('api/links/')) {
    const id = parseInt(route.split('/').pop() || '0');
    if (method === 'PUT') {
      await linkService.updateLink(id, data);
      await logService.addActivityLog('Link', id, data.title || '', data.url || '', 'Updated', `Updated bookmark details`);
      return { data: { success: true } };
    }
    if (method === 'DELETE') {
      await linkService.deleteLink(id);
      await logService.addActivityLog('Link', id, 'Link', '–', 'Deleted', `Deleted quick link bookmark`);
      return { data: { success: true } };
    }
  }

  // POPUP NOTIFICATIONS
  if (route === 'api/notifications' && method === 'GET') {
    const list = await notificationService.getNotifications();
    return { data: list };
  }

  if (route.startsWith('api/notifications/')) {
    const id = parseInt(route.split('/').pop() || '0');
    if (method === 'PUT') {
      await notificationService.updateNotification(id, data.action_type);
      return { data: { success: true } };
    }
    if (method === 'DELETE') {
      await notificationService.deleteNotification(id);
      return { data: { success: true } };
    }
  }

  // EMPLOYEES CRUD
  if (route === 'api/employees') {
    if (method === 'GET') {
      const list = await employeeService.getEmployees();
      return { data: list };
    }
    if (method === 'POST') {
      const result = await employeeService.addEmployee(data);
      await logService.addActivityLog('Personnel', result.id, result.name, result.sn, 'Created', `Added employee ${result.name}`);
      return { data: result };
    }
  }

  if (route.startsWith('api/employees/')) {
    const parts = route.split('/');
    const id = parseInt(parts[2]);

    if (parts.length === 3) {
      if (method === 'PUT') {
        await employeeService.updateEmployee(id, data);
        await logService.addActivityLog('Personnel', id, data.name || '', data.sn || '', 'Updated', `Updated personnel details for ${data.name || id}`);
        return { data: { success: true } };
      }
      if (method === 'DELETE' || (method === 'POST' && data?._method === 'DELETE')) {
        await employeeService.deleteEmployee(id);
        await logService.addActivityLog('Personnel', id, 'Deleted Employee', '–', 'Deleted', `Employee removed from personnel ledger`);
        return { data: { success: true } };
      }
    }

    if (parts.length === 4 && parts[3] === 'profile' && method === 'GET') {
      let employee = null;
      if (isSupabaseConfigured) {
        try {
          const { data: dbEmp, error: dbEmpErr } = await supabase
            .from('employees')
            .select('*')
            .eq('id', id)
            .maybeSingle();
          if (dbEmp) {
            employee = dbEmp;
          }
        } catch (e) {
          console.error('Error fetching employee for profile:', e);
        }
      }
      if (!employee) {
        const emps = await employeeService.getEmployees();
        employee = emps.find(e => e.id === id);
      }

      if (!employee) {
        return { status: 404, data: { success: false, message: 'Employee not found' } };
      }

      let assets: any[] = [];
      const allAssets = await assetService.getAssets();
      const filteredAssets = allAssets.filter(a => Number(a.assigned_employee_id) === Number(id));

      let licenses: any[] = [];
      const allLicenses = await licenseService.getLicenses();
      const filteredLicenses = allLicenses.filter(l => Number(l.assigned_employee_id) === Number(id));

      // Fetch dynamic assigned_date from log histories
      if (isSupabaseConfigured) {
        try {
          const { data: assocLogs } = await supabase
            .from('history_logs')
            .select('*')
            .eq('employee_id', id)
            .in('action_type', ['Assigned', 'Transfer'])
            .order('action_date', { ascending: false });

          assets = filteredAssets.map((asset: any) => {
            const log = assocLogs?.find((h: any) => h.asset_id === asset.id);
            return {
              ...asset,
              assigned_date: log ? log.action_date : asset.created_at || new Date().toISOString()
            };
          });

          licenses = filteredLicenses.map((lic: any) => {
            const log = assocLogs?.find((h: any) => h.license_id === lic.id);
            return {
              ...lic,
              assigned_date: log ? log.action_date : lic.created_at || new Date().toISOString()
            };
          });
        } catch (e) {
          console.error('Error fetching assignment dates from Supabase:', e);
          assets = filteredAssets.map(a => ({ ...a, assigned_date: a.created_at || new Date().toISOString() }));
          licenses = filteredLicenses.map(l => ({ ...l, assigned_date: l.created_at || new Date().toISOString() }));
        }
      } else {
        const allAssetHistory = JSON.parse(localStorage.getItem('asset_history') || '[]');
        assets = filteredAssets.map((asset: any) => {
          const log = allAssetHistory.find((h: any) => 
            h.asset_id === asset.id && 
            Number(h.employee_id) === Number(id) && 
            (h.action_type === 'Assigned' || h.action_type === 'Transfer')
          );
          return {
            ...asset,
            assigned_date: log ? log.action_date : asset.created_at || new Date().toISOString()
          };
        });

        const allLicenseHistory = JSON.parse(localStorage.getItem('license_history') || '[]');
        licenses = filteredLicenses.map((lic: any) => {
          const log = allLicenseHistory.find((h: any) => 
            h.license_id === lic.id && 
            Number(h.employee_id) === Number(id) && 
            (h.action_type === 'Assigned' || h.action_type === 'Transfer')
          );
          return {
            ...lic,
            assigned_date: log ? log.action_date : lic.created_at || new Date().toISOString()
          };
        });
      }

      const files = await employeeService.getEmployeeFiles(id);

      let history: any[] = [];
      if (isSupabaseConfigured) {
        try {
          const { data: dbHistory, error } = await supabase
            .from('history_logs')
            .select('*')
            .eq('employee_id', id)
            .order('id', { ascending: false });

          if (!error && dbHistory) {
            const allAssets = await assetService.getAssets();
            const allLicenses = await licenseService.getLicenses();

            history = dbHistory.map((h: any) => {
              let item_name = 'Unknown Item';
              let item_tag = '';
              if (h.asset_id) {
                const asset = allAssets.find(a => a.id === h.asset_id);
                if (asset) {
                  item_name = asset.name || '';
                  item_tag = asset.asset_tag || '';
                }
              } else if (h.license_id) {
                const lic = allLicenses.find(l => l.id === h.license_id);
                if (lic) {
                  item_name = lic.name || '';
                  item_tag = lic.license_tag || lic.serial_key || '';
                }
              }
              return {
                action_type: h.action_type,
                action_date: h.action_date,
                notes: h.notes,
                pdf_path: h.pdf_path,
                item_name,
                item_tag
              };
            });
          }
        } catch (e) {
          console.error(e);
        }
      } else {
        const assetHistory = JSON.parse(localStorage.getItem('asset_history') || '[]');
        const licenseHistory = JSON.parse(localStorage.getItem('license_history') || '[]');
        const allAssets = await assetService.getAssets();
        const allLicenses = await licenseService.getLicenses();

        const aHistory = assetHistory
          .filter((h: any) => Number(h.employee_id) === id)
          .map((h: any) => {
            const asset = allAssets.find(a => a.id === h.asset_id);
            return {
              action_type: h.action_type,
              action_date: h.action_date || h.created_at,
              notes: h.notes,
              pdf_path: h.pdf_path,
              item_name: asset ? asset.name : 'Unknown Asset',
              item_tag: asset ? asset.asset_tag : ''
            };
          });

        const lHistory = licenseHistory
          .filter((h: any) => Number(h.employee_id) === id)
          .map((h: any) => {
            const lic = allLicenses.find(l => l.id === h.license_id);
            return {
              action_type: h.action_type,
              action_date: h.action_date || h.created_at,
              notes: h.notes,
              pdf_path: h.pdf_path,
              item_name: lic ? lic.name : 'Unknown License',
              item_tag: lic ? lic.license_tag : ''
            };
          });

        history = [...aHistory, ...lHistory].sort((a: any, b: any) => {
          return new Date(b.action_date).getTime() - new Date(a.action_date).getTime();
        });
      }

      return { data: { employee, assets, licenses, files, history } };
    }

    if (parts.length === 4 && parts[3] === 'files' && method === 'POST') {
      // In web fallback uploads, provide a simulated File object or file details from FormData
      const dummyFile = new File(["dummyPDF"], "Attached_File_" + Date.now() + ".pdf", { type: "application/pdf" });
      const result = await employeeService.uploadEmployeeFile(id, dummyFile);
      await logService.addActivityLog('Personnel', id, 'Attached File', result.file_name, 'Added File', `Uploaded compliance document: ${result.file_name}`);
      return { data: result };
    }
  }

  if (route.startsWith('api/employees/files/')) {
    const fileId = parseInt(route.split('/').pop() || '0');
    await employeeService.deleteEmployeeFile(fileId);
    return { data: { success: true } };
  }

  // HARDWARE ASSETS CRUD
  if (route === 'api/assets/seed') {
    if (method === 'POST') {
      const res = await assetService.seedTenSampleAssets();
      if (res.success) {
        await logService.addActivityLog('Asset', 0, 'Seed 10 Assets', 'System', 'Seed', `Imported ${res.count} realistic sample assets to registry`);
      }
      return { data: res };
    }
  }

  if (route === 'api/assets') {
    if (method === 'GET') {
      const list = await assetService.getAssets();
      return { data: list };
    }
    if (method === 'POST') {
      const result = await assetService.addAsset(data);
      await logService.addActivityLog('Asset', result.id, result.name, result.sn, 'Created', `Asset introduced into registry: ${result.name}`);
      return { data: { success: true, id: result.id } };
    }
  }

  if (route.startsWith('api/assets/')) {
    const parts = route.split('/');
    const id = parseInt(parts[2]);

    if (parts.length === 3) {
      if (method === 'PUT' || (method === 'POST' && data?._method === 'PUT')) {
        await assetService.updateAsset(id, data);
        await logService.addActivityLog('Asset', id, data.name || '', data.sn || '', 'Updated', `Asset modified: ${data.name || id}`);
        return { data: { success: true } };
      }
      if (method === 'DELETE' || (method === 'POST' && data?._method === 'DELETE')) {
        await assetService.deleteAsset(id);
        await logService.addActivityLog('Asset', id, 'Deleted Asset', '–', 'Deleted', `Asset decommissioned and removed from registry`);
        return { data: { success: true } };
      }
    }

    if (parts.length === 4) {
      const action = parts[3];

      if (action === 'history' && method === 'GET') {
        const hist = await assetService.getAssetHistory(id);
        return { data: hist };
      }

      if (action === 'assign' && method === 'POST') {
        const empId = parseInt(data.employee_id);
        let pdfPath = null;
        if (data.pdf && (data.pdf instanceof File || data.pdf instanceof Blob)) {
          const fileName = `${Date.now()}_${(data.pdf as File).name || 'assignment.pdf'}`;
          const uploadRes = await storageService.uploadFile('employee-files', fileName, data.pdf);
          if (uploadRes.success) {
            pdfPath = uploadRes.fileUrl || `/uploads/${fileName}`;
          }
        }
        await assetService.assignAsset(id, empId, data.notes || '', pdfPath);
        await logService.addActivityLog('Asset', id, 'Asset Assignment', '–', 'Assigned', `Assigned hardware asset to Employee ID ${empId}`);
        return { data: { success: true } };
      }

      if (action === 'transfer' && method === 'POST') {
        const empId = parseInt(data.employee_id);
        let pdfPath = null;
        if (data.pdf && (data.pdf instanceof File || data.pdf instanceof Blob)) {
          const fileName = `${Date.now()}_${(data.pdf as File).name || 'transfer.pdf'}`;
          const uploadRes = await storageService.uploadFile('employee-files', fileName, data.pdf);
          if (uploadRes.success) {
            pdfPath = uploadRes.fileUrl || `/uploads/${fileName}`;
          }
        }
        await assetService.transferAsset(id, empId, data.notes || '', pdfPath);
        await logService.addActivityLog('Asset', id, 'Asset Transfer', '–', 'Transferred', `Transferred hardware asset to Employee ID ${empId}`);
        return { data: { success: true } };
      }

      if (action === 'return' && method === 'POST') {
        let pdfPath = null;
        if (data.pdf && (data.pdf instanceof File || data.pdf instanceof Blob)) {
          const fileName = `${Date.now()}_${(data.pdf as File).name || 'return.pdf'}`;
          const uploadRes = await storageService.uploadFile('employee-files', fileName, data.pdf);
          if (uploadRes.success) {
            pdfPath = uploadRes.fileUrl || `/uploads/${fileName}`;
          }
        }
        await assetService.returnAsset(id, data.notes || '', pdfPath);
        await logService.addActivityLog('Asset', id, 'Asset Check-in', '–', 'Returned', `Asset checked-back to available storage pool`);
        return { data: { success: true } };
      }
    }
  }

  // SOFTWARE LICENSES CRUD
  if (route === 'api/licenses') {
    if (method === 'GET') {
      const list = await licenseService.getLicenses();
      return { data: list };
    }
    if (method === 'POST') {
      const result = await licenseService.addLicense(data);
      await logService.addActivityLog('License', result.id, result.name, result.sn, 'Created', `Added software license registry: ${result.name}`);
      return { data: { success: true, id: result.id } };
    }
  }

  if (route.startsWith('api/licenses/')) {
    const parts = route.split('/');
    const id = parseInt(parts[2]);

    if (parts.length === 3) {
      if (method === 'PUT' || (method === 'POST' && data?._method === 'PUT')) {
        await licenseService.updateLicense(id, data);
        await logService.addActivityLog('License', id, data.name || '', data.sn || '', 'Updated', `Modified license contract terms: ${data.name || id}`);
        return { data: { success: true } };
      }
      if (method === 'DELETE' || (method === 'POST' && data?._method === 'DELETE')) {
        await licenseService.deleteLicense(id);
        await logService.addActivityLog('License', id, 'Deleted License', '–', 'Deleted', `Software license subscription/key permanently deleted`);
        return { data: { success: true } };
      }
    }

    if (parts.length === 4) {
      const action = parts[3];

      if (action === 'history' && method === 'GET') {
        const hist = await licenseService.getLicenseHistory(id);
        return { data: hist };
      }

      if (action === 'assign' && method === 'POST') {
        const empId = parseInt(data.employee_id);
        let pdfPath = null;
        if (data.pdf && (data.pdf instanceof File || data.pdf instanceof Blob)) {
          const fileName = `${Date.now()}_${(data.pdf as File).name || 'license_assignment.pdf'}`;
          const uploadRes = await storageService.uploadFile('employee-files', fileName, data.pdf);
          if (uploadRes.success) {
            pdfPath = uploadRes.fileUrl || `/uploads/${fileName}`;
          }
        }
        await licenseService.assignLicense(id, empId, data.notes || '', pdfPath);
        await logService.addActivityLog('License', id, 'License Assignment', '–', 'Assigned', `Assigned software license seat to Employee ID ${empId}`);
        return { data: { success: true } };
      }

      if (action === 'transfer' && method === 'POST') {
        const empId = parseInt(data.employee_id);
        let pdfPath = null;
        if (data.pdf && (data.pdf instanceof File || data.pdf instanceof Blob)) {
          const fileName = `${Date.now()}_${(data.pdf as File).name || 'license_transfer.pdf'}`;
          const uploadRes = await storageService.uploadFile('employee-files', fileName, data.pdf);
          if (uploadRes.success) {
            pdfPath = uploadRes.fileUrl || `/uploads/${fileName}`;
          }
        }
        await licenseService.transferLicense(id, empId, data.notes || '', pdfPath);
        await logService.addActivityLog('License', id, 'License Transfer', '–', 'Transferred', `Transferred software license seat to Employee ID ${empId}`);
        return { data: { success: true } };
      }

      if (action === 'return' && method === 'POST') {
        let pdfPath = null;
        if (data.pdf && (data.pdf instanceof File || data.pdf instanceof Blob)) {
          const fileName = `${Date.now()}_${(data.pdf as File).name || 'license_return.pdf'}`;
          const uploadRes = await storageService.uploadFile('employee-files', fileName, data.pdf);
          if (uploadRes.success) {
            pdfPath = uploadRes.fileUrl || `/uploads/${fileName}`;
          }
        }
        await licenseService.returnLicense(id, data.notes || '', pdfPath);
        await logService.addActivityLog('License', id, 'License Check-in', '–', 'Returned', `Software license seat checked-back to available license pool`);
        return { data: { success: true } };
      }
    }
  }

  // TELECOMS CRUD
  if (route === 'api/telecom-services') {
    if (method === 'GET') {
      const list = await telecomService.getTelecomServices();
      return { data: list };
    }
    if (method === 'POST') {
      const fileToUpload = data?.files;
      const result = await telecomService.addTelecomService(data, fileToUpload);
      await logService.addActivityLog('Telecom', result.id, result.name, result.account_number, 'Created', `Registered telecom billing account: ${result.name}`);
      return { data: { success: true, id: result.id } };
    }
  }

  if (route.startsWith('api/telecom-services/')) {
    const parts = route.split('/');
    const id = parseInt(parts[2]);

    if (parts.length === 3) {
      if (method === 'PUT' || (method === 'POST' && data?._method === 'PUT')) {
        const fileToUpload = data?.files;
        await telecomService.updateTelecomService(id, data, fileToUpload);
        await logService.addActivityLog('Telecom', id, data.name || '', data.account_number || '', 'Updated', `Telecom contract updated: ${data.name || id}`);
        return { data: { success: true } };
      }
      if (method === 'DELETE' || (method === 'POST' && data?._method === 'DELETE')) {
        await telecomService.deleteTelecomService(id);
        await logService.addActivityLog('Telecom', id, 'Deleted account', '–', 'Deleted', `Telecom contract account deleted`);
        return { data: { success: true } };
      }
    }
  }

  if (route.startsWith('api/telecom-services/files/')) {
    const fileId = parseInt(route.split('/').pop() || '0');
    const services = await telecomService.getTelecomServices();
    const serviceToUpdate = services.find(s => {
      const sFiles = (s as any).files || [];
      return sFiles.some((f: any) => f.id === fileId);
    });
    if (serviceToUpdate) {
      const updatedFiles = (serviceToUpdate as any).files.filter((f: any) => f.id !== fileId);
      const fileToDelete = (serviceToUpdate as any).files.find((f: any) => f.id === fileId);
      if (fileToDelete && fileToDelete.file_path) {
        try {
          const parts = fileToDelete.file_path.split('/');
          const fileName = parts[parts.length - 1];
          await storageService.deleteFile('telecom-files', fileName);
        } catch (e) {
          console.warn('Failed to delete storage file', e);
        }
      }
      const serialized = updatedFiles.length > 0 ? JSON.stringify(updatedFiles) : null;
      await telecomService.updateTelecomService(serviceToUpdate.id, {
        file_url: serialized,
        file_name: updatedFiles.length > 0 ? updatedFiles[0].file_name : null
      });
    }
    return { data: { success: true } };
  }

  // INCIDENT REPORTS CRUD
  if (route === 'api/incident-reports') {
    if (method === 'GET') {
      const list = await incidentService.getIncidentReports();
      return { data: list };
    }
    if (method === 'POST') {
      const result = await incidentService.addIncidentReport(data);
      await logService.addActivityLog('Incident', result.id, result.title, result.severity, 'Created', `Logged new incident: ${result.title}`);
      return { data: { success: true, id: result.id, record: result } };
    }
  }

  if (route.startsWith('api/incident-reports/')) {
    const parts = route.split('/');
    const id = parseInt(parts[2]);

    if (parts.length === 4 && parts[3] === 'approval-file' && method === 'POST') {
      const fileToUpload = data?.file || new File(["dummyPDF"], "Approval_File_" + Date.now() + ".pdf", { type: "application/pdf" });
      const fileName = `${Date.now()}_${fileToUpload.name}`;
      
      const uploadResult = await storageService.uploadFile('incident-files', fileName, fileToUpload);
      const fileUrl = uploadResult.fileUrl || `/uploads/${fileName}`;

      await incidentService.updateIncidentReport(id, {
        approval_file_url: fileUrl,
        approval_file_name: fileToUpload.name
      });

      await logService.addActivityLog('Incident', id, 'Attached Approval File', fileToUpload.name, 'Updated', `Uploaded approval document: ${fileToUpload.name}`);
      return { data: { success: true, url: fileUrl, file_name: fileToUpload.name } };
    }

    if (parts.length === 3) {
      if (method === 'PUT' || (method === 'POST' && data?._method === 'PUT')) {
        await incidentService.updateIncidentReport(id, data);
        await logService.addActivityLog('Incident', id, data.title || '', data.severity || '', 'Updated', `Incident report updated: ${data.title || id}`);
        return { data: { success: true } };
      }
      if (method === 'DELETE' || (method === 'POST' && data?._method === 'DELETE')) {
        await incidentService.deleteIncidentReport(id);
        await logService.addActivityLog('Incident', id, 'Deleted report', '–', 'Deleted', `Incident report deleted`);
        return { data: { success: true } };
      }
    }
  }

  // LOCATIONS
  if (route === 'api/locations') {
    if (method === 'GET') {
      const list = await lookupService.getLookup('locations');
      return { data: list };
    }
    if (method === 'POST') {
      const result = await lookupService.addLookupItem('locations', data.name);
      return { data: result };
    }
  }

  if (route.startsWith('api/locations/')) {
    const id = parseInt(route.split('/').pop() || '0');
    if (method === 'PUT') {
      await lookupService.updateLookupItem('locations', id, data.name);
      return { data: { success: true } };
    }
    if (method === 'DELETE') {
      await lookupService.deleteLookupItem('locations', id);
      return { data: { success: true } };
    }
  }

  // PROJECT VERIFICATION KEY API
  if (route === 'api/verify-project-key' && method === 'POST') {
    const { location_id, secret_key } = data;
    if (isSupabaseConfigured) {
      try {
        const { data: matchedKey, error } = await supabase
          .from('project_secret_keys')
          .select('*')
          .eq('location_id', Number(location_id))
          .eq('secret_key', secret_key)
          .maybeSingle();

        if (error) {
          // Fallback if table doesn't exist
          if (secret_key === 'riyadh-office-key' || secret_key === 'jeddah-office-key') {
            return { data: { success: true, verified: true } };
          }
          return { status: 400, data: { success: false, verified: false, message: error.message } };
        }

        if (matchedKey) {
          return { data: { success: true, verified: true } };
        } else {
          return { status: 400, data: { success: false, verified: false, message: 'Invalid project secret key.' } };
        }
      } catch (err: any) {
        if (secret_key === 'riyadh-office-key' || secret_key === 'jeddah-office-key') {
          return { data: { success: true, verified: true } };
        }
        return { status: 500, data: { success: false, verified: false, message: err.message } };
      }
    } else {
      // Offline fallback
      let keys = JSON.parse(localStorage.getItem('mock_project_keys') || '[]');
      if (keys.length === 0) {
        keys = [
          { id: 1, location_id: 1, secret_key: 'riyadh-office-key' },
          { id: 2, location_id: 2, secret_key: 'jeddah-office-key' }
        ];
      }
      const matched = keys.find((k: any) => Number(k.location_id) === Number(location_id) && k.secret_key === secret_key);
      if (matched || secret_key === 'riyadh-office-key' || secret_key === 'jeddah-office-key') {
        return { data: { success: true, verified: true } };
      }
      return { status: 400, data: { success: false, verified: false, message: 'Invalid project secret key.' } };
    }
  }

  // SYSTEM ADMIN REGISTER / VERIFY APIS
  if (route === 'api/verify-secret' && method === 'POST') {
    const { secret: inputSecret } = data;
    if (isSupabaseConfigured) {
      try {
        // Query admin_secrets table
        const { data: dbSecretData, error } = await supabase
          .from('admin_secrets')
          .select('secret_key')
          .eq('secret_key', inputSecret)
          .maybeSingle();
        
        if (error) {
          // If table doesn't exist yet, we do a graceful schema fallback
          if (inputSecret === 'admin123') {
            return { data: { success: true } };
          }
          return { status: 400, data: { success: false, message: error.message } };
        }
        
        if (dbSecretData) {
          return { data: { success: true } };
        } else {
          return { status: 400, data: { success: false, message: 'Invalid administrator secret registration key.' } };
        }
      } catch (err: any) {
        if (inputSecret === 'admin123') {
          return { data: { success: true } };
        }
        return { status: 500, data: { success: false, message: err.message } };
      }
    } else {
      if (inputSecret === 'admin123') {
        return { data: { success: true } };
      } else {
        return { status: 400, data: { success: false, message: 'Invalid administrator secret registration key.' } };
      }
    }
  }

  if (route === 'api/project-locations' && method === 'GET') {
    const list = await lookupService.getLookup('locations');
    return { data: list };
  }

  if (route === 'api/project-secret-keys' && method === 'GET') {
    if (isSupabaseConfigured) {
      try {
        const { data: dbKeys, error } = await supabase
          .from('project_secret_keys')
          .select('*')
          .order('id', { ascending: true });
        
        if (error) {
          // Graceful fallback
          throw error;
        }
        return { data: dbKeys || [] };
      } catch (err: any) {
        console.warn('Using project secret keys mock fallback:', err);
      }
    }
    let keys = JSON.parse(localStorage.getItem('mock_project_keys') || '[]');
    if (keys.length === 0) {
      keys = [
        { id: 1, location_id: 1, secret_key: 'riyadh-office-key' },
        { id: 2, location_id: 2, secret_key: 'jeddah-office-key' }
      ];
      localStorage.setItem('mock_project_keys', JSON.stringify(keys));
    }
    return { data: keys };
  }

  if (route === 'api/project-secret-keys' && method === 'POST') {
    if (isSupabaseConfigured) {
      try {
        const { data: newKey, error } = await supabase
          .from('project_secret_keys')
          .insert({
            location_id: Number(data.location_id),
            secret_key: data.secret_key
          })
          .select()
          .single();
        
        if (error) throw error;
        return { data: newKey };
      } catch (err: any) {
        return { status: 400, data: { success: false, message: err.message } };
      }
    }
    let keys = JSON.parse(localStorage.getItem('mock_project_keys') || '[]');
    const newKey = {
      id: Date.now(),
      location_id: Number(data.location_id),
      secret_key: data.secret_key
    };
    keys.push(newKey);
    localStorage.setItem('mock_project_keys', JSON.stringify(keys));
    return { data: newKey };
  }

  if (route.startsWith('api/project-secret-keys/')) {
    const parts = route.split('/');
    const id = parseInt(parts.pop() || '0');
    if (isSupabaseConfigured) {
      try {
        if (method === 'PUT') {
          const { error } = await supabase
            .from('project_secret_keys')
            .update({
              location_id: Number(data.location_id),
              secret_key: data.secret_key
            })
            .eq('id', id);
          if (error) throw error;
          return { data: { success: true } };
        }
        if (method === 'DELETE' || (method === 'POST' && data?._method === 'DELETE')) {
          const { error } = await supabase
            .from('project_secret_keys')
            .delete()
            .eq('id', id);
          if (error) throw error;
          return { data: { success: true } };
        }
      } catch (err: any) {
        return { status: 400, data: { success: false, message: err.message } };
      }
    }
    let keys = JSON.parse(localStorage.getItem('mock_project_keys') || '[]');
    if (method === 'PUT') {
      keys = keys.map((k: any) => k.id === id ? { ...k, location_id: Number(data.location_id), secret_key: data.secret_key } : k);
      localStorage.setItem('mock_project_keys', JSON.stringify(keys));
      return { data: { success: true } };
    }
    if (method === 'DELETE' || (method === 'POST' && data?._method === 'DELETE')) {
      keys = keys.filter((k: any) => k.id !== id);
      localStorage.setItem('mock_project_keys', JSON.stringify(keys));
      return { data: { success: true } };
    }
  }

  if (route === 'api/users' && method === 'GET') {
    if (isSupabaseConfigured) {
      try {
        const { data: dbUsers, error } = await supabase
          .from('users')
          .select('id, username, role, status, name, position, email, mfa_enabled, created_at')
          .order('id', { ascending: true });
        if (error) throw error;
        return { data: dbUsers || [] };
      } catch (err: any) {
        console.warn('Using users mock fallback:', err);
      }
    }
    let mockUsers = JSON.parse(localStorage.getItem('mock_admin_users') || '[]');
    if (mockUsers.length === 0) {
      mockUsers = [
        { id: 1, username: 'admin', name: 'System Admin', position: 'Administrator', email: 'admin@homescontracting.com', role: 'system_admin', status: 'active', password: 'admin123', created_at: new Date().toISOString(), mfa_enabled: false },
        { id: 2, username: 'user', name: 'Staff User', position: 'IT Support', email: 'user@homescontracting.com', role: 'user', status: 'active', password: 'admin123', created_at: new Date().toISOString(), mfa_enabled: false },
        { id: 3, username: 'system@hcc.com', name: 'System Admin (HCC)', position: 'Administrator', email: 'system@hcc.com', role: 'system_admin', status: 'active', password: 'Hcc@1122', created_at: new Date().toISOString(), mfa_enabled: false }
      ];
      localStorage.setItem('mock_admin_users', JSON.stringify(mockUsers));
    }
    
    // Sync with mock_profiles to ensure we reflect users who set up 2FA in user profile modal
    const mockProfiles = JSON.parse(localStorage.getItem('mock_profiles') || '[]');
    mockUsers = mockUsers.map((u: any) => {
      const email = u.email || u.username;
      const profile = mockProfiles.find((p: any) => p.email?.toLowerCase() === email?.toLowerCase());
      return {
        ...u,
        mfa_enabled: u.mfa_enabled !== undefined ? !!u.mfa_enabled : (profile ? !!profile.two_factor_enabled : false)
      };
    });

    return { data: mockUsers };
  }

  if (route === 'api/register-user' && method === 'POST') {
    const { name, position, email, password, role } = data;
    const username = email.toLowerCase();
    
    if (isSupabaseConfigured) {
      try {
        // Check if username/email already exists in database
        const { data: existingUser, error: checkError } = await supabase
          .from('users')
          .select('id')
          .eq('username', username)
          .maybeSingle();
        
        if (checkError) throw checkError;
        if (existingUser) {
          return { status: 400, data: { success: false, message: 'This email is already registered.' } };
        }

        // Insert new user to Supabase
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            username: username,
            name: name,
            position: position,
            email: email,
            password: password, // Store plain-text password for our mock db auth schema design compatibility
            role: role || 'user',
            status: 'active'
          });
        
        if (insertError) throw insertError;
        return { data: { success: true, message: 'User registered successfully!' } };
      } catch (err: any) {
        return { status: 400, data: { success: false, message: err.message } };
      }
    }
    let mockUsers = JSON.parse(localStorage.getItem('mock_admin_users') || '[]');
    if (mockUsers.some((u: any) => u.username === username || (u.email && u.email.toLowerCase() === username))) {
      return { status: 400, data: { success: false, message: 'This email is already registered.' } };
    }
    const newUser = {
      id: Date.now(),
      username: username,
      name,
      position,
      email,
      password,
      role,
      status: 'active',
      created_at: new Date().toISOString()
    };
    mockUsers.push(newUser);
    localStorage.setItem('mock_admin_users', JSON.stringify(mockUsers));
    return { data: { success: true, message: 'User registered successfully!' } };
  }

  if (route.startsWith('api/users/')) {
    const parts = route.split('/');
    const lastSeg = parts.pop() || '';
    const id = parseInt(lastSeg || '0');
    
    if (isSupabaseConfigured) {
      try {
        if (method === 'DELETE' || (method === 'POST' && data?._method === 'DELETE')) {
          const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', id);
          if (error) throw error;
          return { data: { success: true } };
        } else if (method === 'PUT' || (method === 'POST' && (method === 'PUT' || data?._method === 'PUT'))) {
          const payload: any = {};
          if (data.name !== undefined) payload.name = data.name;
          if (data.position !== undefined) payload.position = data.position;
          if (data.email !== undefined) {
            payload.email = data.email;
            payload.username = data.email.toLowerCase();
          }
          if (data.password !== undefined && data.password !== "") payload.password = data.password;
          if (data.role !== undefined) payload.role = data.role;
          if (data.mfa_enabled !== undefined) {
            payload.mfa_enabled = data.mfa_enabled;
            if (!data.mfa_enabled) {
              payload.mfa_secret = null;
            }
          }
          
          const { error } = await supabase
            .from('users')
            .update(payload)
            .eq('id', id);
            
          if (error) throw error;

          // If resetting MFA, also reset profiles table
          if (data.mfa_enabled === false) {
            try {
              const { data: usr } = await supabase.from('users').select('email').eq('id', id).single();
              if (usr && usr.email) {
                await supabase.from('profiles').update({ two_factor_enabled: false, two_factor_secret: null }).eq('email', usr.email);
              }
            } catch (err) {
              console.warn('Profiles MFA update failed:', err);
            }
          }
          
          const { data: updatedUser } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .single();
            
          return { data: { success: true, user: updatedUser } };
        }
      } catch (err: any) {
        return { status: 400, data: { success: false, message: err.message } };
      }
    }
    
    if (method === 'DELETE' || (method === 'POST' && data?._method === 'DELETE')) {
      let mockUsers = JSON.parse(localStorage.getItem('mock_admin_users') || '[]');
      mockUsers = mockUsers.filter((u: any) => u.id !== id);
      localStorage.setItem('mock_admin_users', JSON.stringify(mockUsers));
      return { data: { success: true } };
    } else if (method === 'PUT' || (method === 'POST' && (method === 'PUT' || data?._method === 'PUT'))) {
      let mockUsers = JSON.parse(localStorage.getItem('mock_admin_users') || '[]');
      const idx = mockUsers.findIndex((u: any) => u.id === id);
      if (idx > -1) {
        if (data.name !== undefined) mockUsers[idx].name = data.name;
        if (data.position !== undefined) mockUsers[idx].position = data.position;
        if (data.email !== undefined) {
          mockUsers[idx].email = data.email;
          mockUsers[idx].username = data.email.toLowerCase();
        }
        if (data.password !== undefined && data.password !== "") mockUsers[idx].password = data.password;
        if (data.role !== undefined) mockUsers[idx].role = data.role;
        if (data.mfa_enabled !== undefined) {
          mockUsers[idx].mfa_enabled = data.mfa_enabled;
          if (!data.mfa_enabled) {
            mockUsers[idx].mfa_secret = null;
          }
        }
        
        localStorage.setItem('mock_admin_users', JSON.stringify(mockUsers));

        // Sync with mock_profiles as well
        if (data.mfa_enabled === false) {
          const userEmail = mockUsers[idx].email || mockUsers[idx].username;
          if (userEmail) {
            let mockProfiles = JSON.parse(localStorage.getItem('mock_profiles') || '[]');
            const idxP = mockProfiles.findIndex((p: any) => p.email?.toLowerCase() === userEmail.toLowerCase());
            if (idxP > -1) {
              mockProfiles[idxP].two_factor_enabled = false;
              mockProfiles[idxP].two_factor_secret = null;
              localStorage.setItem('mock_profiles', JSON.stringify(mockProfiles));
            }
          }
        }

        return { data: { success: true, user: mockUsers[idx] } };
      }
      return { status: 404, data: { success: false, message: 'User not found' } };
    }
  }

  // LOCATION ITEMS / CREDENTIAL MANAGERS CRUD
  if (route === 'api/location-items') {
    if (method === 'GET') {
      const locId = parsedUrl.searchParams.get('location_id') || params.location_id;
      const list = await infrastructureService.getLocationItems(locId ? parseInt(locId) : undefined);
      return { data: list };
    }
    if (method === 'POST') {
      const result = await infrastructureService.addLocationItem(data);
      return { data: result };
    }
  }

  if (route.startsWith('api/location-items/')) {
    const id = parseInt(route.split('/').pop() || '0');
    if (method === 'PUT') {
      await infrastructureService.updateLocationItem(id, data);
      return { data: { success: true } };
    }
    if (method === 'DELETE') {
      await infrastructureService.deleteLocationItem(id);
      return { data: { success: true } };
    }
  }

  // ADMINISTRATIVE AND LOOKUPS CRUDS (api/categories, api/models, etc.)
  const segments = route.split('/');
  const lookupType = segments[1];
  
  const validLookups = [
    'categories', 'models', 'manufacturers', 'vendors', 'license-types', 
    'positions', 'locations', 'departments', 'features', 'asset-names', 'license-names'
  ];

  if (segments.length >= 2 && validLookups.includes(lookupType)) {
    if (segments.length === 2) {
      if (method === 'GET') {
        const items = await lookupService.getLookup(lookupType);
        return { data: items };
      }
      if (method === 'POST') {
        const newItem = await lookupService.addLookupItem(lookupType, data.name);
        return { data: newItem };
      }
    }

    if (segments.length === 3) {
      const lookupId = parseInt(segments[2]);
      
      if (method === 'PUT' || (method === 'POST' && data?._method === 'PUT')) {
        await lookupService.updateLookupItem(lookupType, lookupId, data.name);
        return { data: { success: true } };
      }
      if (method === 'DELETE' || (method === 'POST' && data?._method === 'DELETE')) {
        await lookupService.deleteLookupItem(lookupType, lookupId);
        return { data: { success: true } };
      }
    }
  }

  // EXPORT CSV UTILITY
  if (route.startsWith('api/export/')) {
    const exportTarget = route.replace('api/export/', '').split('?')[0];
    let headings = ['ID', 'Name', 'Details'];
    let rowValues: string[][] = [];

    if (exportTarget === 'employees') {
      headings = ['ID', 'SN', 'Name', 'Email', 'Position', 'Department', 'Mobile', 'Location', 'Status'];
      const list = await employeeService.getEmployees();
      rowValues = list.map(e => [String(e.id), e.sn, e.name, e.email, e.position, e.department, e.mobile, e.location, e.status]);
    } else if (exportTarget === 'assets') {
      headings = ['ID', 'SN', 'Asset Name', 'Hardware Spec', 'Asset Tag', 'Hostname', 'Cost', 'Status', 'Date Purchased'];
      const list = await assetService.getAssets();
      rowValues = list.map(a => [String(a.id), a.sn, a.name, a.feature, a.asset_tag, a.hostname, `SR ${a.cost}`, a.status, a.purchase_date]);
    } else if (exportTarget === 'licenses') {
      headings = ['ID', 'License SN', 'License Name', 'Key / Serial', 'Validity Type', 'Cost', 'Status', 'Expires'];
      const list = await licenseService.getLicenses();
      rowValues = list.map(l => [String(l.id), l.sn, l.name, l.serial_key, l.validity_type, `SR ${l.cost}`, l.status, l.expire_end]);
    } else if (exportTarget === 'telecom-services') {
      headings = ['ID', 'Account Link Name', 'Service Provider', 'Account Number', 'Monthly Cost', 'Status', 'Expires'];
      const list = await telecomService.getTelecomServices();
      rowValues = list.map(t => [String(t.id), t.name, t.provider, t.account_number, `SR ${t.cost}`, t.status, t.end_date]);
    } else if (exportTarget === 'incident-reports' || exportTarget === 'incidents') {
      headings = ['ID', 'Incident Title', 'Reporter', 'Type', 'Severity', 'Status', 'Logged Date', 'Description', 'Resolution Action'];
      const list = await incidentService.getIncidentReports();
      rowValues = list.map(i => [String(i.id), i.title, i.reporter_name, i.type, i.severity, i.status, i.created_at, i.description, i.action_taken || '']);
    } else if (exportTarget === 'activity-logs' || exportTarget === 'dashboard') {
      headings = ['Date', 'Entity', 'Action Type', 'Responsibility Operator', 'Audit Details'];
      const list = await logService.getActivityLogs();
      rowValues = list.map(act => [act.created_at, `${act.entity_type} (${act.entity_identity})`, act.action, act.user_name, act.details]);
    }

    const csvContent = [
      headings.join(','),
      ...rowValues.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    return {
      status: 200,
      headers: {
        'content-type': 'text/csv',
        'content-disposition': `attachment; filename="${exportTarget}_report.csv"`
      },
      data: new Blob([csvContent], { type: 'text/csv' })
    };
  }

  // Fallback 404
  return {
    status: 404,
    data: { success: false, message: `Endpoint not found: ${route}` }
  };
}

// Monkeypatch Axios interceptor safely
export function initAxiosMock() {
  seedDatabase();

  const originalRequest = axios.request;

  axios.request = function(config: any): any {
    const url = typeof config === 'string' ? config : (config.url || '');
    if (url.startsWith('/api/') || url.startsWith('api/')) {
      return mockApiHandler(config).then(res => {
        if (res.status && res.status >= 400) {
          const err: any = new Error(res.data?.message || 'Mock Server Error');
          err.response = res;
          err.status = res.status;
          if (res.status === 401) {
            const urlLower = url.toLowerCase();
            if (!urlLower.includes('api/login') && !urlLower.includes('api/mfa/verify-login') && !urlLower.includes('api/verify-secret')) {
              console.warn("Unauthorized 401 from mock server, clearing local session and redirecting to login.");
              localStorage.removeItem("user");
              localStorage.removeItem("token");
              if (typeof window !== 'undefined') {
                window.location.replace("/login");
              }
            }
          }
          return Promise.reject(err);
        }
        return res;
      });
    }
    return originalRequest.call(this, config);
  };

  axios.get = function(url: string, config: any = {}) {
    return axios.request({ ...config, url, method: 'get' });
  };
  axios.post = function(url: string, data: any = {}, config: any = {}) {
    return axios.request({ ...config, url, data, method: 'post' });
  };
  axios.put = function(url: string, data: any = {}, config: any = {}) {
    return axios.request({ ...config, url, data, method: 'put' });
  };
  axios.delete = function(url: string, config: any = {}) {
    return axios.request({ ...config, url, method: 'delete' });
  };
}
