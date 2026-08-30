CREATE TABLE `hospitalRegistrationRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`hospitalName` varchar(180) NOT NULL,
	`address` varchar(360) NOT NULL,
	`contactPhone` varchar(32) NOT NULL,
	`latitude` double NOT NULL,
	`longitude` double NOT NULL,
	`note` text,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`reviewedBy` int,
	`reviewNote` text,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `hospitalRegistrationRequests_id` PRIMARY KEY(`id`),
	CONSTRAINT `hospitalRegistrationRequests_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `hospitalStaffProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`hospitalId` int NOT NULL,
	`designation` varchar(120),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `hospitalStaffProfiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `hospitalStaffProfiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `hospitals` ADD `foodSupplyStatus` enum('available','limited','critical','unavailable') DEFAULT 'available' NOT NULL;--> statement-breakpoint
ALTER TABLE `hospitals` ADD `medicineSupplyStatus` enum('available','limited','critical','unavailable') DEFAULT 'available' NOT NULL;--> statement-breakpoint
ALTER TABLE `hospitals` ADD `waterSupplyStatus` enum('available','limited','critical','unavailable') DEFAULT 'available' NOT NULL;--> statement-breakpoint
ALTER TABLE `hospitals` ADD `powerBackupStatus` enum('available','limited','critical','unavailable') DEFAULT 'available' NOT NULL;--> statement-breakpoint
ALTER TABLE `hospitalRegistrationRequests` ADD CONSTRAINT `hospitalRegistrationRequests_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `hospitalRegistrationRequests` ADD CONSTRAINT `hospitalRegistrationRequests_reviewedBy_users_id_fk` FOREIGN KEY (`reviewedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `hospitalStaffProfiles` ADD CONSTRAINT `hospitalStaffProfiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `hospitalStaffProfiles` ADD CONSTRAINT `hospitalStaffProfiles_hospitalId_hospitals_id_fk` FOREIGN KEY (`hospitalId`) REFERENCES `hospitals`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `hospitalRegistrationRequests_status_createdAt_idx` ON `hospitalRegistrationRequests` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `hospitalStaffProfiles_hospitalId_idx` ON `hospitalStaffProfiles` (`hospitalId`);