CREATE TABLE `corporate_properties` (
	`corporate_id` text NOT NULL,
	`property_id` text NOT NULL,
	PRIMARY KEY(`corporate_id`, `property_id`),
	FOREIGN KEY (`corporate_id`) REFERENCES `corporates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_corporate_properties_property_id` ON `corporate_properties` (`property_id`);--> statement-breakpoint
CREATE TABLE `corporates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`payload` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	`last_write_id` text NOT NULL,
	`contract` text
);
