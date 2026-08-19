CREATE TABLE `hospitals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`address` varchar(360) NOT NULL,
	`contactPhone` varchar(32),
	`latitude` double NOT NULL,
	`longitude` double NOT NULL,
	`totalEmergencyBeds` int NOT NULL DEFAULT 0,
	`availableEmergencyBeds` int NOT NULL DEFAULT 0,
	`totalIcuBeds` int NOT NULL DEFAULT 0,
	`availableIcuBeds` int NOT NULL DEFAULT 0,
	`oxygenCylinderCount` int NOT NULL DEFAULT 0,
	`bloodUnitCount` int NOT NULL DEFAULT 0,
	`ambulanceCount` int NOT NULL DEFAULT 0,
	`status` enum('open','limited','critical','closed') NOT NULL DEFAULT 'open',
	`updatedBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `hospitals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `hospitals` ADD CONSTRAINT `hospitals_updatedBy_users_id_fk` FOREIGN KEY (`updatedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `hospitals_status_idx` ON `hospitals` (`status`);