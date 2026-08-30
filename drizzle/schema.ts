import {
  double,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  password: varchar("password", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "rescuer", "hospital", "admin", "medical"]).default("user").notNull(),
  status: mysqlEnum("status", ["active", "disabled"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const rescueProfiles = mysqlTable(
  "rescueProfiles",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id),
    callSign: varchar("callSign", { length: 96 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    photoKey: varchar("photoKey", { length: 512 }),
    photoUrl: varchar("photoUrl", { length: 1024 }),
    contactSharing: mysqlEnum("contactSharing", ["yes", "no"]).default("no").notNull(),
    locationSharing: mysqlEnum("locationSharing", ["yes", "no"]).default("no").notNull(),
    availability: mysqlEnum("availability", ["available", "on_mission", "off_duty"])
      .default("available")
      .notNull(),
    lastLatitude: double("lastLatitude"),
    lastLongitude: double("lastLongitude"),
    locationUpdatedAt: timestamp("locationUpdatedAt"),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("rescueProfiles_userId_unique").on(table.userId)],
);

export const rescuerRegistrationRequests = mysqlTable(
  "rescuerRegistrationRequests",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id),
    phone: varchar("phone", { length: 32 }),
    note: text("note"),
    status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
    reviewedBy: int("reviewedBy").references(() => users.id),
    reviewNote: text("reviewNote"),
    reviewedAt: timestamp("reviewedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("rescuerRegistrationRequests_userId_unique").on(table.userId), index("rescuerRegistrationRequests_status_createdAt_idx").on(table.status, table.createdAt)],
);

export const incidents = mysqlTable(
  "incidents",
  {
    id: int("id").autoincrement().primaryKey(),
    publicCode: varchar("publicCode", { length: 24 }).notNull(),
    reporterId: int("reporterId").references(() => users.id),
    contactName: varchar("contactName", { length: 160 }),
    locationLabel: varchar("locationLabel", { length: 360 }).notNull(),
    latitude: double("latitude").notNull(),
    longitude: double("longitude").notNull(),
    emergencyType: mysqlEnum("emergencyType", ["flood", "medical", "trapped", "evacuation", "other"])
      .notNull(),
    helpNeeds: text("helpNeeds"),
    severity: mysqlEnum("severity", ["critical", "high", "medium", "low"]).default("medium").notNull(),
    peopleAffected: int("peopleAffected").default(1).notNull(),
    notes: text("notes"),
    evidenceKey: varchar("evidenceKey", { length: 512 }),
    evidenceUrl: varchar("evidenceUrl", { length: 1024 }),
    voiceNoteKey: varchar("voiceNoteKey", { length: 512 }),
    voiceNoteUrl: varchar("voiceNoteUrl", { length: 1024 }),
    voiceNoteDurationSeconds: int("voiceNoteDurationSeconds"),
    status: mysqlEnum("status", ["pending", "dispatched", "resolved"]).default("pending").notNull(),
    assignedRescuerId: int("assignedRescuerId").references(() => users.id),
    dispatchedAt: timestamp("dispatchedAt"),
    resolvedAt: timestamp("resolvedAt"),
    escalationLevel: int("escalationLevel").default(0).notNull(),
    lastEscalatedAt: timestamp("lastEscalatedAt"),
    automationStatus: varchar("automationStatus", { length: 64 }).default("active").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("incidents_publicCode_unique").on(table.publicCode),
    index("incidents_status_createdAt_idx").on(table.status, table.createdAt),
    index("incidents_assignedRescuerId_status_idx").on(table.assignedRescuerId, table.status),
  ],
);

export const incidentMessages = mysqlTable(
  "incidentMessages",
  {
    id: int("id").autoincrement().primaryKey(),
    incidentId: int("incidentId").notNull().references(() => incidents.id),
    authorType: mysqlEnum("authorType", ["victim", "rescuer", "operations"]).notNull(),
    authorId: int("authorId").references(() => users.id),
    message: text("message").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("incidentMessages_incidentId_createdAt_idx").on(table.incidentId, table.createdAt)],
);

export const missions = mysqlTable(
  "missions",
  {
    id: int("id").autoincrement().primaryKey(),
    incidentId: int("incidentId").notNull().references(() => incidents.id),
    rescuerId: int("rescuerId").notNull().references(() => users.id),
    status: mysqlEnum("status", ["pending", "dispatched", "resolved"]).default("pending").notNull(),
    assignedBy: int("assignedBy").notNull().references(() => users.id),
    assignedAt: timestamp("assignedAt").defaultNow().notNull(),
    dispatchedAt: timestamp("dispatchedAt"),
    resolvedAt: timestamp("resolvedAt"),
    notes: text("notes"),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("missions_incidentId_unique").on(table.incidentId),
    index("missions_rescuerId_status_idx").on(table.rescuerId, table.status),
  ],
);

export const incidentEvents = mysqlTable(
  "incidentEvents",
  {
    id: int("id").autoincrement().primaryKey(),
    incidentId: int("incidentId").notNull().references(() => incidents.id),
    actorId: int("actorId").references(() => users.id),
    eventType: varchar("eventType", { length: 64 }).notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    detail: text("detail"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("incidentEvents_incidentId_createdAt_idx").on(table.incidentId, table.createdAt)],
);

export const safetyAssistanceRequests = mysqlTable(
  "safetyAssistanceRequests",
  {
    id: int("id").autoincrement().primaryKey(),
    requesterId: int("requesterId").notNull().references(() => users.id),
    category: mysqlEnum("category", ["shelter", "food", "medical", "protection"]).notNull(),
    peopleAffected: int("peopleAffected").default(1).notNull(),
    details: text("details"),
    latitude: double("latitude").notNull(),
    longitude: double("longitude").notNull(),
    status: mysqlEnum("status", ["new", "acknowledged", "resolved"]).default("new").notNull(),
    reviewedBy: int("reviewedBy").references(() => users.id),
    reviewedAt: timestamp("reviewedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("safetyAssistanceRequests_status_createdAt_idx").on(table.status, table.createdAt), index("safetyAssistanceRequests_category_status_idx").on(table.category, table.status)],
);

export const shelters = mysqlTable(
  "shelters",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 180 }).notNull(),
    address: varchar("address", { length: 360 }).notNull(),
    latitude: double("latitude").notNull(),
    longitude: double("longitude").notNull(),
    capacity: int("capacity").default(0).notNull(),
    occupancy: int("occupancy").default(0).notNull(),
    status: mysqlEnum("status", ["open", "limited", "closed"]).default("open").notNull(),
    createdBy: int("createdBy").references(() => users.id),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("shelters_status_idx").on(table.status)],
);

export const hospitals = mysqlTable(
  "hospitals",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 180 }).notNull(),
    address: varchar("address", { length: 360 }).notNull(),
    contactPhone: varchar("contactPhone", { length: 32 }),
    latitude: double("latitude").notNull(),
    longitude: double("longitude").notNull(),
    totalEmergencyBeds: int("totalEmergencyBeds").default(0).notNull(),
    availableEmergencyBeds: int("availableEmergencyBeds").default(0).notNull(),
    totalIcuBeds: int("totalIcuBeds").default(0).notNull(),
    availableIcuBeds: int("availableIcuBeds").default(0).notNull(),
    oxygenCylinderCount: int("oxygenCylinderCount").default(0).notNull(),
    bloodUnitCount: int("bloodUnitCount").default(0).notNull(),
    ambulanceCount: int("ambulanceCount").default(0).notNull(),
    foodSupplyStatus: mysqlEnum("foodSupplyStatus", ["available", "limited", "critical", "unavailable"]).default("available").notNull(),
    medicineSupplyStatus: mysqlEnum("medicineSupplyStatus", ["available", "limited", "critical", "unavailable"]).default("available").notNull(),
    waterSupplyStatus: mysqlEnum("waterSupplyStatus", ["available", "limited", "critical", "unavailable"]).default("available").notNull(),
    powerBackupStatus: mysqlEnum("powerBackupStatus", ["available", "limited", "critical", "unavailable"]).default("available").notNull(),
    status: mysqlEnum("status", ["open", "limited", "critical", "closed"]).default("open").notNull(),
    updatedBy: int("updatedBy").references(() => users.id),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("hospitals_status_idx").on(table.status)],
);

