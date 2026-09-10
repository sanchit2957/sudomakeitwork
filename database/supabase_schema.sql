-- ==============================================================================
-- ASSAM RESCUE PLATFORM: COMPLETE SUPABASE POSTGRESQL SCHEMA MIGRATION
-- Run this script in the Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- ==============================================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  "openId" VARCHAR(64) NOT NULL UNIQUE,
  name TEXT,
  email VARCHAR(320),
  password VARCHAR(255),
  "loginMethod" VARCHAR(64) DEFAULT 'supabase-auth',
  role VARCHAR(32) DEFAULT 'user' NOT NULL CHECK (role IN ('user', 'rescuer', 'hospital', 'admin')),
  status VARCHAR(32) DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'disabled')),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "lastSignedIn" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT "users_email_role_unique" UNIQUE (email, role)
);

-- 2. Rescuer Profiles Table
CREATE TABLE IF NOT EXISTS "rescueProfiles" (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "callSign" VARCHAR(96) NOT NULL,
  phone VARCHAR(32),
  "photoKey" VARCHAR(512),
  "photoUrl" VARCHAR(1024),
  "contactSharing" VARCHAR(8) DEFAULT 'no' NOT NULL CHECK ("contactSharing" IN ('yes', 'no')),
  "locationSharing" VARCHAR(8) DEFAULT 'no' NOT NULL CHECK ("locationSharing" IN ('yes', 'no')),
  availability VARCHAR(32) DEFAULT 'available' NOT NULL CHECK (availability IN ('available', 'on_mission', 'off_duty')),
  "lastLatitude" DOUBLE PRECISION,
  "lastLongitude" DOUBLE PRECISION,
  "locationUpdatedAt" TIMESTAMP WITH TIME ZONE,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT "rescueProfiles_userId_unique" UNIQUE ("userId")
);

-- 3. Rescuer Registration Requests
CREATE TABLE IF NOT EXISTS "rescuerRegistrationRequests" (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone VARCHAR(32),
  note TEXT,
  status VARCHAR(32) DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  "reviewedBy" INTEGER REFERENCES users(id),
  "reviewNote" TEXT,
  "reviewedAt" TIMESTAMP WITH TIME ZONE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT "rescuerRegistrationRequests_userId_unique" UNIQUE ("userId")
);

-- 4. Incidents & Emergency SOS Dispatches
CREATE TABLE IF NOT EXISTS incidents (
  id SERIAL PRIMARY KEY,
  "publicCode" VARCHAR(24) NOT NULL UNIQUE,
  "reporterId" INTEGER REFERENCES users(id) ON DELETE SET NULL,
  "contactName" VARCHAR(160),
  "locationLabel" VARCHAR(360) NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  "emergencyType" VARCHAR(32) NOT NULL CHECK ("emergencyType" IN ('flood', 'medical', 'trapped', 'evacuation', 'other')),
  "helpNeeds" TEXT,
  severity VARCHAR(32) DEFAULT 'medium' NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  "peopleAffected" INTEGER DEFAULT 1 NOT NULL,
  notes TEXT,
  "evidenceKey" VARCHAR(512),
  "evidenceUrl" VARCHAR(1024),
  "voiceNoteKey" VARCHAR(512),
  "voiceNoteUrl" VARCHAR(1024),
  "voiceNoteDurationSeconds" INTEGER,
  status VARCHAR(32) DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'dispatched', 'resolved')),
  "assignedRescuerId" INTEGER REFERENCES users(id) ON DELETE SET NULL,
  "dispatchedAt" TIMESTAMP WITH TIME ZONE,
  "resolvedAt" TIMESTAMP WITH TIME ZONE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 5. Incident Live Messages / Operations Chat
