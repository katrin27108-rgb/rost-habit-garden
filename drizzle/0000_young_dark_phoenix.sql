CREATE TABLE `gardens` (
	`email` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`display_name` text NOT NULL,
	`habits_json` text DEFAULT '[]' NOT NULL,
	`total_completions` integer DEFAULT 0 NOT NULL,
	`best_streak` integer DEFAULT 0 NOT NULL,
	`garden_stage` integer DEFAULT 1 NOT NULL,
	`is_public` integer DEFAULT true NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gardens_public_id_unique` ON `gardens` (`public_id`);