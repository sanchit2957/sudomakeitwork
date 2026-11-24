ALTER TABLE `incidents` ADD COLUMN `bleBeaconId` varchar(16) NULL;
--> statement-breakpoint
CREATE INDEX `incidents_bleBeaconId_idx` ON `incidents` (`bleBeaconId`);
