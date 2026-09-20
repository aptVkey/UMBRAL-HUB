CREATE TABLE `operator_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`size` integer NOT NULL,
	`type` text NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `operator_messages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_operator_attachments_message` ON `operator_attachments` (`message_id`);--> statement-breakpoint
CREATE TABLE `operator_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`operator_id` text NOT NULL,
	`property_id` text,
	`reply_to_id` text,
	`author_email` text NOT NULL,
	`author_name` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`operator_id`) REFERENCES `operators`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_operator_messages_operator` ON `operator_messages` (`operator_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `operator_properties` (
	`operator_id` text NOT NULL,
	`property_id` text NOT NULL,
	PRIMARY KEY(`operator_id`, `property_id`),
	FOREIGN KEY (`operator_id`) REFERENCES `operators`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_operator_properties_property_id` ON `operator_properties` (`property_id`);--> statement-breakpoint
CREATE TABLE `operators` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`payload` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	`last_write_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `_op_map` AS SELECT k, name, lower(substr(h,1,8)||'-'||substr(h,9,4)||'-4'||substr(h,14,3)||'-a'||substr(h,18,3)||'-'||substr(h,21,12)) AS id FROM (SELECT lower(trim(name)) AS k, MIN(trim(name)) AS name, hex(randomblob(16)) AS h FROM property_operators WHERE trim(name)<>'' GROUP BY lower(trim(name)));--> statement-breakpoint
INSERT INTO `operators` (id,name,payload,version,updated_at,last_write_id) SELECT id,name,json_object('id',id,'version',1,'name',name,'status','Ativo','type','Outro'),1,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'migrated' FROM `_op_map`;--> statement-breakpoint
INSERT OR IGNORE INTO `operator_properties` (operator_id,property_id) SELECT m.id,po.property_id FROM property_operators po JOIN `_op_map` m ON m.k=lower(trim(po.name));--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_campaign_operators` (
	`campaign_id` text NOT NULL,
	`operator_id` text NOT NULL,
	PRIMARY KEY(`campaign_id`, `operator_id`),
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`operator_id`) REFERENCES `operators`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT OR IGNORE INTO `__new_campaign_operators`("campaign_id", "operator_id") SELECT co.campaign_id, m.id FROM `campaign_operators` co JOIN property_operators po ON po.id=co.operator_id JOIN `_op_map` m ON m.k=lower(trim(po.name));--> statement-breakpoint
DROP TABLE `campaign_operators`;--> statement-breakpoint
ALTER TABLE `__new_campaign_operators` RENAME TO `campaign_operators`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_campaign_operators_operator_id` ON `campaign_operators` (`operator_id`);--> statement-breakpoint
DROP TABLE `_op_map`;
