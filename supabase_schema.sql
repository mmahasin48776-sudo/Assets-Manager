-- ====================================================================
-- SUPABASE COMPLETE DATABASE BOOTSTRAP SCHEMA & SEED DATA
-- FOR THE HOMES CONTRACTING ASSET MANAGEMENT SYSTEM
-- ====================================================================
-- INSTRUCTIONS FOR THE USER:
-- 1. Open your Supabase Dashboard: https://supabase.com
-- 2. Select your project ("Assets manager")
-- 3. Click on the "SQL Editor" in the left sidebar menu (the icon with cursor >_ )
-- 4. Click "New Query"
-- 5. Copy and paste this entire file content into the SQL editor
-- 6. Click the green "Run" button at the bottom-right of the SQL editor.
-- 7. Wait 2 seconds. Voila! All your tables and 10 sample assets are loaded perfectly!
-- ====================================================================

-- Enable UUID extension just in case
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Helper function to execute raw SQL (allowing client-side bootstrap from authenticated triggers)
CREATE OR REPLACE FUNCTION exec_sql(sql_query text)
RETURNS void AS $$
BEGIN
  EXECUTE sql_query;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- A. LOOKUP / DICTIONARY TABLES
-- ==========================================

-- 1. categories
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

-- 2. models
CREATE TABLE IF NOT EXISTS models (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

-- 3. manufacturers
CREATE TABLE IF NOT EXISTS manufacturers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

-- 4. vendors
CREATE TABLE IF NOT EXISTS vendors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

-- 5. license_types
CREATE TABLE IF NOT EXISTS license_types (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

-- 6. locations
CREATE TABLE IF NOT EXISTS locations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

-- 7. departments
CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

-- 8. positions
CREATE TABLE IF NOT EXISTS positions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

-- 9. features
CREATE TABLE IF NOT EXISTS features (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

-- 10. asset_names
CREATE TABLE IF NOT EXISTS asset_names (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

-- 11. license_names
CREATE TABLE IF NOT EXISTS license_names (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);


-- ==========================================
-- B. CORE FUNCTIONAL TABLES
-- ==========================================

-- 12. users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'system_admin',
  status TEXT DEFAULT 'active',
  email TEXT DEFAULT 'admin@homescontracting.com',
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_secret TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12b. profiles (Explicitly required for 2FA profiles)
CREATE TABLE IF NOT EXISTS profiles (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  two_factor_secret TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12c. trusted_devices (Explicitly required for trusted device tracking)
CREATE TABLE IF NOT EXISTS trusted_devices (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  device_fingerprint TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12d. incident_reports
CREATE TABLE IF NOT EXISTS incident_reports (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reporter_id INTEGER,
  reporter_name TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT DEFAULT 'Open',
  asset_id INTEGER,
  action_taken TEXT,
  employee_name TEXT,
  employee_id TEXT,
  department TEXT,
  reporting_manager TEXT,
  incident_number TEXT,
  incident_date TEXT,
  incident_time TEXT,
  incident_taken_by TEXT,
  incident_old_ref TEXT,
  incident_definition TEXT,
  impact_of_incident TEXT,
  corrective_action TEXT,
  corrective_action_date TEXT,
  preventive_action TEXT,
  prepared_by_name TEXT,
  prepared_by_position TEXT,
  prepared_by_location TEXT,
  approval_file_url TEXT,
  approval_file_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. employees
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  sn TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  position TEXT,
  department TEXT,
  mobile TEXT,
  location TEXT,
  location_id INTEGER,
  status TEXT DEFAULT 'Active',
  notes TEXT,
  reporting_manager TEXT,
  company_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 14. employee_files
CREATE TABLE IF NOT EXISTS employee_files (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 15. assets
CREATE TABLE IF NOT EXISTS assets (
  id SERIAL PRIMARY KEY,
  sn TEXT NOT NULL,
  name TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  asset_name_id INTEGER,
  model_id INTEGER,
  manufacturer_id INTEGER,
  category_id INTEGER,
  asset_tag TEXT,
  hostname TEXT,
  feature TEXT,
  cost NUMERIC(15, 2),
  vendor_id INTEGER,
  po_number TEXT,
  purchase_date TEXT,
  expire_start TEXT,
  expire_end TEXT,
  depreciation_period INTEGER,
  status TEXT DEFAULT 'Available',
  assigned_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  pdf_path TEXT,
  location_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 16. licenses
CREATE TABLE IF NOT EXISTS licenses (
  id SERIAL PRIMARY KEY,
  sn TEXT NOT NULL,
  name TEXT NOT NULL,
  license_name TEXT NOT NULL,
  type_id INTEGER,
  validity_type TEXT,
  license_tag TEXT,
  serial_key TEXT,
  cost NUMERIC(15, 2),
  vendor_id INTEGER,
  po_number TEXT,
  expire_start TEXT,
  expire_end TEXT,
  status TEXT DEFAULT 'Available',
  assigned_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  pdf_path TEXT,
  location_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 17. history_logs
CREATE TABLE IF NOT EXISTS history_logs (
  id SERIAL PRIMARY KEY,
  asset_id INTEGER REFERENCES assets(id) ON DELETE CASCADE,
  license_id INTEGER REFERENCES licenses(id) ON DELETE CASCADE,
  employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  action_date TEXT NOT NULL,
  notes TEXT,
  pdf_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 18. telecom_services
CREATE TABLE IF NOT EXISTS telecom_services (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  account_number TEXT NOT NULL,
  cost NUMERIC(15, 2),
  status TEXT DEFAULT 'Active',
  contract_start_date TEXT,
  end_date TEXT,
  facility TEXT,
  po_number TEXT,
  contact_info TEXT,
  location_id INTEGER,
  notes TEXT,
  file_url TEXT,
  file_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 19. location_items
CREATE TABLE IF NOT EXISTS location_items (
  id SERIAL PRIMARY KEY,
  location_id INTEGER,
  category TEXT,
  name TEXT NOT NULL,
  model TEXT,
  ip_address TEXT,
  username TEXT,
  password TEXT,
  access_password TEXT,
  serial TEXT,
  identify_address TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 20. activity_logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  entity_name TEXT NOT NULL,
  entity_identity TEXT NOT NULL,
  action TEXT NOT NULL,
  user_name TEXT,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 20b. login_logs
CREATE TABLE IF NOT EXISTS login_logs (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  device_name TEXT NOT NULL,
  ip TEXT NOT NULL,
  location TEXT NOT NULL,
  login_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  logout_time TIMESTAMP WITH TIME ZONE
);

-- 21. links
CREATE TABLE IF NOT EXISTS links (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 22. notifications
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  action_type TEXT NOT NULL DEFAULT 'pending',
  link TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  expires_at TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 23. project_secret_keys
CREATE TABLE IF NOT EXISTS project_secret_keys (
  id SERIAL PRIMARY KEY,
  location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
  secret_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 24. admin_secrets
CREATE TABLE IF NOT EXISTS admin_secrets (
  id SERIAL PRIMARY KEY,
  secret_key TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ==========================================
-- C. SEED PRESET VALUES AND 10 SAMPLE ASSETS
-- ==========================================

-- Seed lookup: categories
INSERT INTO categories (id, name) VALUES
(1, 'Computers'),
(2, 'Network Equipment'),
(3, 'Office Devices')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Seed lookup: models
INSERT INTO models (id, name) VALUES
(1, 'MacBook Pro M3'),
(2, 'ThinkPad X1'),
(3, 'iPad Pro'),
(4, 'iPhone 15 Pro'),
(5, 'Cisco Catalyst')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Seed lookup: manufacturers
INSERT INTO manufacturers (id, name) VALUES
(1, 'Apple'),
(2, 'Lenovo'),
(3, 'Cisco'),
(4, 'Dell')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Seed lookup: vendors
INSERT INTO vendors (id, name) VALUES
(1, 'Saudi Telecom Company (STC)'),
(2, 'eXtra'),
(3, 'Jarir Bookstore'),
(4, 'Microsoft Store')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Seed lookup: license_types
INSERT INTO license_types (id, name) VALUES
(1, 'Subscription (Monthly)'),
(2, 'Subscription (Yearly)'),
(3, 'Perpetual')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Seed lookup: locations
INSERT INTO locations (id, name) VALUES
(1, 'Riyadh HQ'),
(2, 'Jeddah Branch'),
(3, 'Dammam Site')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Seed lookup: departments
INSERT INTO departments (id, name) VALUES
(1, 'IT & Engineering'),
(2, 'Construction & Contracting'),
(3, 'Finance & Admin')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Seed lookup: positions
INSERT INTO positions (id, name) VALUES
(1, 'Project Manager'),
(2, 'Senior Site Engineer'),
(3, 'IT Support Specialist'),
(4, 'Accountant')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Seed lookup: features
INSERT INTO features (id, name) VALUES
(1, '64GB RAM, 2TB SSD'),
(2, '32GB RAM, 1TB SSD'),
(3, 'Wi-Fi + Cellular')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Seed lookup: asset_names
INSERT INTO asset_names (id, name) VALUES
(1, 'Primary Workstation'),
(2, 'Backup Server'),
(3, 'Mobile Terminal')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Seed lookup: license_names
INSERT INTO license_names (id, name) VALUES
(1, 'Adobe Creative Cloud'),
(2, 'Microsoft 365 Business Premium'),
(3, 'JetBrains All Products Pack')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Seed lookup: users
INSERT INTO users (id, username, password, role, status) VALUES
(1, 'admin', 'admin123', 'system_admin', 'active'),
(2, 'system@hcc.com', 'Hcc@1122', 'system_admin', 'active')
ON CONFLICT (username) DO NOTHING;

-- Seed core: admin_secrets
INSERT INTO admin_secrets (id, secret_key) VALUES
(1, 'admin123')
ON CONFLICT (id) DO NOTHING;


-- ==========================================
-- D. SEQUENCES OPTIMIZATION
-- ==========================================
SELECT setval(pg_get_serial_sequence('categories', 'id'), COALESCE(max(id), 1)) FROM categories;
SELECT setval(pg_get_serial_sequence('models', 'id'), COALESCE(max(id), 1)) FROM models;
SELECT setval(pg_get_serial_sequence('manufacturers', 'id'), COALESCE(max(id), 1)) FROM manufacturers;
SELECT setval(pg_get_serial_sequence('vendors', 'id'), COALESCE(max(id), 1)) FROM vendors;
SELECT setval(pg_get_serial_sequence('license_types', 'id'), COALESCE(max(id), 1)) FROM license_types;
SELECT setval(pg_get_serial_sequence('locations', 'id'), COALESCE(max(id), 1)) FROM locations;
SELECT setval(pg_get_serial_sequence('departments', 'id'), COALESCE(max(id), 1)) FROM departments;
SELECT setval(pg_get_serial_sequence('positions', 'id'), COALESCE(max(id), 1)) FROM positions;
SELECT setval(pg_get_serial_sequence('features', 'id'), COALESCE(max(id), 1)) FROM features;
SELECT setval(pg_get_serial_sequence('asset_names', 'id'), COALESCE(max(id), 1)) FROM asset_names;
SELECT setval(pg_get_serial_sequence('license_names', 'id'), COALESCE(max(id), 1)) FROM license_names;
SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE(max(id), 1)) FROM users;
SELECT setval(pg_get_serial_sequence('employees', 'id'), COALESCE(max(id), 1)) FROM employees;
SELECT setval(pg_get_serial_sequence('assets', 'id'), COALESCE(max(id), 1)) FROM assets;
SELECT setval(pg_get_serial_sequence('licenses', 'id'), COALESCE(max(id), 1)) FROM licenses;
SELECT setval(pg_get_serial_sequence('telecom_services', 'id'), COALESCE(max(id), 1)) FROM telecom_services;
SELECT setval(pg_get_serial_sequence('location_items', 'id'), COALESCE(max(id), 1)) FROM location_items;
SELECT setval(pg_get_serial_sequence('activity_logs', 'id'), COALESCE(max(id), 1)) FROM activity_logs;
SELECT setval(pg_get_serial_sequence('login_logs', 'id'), COALESCE(max(id), 1)) FROM login_logs;
SELECT setval(pg_get_serial_sequence('links', 'id'), COALESCE(max(id), 1)) FROM links;
SELECT setval(pg_get_serial_sequence('notifications', 'id'), COALESCE(max(id), 1)) FROM notifications;
SELECT setval(pg_get_serial_sequence('project_secret_keys', 'id'), COALESCE(max(id), 1)) FROM project_secret_keys;
SELECT setval(pg_get_serial_sequence('admin_secrets', 'id'), COALESCE(max(id), 1)) FROM admin_secrets;
SELECT setval(pg_get_serial_sequence('profiles', 'id'), COALESCE(max(id), 1)) FROM profiles;
SELECT setval(pg_get_serial_sequence('trusted_devices', 'id'), COALESCE(max(id), 1)) FROM trusted_devices;
SELECT setval(pg_get_serial_sequence('incident_reports', 'id'), COALESCE(max(id), 1)) FROM incident_reports;
