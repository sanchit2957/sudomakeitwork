ALTER TABLE `rescueProfiles` ADD `photoKey` varchar(512);--> statement-breakpoint
ALTER TABLE `rescueProfiles` ADD `photoUrl` varchar(1024);--> statement-breakpoint
ALTER TABLE `rescueProfiles` ADD `contactSharing` enum('yes','no') DEFAULT 'no' NOT NULL;--> statement-breakpoint
ALTER TABLE `rescueProfiles` ADD `locationSharing` enum('yes','no') DEFAULT 'no' NOT NULL;--> statement-breakpoint
ALTER TABLE `rescueProfiles` ADD `locationUpdatedAt` timestamp;