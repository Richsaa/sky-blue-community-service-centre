-- Sky Blue Community Service Centre
-- Multi-industry SaaS foundation
-- Additive migration: existing Ward tables are not modified.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS saas_industries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS saas_organisations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  industry_id INTEGER NOT NULL,
  organisation_type TEXT NOT NULL DEFAULT 'business',
  legacy_tenant_id INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (industry_id) REFERENCES saas_industries(id)
);

CREATE TABLE IF NOT EXISTS saas_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organisation_id INTEGER NOT NULL,
  plan_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'trial',
  start_date DATETIME,
  end_date DATETIME,
  auto_renew INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organisation_id) REFERENCES saas_organisations(id)
);

CREATE TABLE IF NOT EXISTS saas_organisation_settings (
  organisation_id INTEGER PRIMARY KEY,
  display_name TEXT,
  logo_url TEXT,
  whatsapp_display_name TEXT,
  whatsapp_phone_number_id TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  timezone TEXT NOT NULL DEFAULT 'Africa/Johannesburg',
  operating_hours_json TEXT,
  settings_json TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organisation_id) REFERENCES saas_organisations(id)
);

CREATE TABLE IF NOT EXISTS saas_services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organisation_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  service_type TEXT NOT NULL DEFAULT 'appointment',
  duration_minutes INTEGER,
  capacity INTEGER NOT NULL DEFAULT 1,
  price REAL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organisation_id) REFERENCES saas_organisations(id)
);

CREATE TABLE IF NOT EXISTS saas_resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organisation_id INTEGER NOT NULL,
  resource_type TEXT NOT NULL,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  metadata_json TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organisation_id) REFERENCES saas_organisations(id)
);

CREATE TABLE IF NOT EXISTS saas_service_resources (
  service_id INTEGER NOT NULL,
  resource_id INTEGER NOT NULL,
  quantity_required INTEGER NOT NULL DEFAULT 1,
  duration_override_minutes INTEGER,
  PRIMARY KEY (service_id, resource_id),
  FOREIGN KEY (service_id) REFERENCES saas_services(id),
  FOREIGN KEY (resource_id) REFERENCES saas_resources(id)
);

CREATE TABLE IF NOT EXISTS saas_service_availability (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  capacity INTEGER,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (service_id) REFERENCES saas_services(id)
);

CREATE TABLE IF NOT EXISTS saas_resource_availability (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resource_id INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (resource_id) REFERENCES saas_resources(id)
);

CREATE INDEX IF NOT EXISTS idx_saas_org_industry
ON saas_organisations(industry_id);

CREATE INDEX IF NOT EXISTS idx_saas_org_legacy_tenant
ON saas_organisations(legacy_tenant_id);

CREATE INDEX IF NOT EXISTS idx_saas_subscriptions_org
ON saas_subscriptions(organisation_id);

CREATE INDEX IF NOT EXISTS idx_saas_services_org
ON saas_services(organisation_id);

CREATE INDEX IF NOT EXISTS idx_saas_resources_org
ON saas_resources(organisation_id);

CREATE INDEX IF NOT EXISTS idx_saas_service_availability_service
ON saas_service_availability(service_id);

CREATE INDEX IF NOT EXISTS idx_saas_resource_availability_resource
ON saas_resource_availability(resource_id);

INSERT OR IGNORE INTO saas_industries
(id, code, name, description)
VALUES
(1, 'ward', 'Ward / Councillor',
 'Community and ward service reporting'),

(2, 'it_hardware', 'IT / Server / Hardware Shop',
 'IT products, repairs and technical services'),

(3, 'salon_barber', 'Salon / Barber',
 'Salon, barber and personal care services'),

(4, 'driving_school', 'Driving School',
 'Learner, instructor, vehicle and lesson management'),

(5, 'school', 'School',
 'School, learner, parent and teacher communication'),

(6, 'preschool', 'Pre-school / Day-care',
 'Early childhood and parent communication'),

(7, 'pharmacy', 'Pharmacy',
 'Pharmacy customer service and operational workflows'),

(8, 'building_hardware', 'Building Materials Shop',
 'Building materials, hardware and delivery'),

(9, 'transport', 'Transport Business',
 'Taxi, shuttle, bus, courier and logistics operations'),

(10, 'laundry', 'Laundry',
 'Laundry orders, production queues and collection'),

(11, 'wholesale', 'Wholesale / Grocery Supply',
 'Wholesale ordering, preparation and collection/delivery'),

(12, 'other', 'Other Service Business',
 'General service business workflows');
