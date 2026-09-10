CREATE TABLE `safetyAssistanceRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requesterId` int NOT NULL,
	`category` enum('shelter','food','medical','protection') NOT NULL,
	`peopleAffected` int NOT NULL DEFAULT 1,
	`details` text,
	`latitude` double NOT NULL,
	`longitude` double NOT NULL,
	`status` enum('new','acknowledged','resolved') NOT NULL DEFAULT 'new',
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `safetyAssistanceRequests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `safetyAssistanceRequests` ADD CONSTRAINT `safetyAssistanceRequests_requesterId_users_id_fk` FOREIGN KEY (`requesterId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `safetyAssistanceRequests` ADD CONSTRAINT `safetyAssistanceRequests_reviewedBy_users_id_fk` FOREIGN KEY (`reviewedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `safetyAssistanceRequests_status_createdAt_idx` ON `safetyAssistanceRequests` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `safetyAssistanceRequests_category_status_idx` ON `safetyAssistanceRequests` (`category`,`status`);