export const hospitalRegistrationRequests = mysqlTable(
  "hospitalRegistrationRequests",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id),
    hospitalName: varchar("hospitalName", { length: 180 }).notNull(),
    address: varchar("address", { length: 360 }).notNull(),
    contactPhone: varchar("contactPhone", { length: 32 }).notNull(),
    latitude: double("latitude").notNull(),
    longitude: double("longitude").notNull(),
    note: text("note"),
    status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
    reviewedBy: int("reviewedBy").references(() => users.id),
    reviewNote: text("reviewNote"),
    reviewedAt: timestamp("reviewedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("hospitalRegistrationRequests_userId_unique").on(table.userId), index("hospitalRegistrationRequests_status_createdAt_idx").on(table.status, table.createdAt)],
);

export const hospitalStaffProfiles = mysqlTable(
  "hospitalStaffProfiles",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id),
    hospitalId: int("hospitalId").notNull().references(() => hospitals.id),
    designation: varchar("designation", { length: 120 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("hospitalStaffProfiles_userId_unique").on(table.userId), index("hospitalStaffProfiles_hospitalId_idx").on(table.hospitalId)],
);

export const hospitalCaseNotifications = mysqlTable(
  "hospitalCaseNotifications",
  {
    id: int("id").autoincrement().primaryKey(),
    incidentId: int("incidentId").notNull().references(() => incidents.id),
    hospitalId: int("hospitalId").notNull().references(() => hospitals.id),
    rescuerId: int("rescuerId").notNull().references(() => users.id),
    severity: mysqlEnum("severity", ["critical", "high", "medium", "low"]).default("high").notNull(),
    patientCount: int("patientCount").default(1).notNull(),
    estimatedArrivalMinutes: int("estimatedArrivalMinutes").default(15).notNull(),
    requiredDepartment: varchar("requiredDepartment", { length: 120 }).default("Emergency & Trauma").notNull(),
    icuRequired: mysqlEnum("icuRequired", ["yes", "no"]).default("no").notNull(),
    oxygenRequired: mysqlEnum("oxygenRequired", ["yes", "no"]).default("no").notNull(),
    notes: text("notes"),
    status: mysqlEnum("status", ["notified", "acknowledged", "preparing", "ready", "received", "completed"])
      .default("notified")
      .notNull(),
    hospitalNotes: text("hospitalNotes"),
    acknowledgedAt: timestamp("acknowledgedAt"),
    receivedAt: timestamp("receivedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("hospitalCaseNotifications_hospitalId_status_idx").on(table.hospitalId, table.status),
    index("hospitalCaseNotifications_incidentId_idx").on(table.incidentId),
    index("hospitalCaseNotifications_rescuerId_idx").on(table.rescuerId),
  ],
);

export const floodZones = mysqlTable(
  "floodZones",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 180 }).notNull(),
    severity: mysqlEnum("severity", ["critical", "high", "medium", "low"]).default("medium").notNull(),
    polygonJson: text("polygonJson").notNull(),
    active: mysqlEnum("active", ["yes", "no"]).default("yes").notNull(),
    createdBy: int("createdBy").references(() => users.id),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("floodZones_active_severity_idx").on(table.active, table.severity)],
);

