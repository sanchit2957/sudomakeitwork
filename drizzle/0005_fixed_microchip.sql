CREATE TABLE `rescuerRegistrationRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`phone` varchar(32),
	`note` text,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`reviewedBy` int,
	`reviewNote` text,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rescuerRegistrationRequests_id` PRIMARY KEY(`id`),
	CONSTRAINT `rescuerRegistrationRequests_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `rescuerRegistrationRequests` ADD CONSTRAINT `rescuerRegistrationRequests_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rescuerRegistrationRequests` ADD CONSTRAINT `rescuerRegistrationRequests_reviewedBy_users_id_fk` FOREIGN KEY (`reviewedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `rescuerRegistrationRequests_status_createdAt_idx` ON `rescuerRegistrationRequests` (`status`,`createdAt`);