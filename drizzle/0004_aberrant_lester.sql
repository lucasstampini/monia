CREATE TABLE `allocation_targets` (
	`kraken_class` text PRIMARY KEY NOT NULL,
	`target_percent` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `investment_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`investment_id` integer NOT NULL,
	`date` text NOT NULL,
	`balance_cents` integer NOT NULL,
	FOREIGN KEY (`investment_id`) REFERENCES `investments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `investment_snapshots_day` ON `investment_snapshots` (`investment_id`,`date`);--> statement-breakpoint
CREATE TABLE `investments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`external_id` text NOT NULL,
	`source_item_id` text,
	`institution` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`subtype` text,
	`kraken_class_override` text,
	`balance_cents` integer NOT NULL,
	`invested_cents` integer,
	`profit_cents` integer,
	`last_twelve_months_rate` real,
	`last_month_rate` real,
	`rate` real,
	`rate_type` text,
	`fixed_annual_rate` real,
	`due_date` text,
	`status` text,
	`updated_at` text,
	`last_seen_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `investments_external_id_unique` ON `investments` (`external_id`);