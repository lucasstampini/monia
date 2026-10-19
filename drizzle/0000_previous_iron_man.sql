CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`institution` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`pluggy_item_id` text,
	`external_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_external_id_unique` ON `accounts` (`external_id`);--> statement-breakpoint
CREATE TABLE `ai_cache` (
	`description_norm` text PRIMARY KEY NOT NULL,
	`category_id` integer,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`parent_id` integer,
	`color` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_name_unique` ON `categories` (`name`);--> statement-breakpoint
CREATE TABLE `imports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`file_name` text,
	`imported_at` text NOT NULL,
	`tx_count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pattern` text NOT NULL,
	`match_type` text NOT NULL,
	`category_id` integer NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`origin` text NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `statements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`ref_month` text NOT NULL,
	`close_date` text,
	`due_date` text NOT NULL,
	`total_cents` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `statements_account_month` ON `statements` (`account_id`,`ref_month`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`source` text NOT NULL,
	`external_id` text,
	`date` text NOT NULL,
	`description_raw` text NOT NULL,
	`description_norm` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`installment_current` integer,
	`installment_total` integer,
	`statement_month` text,
	`category_id` integer,
	`category_source` text,
	`dedup_hash` text NOT NULL,
	`import_id` integer,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`import_id`) REFERENCES `imports`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_dedup_hash_unique` ON `transactions` (`dedup_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_source_external_id` ON `transactions` (`source`,`external_id`);--> statement-breakpoint
CREATE INDEX `transactions_date` ON `transactions` (`date`);--> statement-breakpoint
CREATE INDEX `transactions_description_norm` ON `transactions` (`description_norm`);