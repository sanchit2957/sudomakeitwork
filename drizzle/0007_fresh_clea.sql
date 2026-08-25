ALTER TABLE `incidents` ADD `voiceNoteKey` varchar(512);--> statement-breakpoint
ALTER TABLE `incidents` ADD `voiceNoteUrl` varchar(1024);--> statement-breakpoint
ALTER TABLE `incidents` ADD `voiceNoteDurationSeconds` int;