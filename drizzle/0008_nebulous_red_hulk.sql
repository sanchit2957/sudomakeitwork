CREATE TABLE `incidentMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`incidentId` int NOT NULL,
	`authorType` enum('victim','rescuer','operations') NOT NULL,
	`authorId` int,
	`message` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `incidentMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `incidentMessages` ADD CONSTRAINT `incidentMessages_incidentId_incidents_id_fk` FOREIGN KEY (`incidentId`) REFERENCES `incidents`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `incidentMessages` ADD CONSTRAINT `incidentMessages_authorId_users_id_fk` FOREIGN KEY (`authorId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `incidentMessages_incidentId_createdAt_idx` ON `incidentMessages` (`incidentId`,`createdAt`);