CREATE TABLE IF NOT EXISTS "incidentMessages" (
  id SERIAL PRIMARY KEY,
  "incidentId" INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  "authorType" VARCHAR(32) NOT NULL CHECK ("authorType" IN ('victim', 'rescuer', 'operations')),
  "authorId" INTEGER REFERENCES users(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 6. Missions Assignment Table
CREATE TABLE IF NOT EXISTS missions (
  id SERIAL PRIMARY KEY,
  "incidentId" INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  "rescuerId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(32) DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'dispatched', 'resolved')),
  "assignedBy" INTEGER NOT NULL REFERENCES users(id),
  "assignedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "dispatchedAt" TIMESTAMP WITH TIME ZONE,
  "resolvedAt" TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT "missions_incidentId_unique" UNIQUE ("incidentId")
);

-- 7. Incident Timeline Events
CREATE TABLE IF NOT EXISTS "incidentEvents" (
  id SERIAL PRIMARY KEY,
  "incidentId" INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  "actorId" INTEGER REFERENCES users(id) ON DELETE SET NULL,
  "eventType" VARCHAR(64) NOT NULL,
  title VARCHAR(180) NOT NULL,
  detail TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 8. Safety Assistance Requests
CREATE TABLE IF NOT EXISTS "safetyAssistanceRequests" (
  id SERIAL PRIMARY KEY,
  "requesterId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(32) NOT NULL CHECK (category IN ('shelter', 'food', 'medical', 'protection')),
  "peopleAffected" INTEGER DEFAULT 1 NOT NULL,
  details TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  status VARCHAR(32) DEFAULT 'new' NOT NULL CHECK (status IN ('new', 'acknowledged', 'resolved')),
  "reviewedBy" INTEGER REFERENCES users(id) ON DELETE SET NULL,
  "reviewedAt" TIMESTAMP WITH TIME ZONE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 9. Shelters Directory
CREATE TABLE IF NOT EXISTS shelters (
  id SERIAL PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  address VARCHAR(360) NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  capacity INTEGER DEFAULT 0 NOT NULL,
  occupancy INTEGER DEFAULT 0 NOT NULL,
  status VARCHAR(32) DEFAULT 'open' NOT NULL CHECK (status IN ('open', 'limited', 'closed')),
  "createdBy" INTEGER REFERENCES users(id) ON DELETE SET NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 10. Hospitals and Emergency Facilities
CREATE TABLE IF NOT EXISTS hospitals (
  id SERIAL PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  address VARCHAR(360) NOT NULL,
  "contactPhone" VARCHAR(32),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  "totalEmergencyBeds" INTEGER DEFAULT 0 NOT NULL,
  "availableEmergencyBeds" INTEGER DEFAULT 0 NOT NULL,
  "totalIcuBeds" INTEGER DEFAULT 0 NOT NULL,
  "availableIcuBeds" INTEGER DEFAULT 0 NOT NULL,
  "oxygenCylinderCount" INTEGER DEFAULT 0 NOT NULL,
  "bloodUnitCount" INTEGER DEFAULT 0 NOT NULL,
  "ambulanceCount" INTEGER DEFAULT 0 NOT NULL,
  "foodSupplyStatus" VARCHAR(32) DEFAULT 'available' NOT NULL CHECK ("foodSupplyStatus" IN ('available', 'limited', 'critical', 'unavailable')),
  "medicineSupplyStatus" VARCHAR(32) DEFAULT 'available' NOT NULL CHECK ("medicineSupplyStatus" IN ('available', 'limited', 'critical', 'unavailable')),
  "waterSupplyStatus" VARCHAR(32) DEFAULT 'available' NOT NULL CHECK ("waterSupplyStatus" IN ('available', 'limited', 'critical', 'unavailable')),
  "powerBackupStatus" VARCHAR(32) DEFAULT 'available' NOT NULL CHECK ("powerBackupStatus" IN ('available', 'limited', 'critical', 'unavailable')),
  status VARCHAR(32) DEFAULT 'open' NOT NULL CHECK (status IN ('open', 'limited', 'critical', 'closed')),
  "updatedBy" INTEGER REFERENCES users(id) ON DELETE SET NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 11. Hospital Registration Requests
CREATE TABLE IF NOT EXISTS "hospitalRegistrationRequests" (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "hospitalName" VARCHAR(180) NOT NULL,
  address VARCHAR(360) NOT NULL,
  "contactPhone" VARCHAR(32) NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  note TEXT,
  status VARCHAR(32) DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  "reviewedBy" INTEGER REFERENCES users(id) ON DELETE SET NULL,
  "reviewNote" TEXT,
  "reviewedAt" TIMESTAMP WITH TIME ZONE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT "hospitalRegistrationRequests_userId_unique" UNIQUE ("userId")
);

-- 12. Hospital Staff Profiles
CREATE TABLE IF NOT EXISTS "hospitalStaffProfiles" (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "hospitalId" INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  designation VARCHAR(120),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT "hospitalStaffProfiles_userId_unique" UNIQUE ("userId")
);

-- 13. Flood Zones Directory
CREATE TABLE IF NOT EXISTS "floodZones" (
  id SERIAL PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  severity VARCHAR(32) DEFAULT 'medium' NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  "polygonJson" TEXT NOT NULL,
  active VARCHAR(8) DEFAULT 'yes' NOT NULL CHECK (active IN ('yes', 'no')),
  "createdBy" INTEGER REFERENCES users(id) ON DELETE SET NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 14. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  "recipientId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "incidentId" INTEGER REFERENCES incidents(id) ON DELETE SET NULL,
  type VARCHAR(32) NOT NULL CHECK (type IN ('mission_assigned', 'priority_incident', 'status_update')),
  title VARCHAR(180) NOT NULL,
  body TEXT NOT NULL,
  "readAt" TIMESTAMP WITH TIME ZONE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 15. Push Subscriptions Table (Web Push Notifications)
CREATE TABLE IF NOT EXISTS "pushSubscriptions" (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "endpointHash" VARCHAR(64) NOT NULL UNIQUE,
  endpoint TEXT NOT NULL,
  p256dh VARCHAR(512) NOT NULL,
  auth VARCHAR(512) NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 16. Audit Logs Table
CREATE TABLE IF NOT EXISTS "auditLogs" (
  id SERIAL PRIMARY KEY,
  "actorId" INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(96) NOT NULL,
  "resourceType" VARCHAR(64) NOT NULL,
  "resourceId" VARCHAR(64),
  detail TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 17. Citizen Emergency Contacts Table
CREATE TABLE IF NOT EXISTS "emergencyContacts" (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(160) NOT NULL,
  relation VARCHAR(64) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  "alternatePhone" VARCHAR(32),
  "isPrimary" VARCHAR(8) DEFAULT 'no' NOT NULL CHECK ("isPrimary" IN ('yes', 'no')),
  notes TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create Helpful Indexes
CREATE INDEX IF NOT EXISTS "idx_incidents_status" ON incidents(status, "createdAt");
CREATE INDEX IF NOT EXISTS "idx_incidents_rescuer" ON incidents("assignedRescuerId", status);
CREATE INDEX IF NOT EXISTS "idx_emergencyContacts_user" ON "emergencyContacts"("userId");
CREATE INDEX IF NOT EXISTS "idx_notifications_recipient" ON notifications("recipientId", "readAt");

