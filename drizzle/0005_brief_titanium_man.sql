CREATE TABLE `campaign_operators` (
	`campaign_id` text NOT NULL,
	`operator_id` text NOT NULL,
	PRIMARY KEY(`campaign_id`, `operator_id`),
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`operator_id`) REFERENCES `property_operators`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_campaign_operators_operator_id` ON `campaign_operators` (`operator_id`);--> statement-breakpoint
CREATE TABLE `campaign_rates` (
	`campaign_id` text NOT NULL,
	`rate_id` text NOT NULL,
	PRIMARY KEY(`campaign_id`, `rate_id`),
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`rate_id`) REFERENCES `property_rates`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_campaign_rates_rate_id` ON `campaign_rates` (`rate_id`);--> statement-breakpoint
CREATE TABLE `property_operators` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_property_operators_property_id` ON `property_operators` (`property_id`);--> statement-breakpoint
CREATE TABLE `property_rates` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_property_rates_property_id` ON `property_rates` (`property_id`);
--> statement-breakpoint
INSERT OR IGNORE INTO property_rates (id,property_id,name,code) SELECT json_extract(r.value,'$.id'),p.id,COALESCE(json_extract(r.value,'$.name'),''),COALESCE(json_extract(r.value,'$.code'),'') FROM properties p,json_each(p.payload,'$.rates') r;
--> statement-breakpoint
INSERT OR IGNORE INTO property_operators (id,property_id,name) SELECT json_extract(o.value,'$.id'),p.id,COALESCE(json_extract(o.value,'$.name'),'') FROM properties p,json_each(p.payload,'$.operators') o;
--> statement-breakpoint
INSERT OR IGNORE INTO campaign_rates (campaign_id,rate_id) SELECT c.id,r.value FROM campaigns c,json_each(c.payload,'$.rateIds') r WHERE EXISTS (SELECT 1 FROM property_rates x WHERE x.id=r.value);
--> statement-breakpoint
INSERT OR IGNORE INTO campaign_operators (campaign_id,operator_id) SELECT DISTINCT c.id,po.id FROM campaigns c,json_each(c.payload,'$.operators') n JOIN campaign_properties cp ON cp.campaign_id=c.id JOIN property_operators po ON po.property_id=cp.property_id AND lower(trim(po.name))=lower(trim(n.value));
