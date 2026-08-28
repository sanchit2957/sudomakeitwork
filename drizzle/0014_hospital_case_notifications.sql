CREATE TABLE IF NOT EXISTS `hospitalCaseNotifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`incidentId` int NOT NULL,
	`hospitalId` int NOT NULL,
	`rescuerId` int NOT NULL,
	`severity` enum('critical','high','medium','low') NOT NULL DEFAULT 'high',
	`patientCount` int NOT NULL DEFAULT 1,
	`estimatedArrivalMinutes` int NOT NULL DEFAULT 15,
	`requiredDepartment` varchar(120) NOT NULL DEFAULT 'Emergency & Trauma',
	`icuRequired` enum('yes','no') NOT NULL DEFAULT 'no',
	`oxygenRequired` enum('yes','no') NOT NULL DEFAULT 'no',
	`notes` text,
	`status` enum('notified','acknowledged','preparing','ready','received','completed') NOT NULL DEFAULT 'notified',
	`hospitalNotes` text,
	`acknowledgedAt` timestamp,
	`receivedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `hospitalCaseNotifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `hospitalCaseNotifications_incidentId_incidents_id_fk` FOREIGN KEY (`incidentId`) REFERENCES `incidents`(`id`) ON DELETE no action ON UPDATE no action,
	CONSTRAINT `hospitalCaseNotifications_hospitalId_hospitals_id_fk` FOREIGN KEY (`hospitalId`) REFERENCES `hospitals`(`id`) ON DELETE no action ON UPDATE no action,
	CONSTRAINT `hospitalCaseNotifications_rescuerId_users_id_fk` FOREIGN KEY (`rescuerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX `hospitalCaseNotifications_hospitalId_status_idx` ON `hospitalCaseNotifications` (`hospitalId`,`status`);
--> statement-breakpoint
CREATE INDEX `hospitalCaseNotifications_incidentId_idx` ON `hospitalCaseNotifications` (`incidentId`);
--> statement-breakpoint
CREATE INDEX `hospitalCaseNotifications_rescuerId_idx` ON `hospitalCaseNotifications` (`rescuerId`);
