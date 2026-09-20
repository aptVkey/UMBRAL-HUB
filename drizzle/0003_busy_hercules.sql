CREATE TABLE `collaborator_results` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`date` text NOT NULL,
	`bookings` integer NOT NULL,
	`nights` integer NOT NULL,
	`revenue_cents` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `collaborators`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_collaborator_results_owner` ON `collaborator_results` (`owner_id`,`date`);--> statement-breakpoint
CREATE TABLE `collaborators` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`payload` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	`promo_code` text,
	`share_token` text
);
--> statement-breakpoint
CREATE INDEX `idx_collaborators_kind` ON `collaborators` (`kind`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_collaborators_promo_code` ON `collaborators` (`promo_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_collaborators_share_token` ON `collaborators` (`share_token`);