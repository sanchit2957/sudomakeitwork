CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorId` int,
	`action` varchar(96) NOT NULL,
	`resourceType` varchar(64) NOT NULL,
	`resourceId` varchar(64),
	`detail` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `floodZones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`severity` enum('critical','high','medium','low') NOT NULL DEFAULT 'medium',
	`polygonJson` text NOT NULL,
	`active` enum('yes','no') NOT NULL DEFAULT 'yes',
	`createdBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `floodZones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `incidentEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`incidentId` int NOT NULL,
	`actorId` int,
	`eventType` varchar(64) NOT NULL,
	`title` varchar(180) NOT NULL,
	`detail` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `incidentEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `incidents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicCode` varchar(24) NOT NULL,
	`reporterId` int,
	`contactName` varchar(160),
	`locationLabel` varchar(360) NOT NULL,
	`latitude` double NOT NULL,
	`longitude` double NOT NULL,
	`emergencyType` enum('flood','medical','trapped','evacuation','other') NOT NULL,
	`severity` enum('critical','high','medium','low') NOT NULL DEFAULT 'medium',
	`peopleAffected` int NOT NULL DEFAULT 1,
	`notes` text,
	`evidenceKey` varchar(512),
	`evidenceUrl` varchar(1024),
	`status` enum('pending','dispatched','resolved') NOT NULL DEFAULT 'pending',
	`assignedRescuerId` int,
	`dispatchedAt` timestamp,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `incidents_id` PRIMARY KEY(`id`),
	CONSTRAINT `incidents_publicCode_unique` UNIQUE(`publicCode`)
);
--> statement-breakpoint
CREATE TABLE `missions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`incidentId` int NOT NULL,
	`rescuerId` int NOT NULL,
	`status` enum('pending','dispatched','resolved') NOT NULL DEFAULT 'pending',
	`assignedBy` int NOT NULL,
	`assignedAt` timestamp NOT NULL DEFAULT (now()),
	`dispatchedAt` timestamp,
	`resolvedAt` timestamp,
	`notes` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `missions_id` PRIMARY KEY(`id`),
	CONSTRAINT `missions_incidentId_unique` UNIQUE(`incidentId`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recipientId` int NOT NULL,
	`incidentId` int,
	`type` enum('mission_assigned','priority_incident','status_update') NOT NULL,
	`title` varchar(180) NOT NULL,
	`body` text NOT NULL,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rescueProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`callSign` varchar(96) NOT NULL,
	`phone` varchar(32),
	`availability` enum('available','on_mission','off_duty') NOT NULL DEFAULT 'available',
	`lastLatitude` double,
	`lastLongitude` double,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rescueProfiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `rescueProfiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `shelters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`address` varchar(360) NOT NULL,
	`latitude` double NOT NULL,
	`longitude` double NOT NULL,
	`capacity` int NOT NULL DEFAULT 0,
	`occupancy` int NOT NULL DEFAULT 0,
	`status` enum('open','limited','closed') NOT NULL DEFAULT 'open',
	`createdBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shelters_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','rescuer','admin') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `auditLogs` ADD CONSTRAINT `auditLogs_actorId_users_id_fk` FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `floodZones` ADD CONSTRAINT `floodZones_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `incidentEvents` ADD CONSTRAINT `incidentEvents_incidentId_incidents_id_fk` FOREIGN KEY (`incidentId`) REFERENCES `incidents`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `incidentEvents` ADD CONSTRAINT `incidentEvents_actorId_users_id_fk` FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `incidents` ADD CONSTRAINT `incidents_reporterId_users_id_fk` FOREIGN KEY (`reporterId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `incidents` ADD CONSTRAINT `incidents_assignedRescuerId_users_id_fk` FOREIGN KEY (`assignedRescuerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `missions` ADD CONSTRAINT `missions_incidentId_incidents_id_fk` FOREIGN KEY (`incidentId`) REFERENCES `incidents`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `missions` ADD CONSTRAINT `missions_rescuerId_users_id_fk` FOREIGN KEY (`rescuerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `missions` ADD CONSTRAINT `missions_assignedBy_users_id_fk` FOREIGN KEY (`assignedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_recipientId_users_id_fk` FOREIGN KEY (`recipientId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_incidentId_incidents_id_fk` FOREIGN KEY (`incidentId`) REFERENCES `incidents`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rescueProfiles` ADD CONSTRAINT `rescueProfiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shelters` ADD CONSTRAINT `shelters_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `auditLogs_resource_idx` ON `auditLogs` (`resourceType`,`resourceId`);--> statement-breakpoint
CREATE INDEX `floodZones_active_severity_idx` ON `floodZones` (`active`,`severity`);--> statement-breakpoint
CREATE INDEX `incidentEvents_incidentId_createdAt_idx` ON `incidentEvents` (`incidentId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `incidents_status_createdAt_idx` ON `incidents` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `incidents_assignedRescuerId_status_idx` ON `incidents` (`assignedRescuerId`,`status`);--> statement-breakpoint
CREATE INDEX `missions_rescuerId_status_idx` ON `missions` (`rescuerId`,`status`);--> statement-breakpoint
CREATE INDEX `notifications_recipientId_readAt_idx` ON `notifications` (`recipientId`,`readAt`);--> statement-breakpoint
CREATE INDEX `shelters_status_idx` ON `shelters` (`status`);