CREATE TABLE `campaign_properties` (
	`campaign_id` text NOT NULL,
	`property_id` text NOT NULL,
	PRIMARY KEY(`campaign_id`, `property_id`),
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_campaign_properties_property_id` ON `campaign_properties` (`property_id`);--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`payload` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	`last_write_id` text NOT NULL
);