export const notifications = mysqlTable(
  "notifications",
  {
    id: int("id").autoincrement().primaryKey(),
    recipientId: int("recipientId").notNull().references(() => users.id),
    incidentId: int("incidentId").references(() => incidents.id),
    type: mysqlEnum("type", ["mission_assigned", "priority_incident", "status_update"]).notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    body: text("body").notNull(),
    readAt: timestamp("readAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("notifications_recipientId_readAt_idx").on(table.recipientId, table.readAt)],
);

export const guestEmergencyRateLimits = mysqlTable(
  "guestEmergencyRateLimits",
  {
    id: int("id").autoincrement().primaryKey(),
    keyHash: varchar("keyHash", { length: 64 }).notNull(),
    windowStartedAt: timestamp("windowStartedAt").defaultNow().notNull(),
    requestCount: int("requestCount").default(1).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("guestEmergencyRateLimits_keyHash_unique").on(table.keyHash)],
);

export const pushSubscriptions = mysqlTable(
  "pushSubscriptions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id),
    endpointHash: varchar("endpointHash", { length: 64 }).notNull(),
    endpoint: text("endpoint").notNull(),
    p256dh: varchar("p256dh", { length: 512 }).notNull(),
    auth: varchar("auth", { length: 512 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("pushSubscriptions_endpointHash_unique").on(table.endpointHash),
    index("pushSubscriptions_userId_idx").on(table.userId),
  ],
);

export const auditLogs = mysqlTable(
  "auditLogs",
  {
    id: int("id").autoincrement().primaryKey(),
    actorId: int("actorId").references(() => users.id),
    action: varchar("action", { length: 96 }).notNull(),
    resourceType: varchar("resourceType", { length: 64 }).notNull(),
    resourceId: varchar("resourceId", { length: 64 }),
    detail: text("detail"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("auditLogs_resource_idx").on(table.resourceType, table.resourceId)],
);

export const emergencyContacts = mysqlTable(
  "emergencyContacts",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id),
    name: varchar("name", { length: 160 }).notNull(),
    relation: varchar("relation", { length: 64 }).notNull(),
    phone: varchar("phone", { length: 32 }).notNull(),
    alternatePhone: varchar("alternatePhone", { length: 32 }),
    isPrimary: mysqlEnum("isPrimary", ["yes", "no"]).default("no").notNull(),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("emergencyContacts_userId_idx").on(table.userId)],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Incident = typeof incidents.$inferSelect;
export type Mission = typeof missions.$inferSelect;
export type EmergencyContact = typeof emergencyContacts.$inferSelect;
export type InsertEmergencyContact = typeof emergencyContacts.$inferInsert;
export type HospitalCaseNotification = typeof hospitalCaseNotifications.$inferSelect;
export type InsertHospitalCaseNotification = typeof hospitalCaseNotifications.$inferInsert;
