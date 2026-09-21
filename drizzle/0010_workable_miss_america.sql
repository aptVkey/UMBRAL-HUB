CREATE TABLE `unit_keysafes` (
	`unit_id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`code` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_unit_keysafes_property_id` ON `unit_keysafes` (`property_id`);