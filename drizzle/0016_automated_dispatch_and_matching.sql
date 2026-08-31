ALTER TABLE `incidents` ADD COLUMN `requestCategory` enum('medical','rescue','emergency') NOT NULL DEFAULT 'emergency';
--> statement-breakpoint
ALTER TABLE `incidents` ADD COLUMN `triageStartedAt` timestamp NULL;
--> statement-breakpoint
ALTER TABLE `incidents` ADD COLUMN `triageDeadlineAt` timestamp NULL;
--> statement-breakpoint
ALTER TABLE `incidents` ADD COLUMN `triageSelectedAt` timestamp NULL;
--> statement-breakpoint
ALTER TABLE `incidents` ADD COLUMN `dispatchStatus` enum('triage_pending','matching','offered','assigned','escalated','resolved') NOT NULL DEFAULT 'triage_pending';
--> statement-breakpoint
ALTER TABLE `incidents` ADD COLUMN `matchingStartedAt` timestamp NULL;
--> statement-breakpoint
ALTER TABLE `incidents` ADD COLUMN `matchingAttempts` int NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `incidents` ADD COLUMN `escalatedToCommandAt` timestamp NULL;
--> statement-breakpoint
CREATE INDEX `incidents_dispatchStatus_createdAt_idx` ON `incidents` (`dispatchStatus`,`createdAt`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `rescuerCapabilities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`rescuerId` int NOT NULL,
	`capability` enum('medical','flood_rescue','trapped_rescue','evacuation','general_emergency') NOT NULL,
	`priority` int NOT NULL DEFAULT 1,
	`active` enum('yes','no') NOT NULL DEFAULT 'yes',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rescuerCapabilities_id` PRIMARY KEY(`id`),
	CONSTRAINT `rescuerCapabilities_rescuerId_capability_unique` UNIQUE(`rescuerId`,`capability`),
	CONSTRAINT `rescuerCapabilities_rescuerId_users_id_fk` FOREIGN KEY (`rescuerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX `rescuerCapabilities_capability_active_idx` ON `rescuerCapabilities` (`capability`,`active`);
--> statement-breakpoint
CREATE INDEX `rescuerCapabilities_rescuerId_idx` ON `rescuerCapabilities` (`rescuerId`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `missionOffers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`incidentId` int NOT NULL,
	`rescuerId` int NOT NULL,
	`distanceKm` double NOT NULL,
	`matchScore` double NOT NULL,
	`status` enum('offered','accepted','declined','expired','cancelled') NOT NULL DEFAULT 'offered',
	`offeredAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`respondedAt` timestamp NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `missionOffers_id` PRIMARY KEY(`id`),
	CONSTRAINT `missionOffers_incidentId_incidents_id_fk` FOREIGN KEY (`incidentId`) REFERENCES `incidents`(`id`) ON DELETE no action ON UPDATE no action,
	CONSTRAINT `missionOffers_rescuerId_users_id_fk` FOREIGN KEY (`rescuerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX `missionOffers_incidentId_status_idx` ON `missionOffers` (`incidentId`,`status`);
--> statement-breakpoint
CREATE INDEX `missionOffers_rescuerId_status_idx` ON `missionOffers` (`rescuerId`,`status`);
--> statement-breakpoint
CREATE INDEX `missionOffers_expiresAt_status_idx` ON `missionOffers` (`expiresAt`,`status`);
--> statement-breakpoint
-- Seed sensible default capabilities for existing rescuers so existing accounts are fully operational
INSERT IGNORE INTO `rescuerCapabilities` (`rescuerId`, `capability`, `priority`, `active`, `createdAt`, `updatedAt`)
SELECT `id`, 'general_emergency', 1, 'yes', NOW(), NOW() FROM `users` WHERE `role` = 'rescuer';
--> statement-breakpoint
INSERT IGNORE INTO `rescuerCapabilities` (`rescuerId`, `capability`, `priority`, `active`, `createdAt`, `updatedAt`)
SELECT `id`, 'flood_rescue', 1, 'yes', NOW(), NOW() FROM `users` WHERE `role` = 'rescuer';
--> statement-breakpoint
INSERT IGNORE INTO `rescuerCapabilities` (`rescuerId`, `capability`, `priority`, `active`, `createdAt`, `updatedAt`)
SELECT `id`, 'evacuation', 1, 'yes', NOW(), NOW() FROM `users` WHERE `role` = 'rescuer';
