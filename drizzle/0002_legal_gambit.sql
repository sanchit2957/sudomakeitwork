CREATE TABLE `guestEmergencyRateLimits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`keyHash` varchar(64) NOT NULL,
	`windowStartedAt` timestamp NOT NULL DEFAULT (now()),
	`requestCount` int NOT NULL DEFAULT 1,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `guestEmergencyRateLimits_id` PRIMARY KEY(`id`),
	CONSTRAINT `guestEmergencyRateLimits_keyHash_unique` UNIQUE(`keyHash`)
);
