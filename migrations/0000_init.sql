CREATE TABLE `bookmark` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`url` text NOT NULL,
	`domain` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`author` text,
	`content_text` text,
	`content_html` text,
	`content_type` text,
	`content_published_date` text,
	`note` text,
	`main_image_url` text,
	`main_image_id` integer,
	`icon_url` text,
	`icon_id` integer,
	`screenshotId` integer,
	`importance` integer,
	`flagged` integer,
	`read` integer,
	`archived` integer,
	`owner_id` integer NOT NULL,
	`category_id` integer NOT NULL,
	`opened_last` integer,
	`opened_times` integer DEFAULT 0 NOT NULL,
	`created` integer DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated` integer NOT NULL,
	FOREIGN KEY (`main_image_id`) REFERENCES `file`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`icon_id`) REFERENCES `file`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`screenshotId`) REFERENCES `file`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE TABLE `bookmarks_to_tags` (
	`bookmark_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`bookmark_id`, `tag_id`),
	FOREIGN KEY (`bookmark_id`) REFERENCES `bookmark`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tag_id`) REFERENCES `tag`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE TABLE `category` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`color` text,
	`owner_id` integer NOT NULL,
	`parent_id` integer,
	`archived` integer,
	`public` integer,
	`icon` text,
	`initial` integer DEFAULT false NOT NULL,
	`created` integer DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE TABLE `file` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_name` text NOT NULL,
	`storage_type` text NOT NULL,
	`relative_path` text NOT NULL,
	`size` integer,
	`mime-type` text NOT NULL,
	`source` text NOT NULL,
	`owner_id` integer NOT NULL,
	`created` integer DEFAULT (CURRENT_TIMESTAMP),
	`updated` integer,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE TABLE `tag` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`owner_id` integer NOT NULL,
	`created` integer DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE TABLE `user` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`username` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`avatar_id` integer,
	`settings` text DEFAULT '{}' NOT NULL,
	`initial` integer DEFAULT false NOT NULL,
	`disabled` integer,
	`created` integer DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated` integer NOT NULL
);

--> statement-breakpoint
CREATE INDEX `bookmarkt_url_owner_index` ON `bookmark` (`url`, `owner_id`);

--> statement-breakpoint
CREATE INDEX `bookmarkt_title_owner_index` ON `bookmark` (`title`, `owner_id`);

--> statement-breakpoint
CREATE INDEX `bookmarkt_domain_owner_index` ON `bookmark` (`domain`, `owner_id`);

--> statement-breakpoint
CREATE INDEX `bookmarkt_created_owner_index` ON `bookmark` (`created`, `owner_id`);

--> statement-breakpoint
CREATE INDEX `bookmarks_to_tags_bookmark_id_index` ON `bookmarks_to_tags` (`bookmark_id`);

--> statement-breakpoint
CREATE INDEX `categoryt_user_name_index` ON `category` (`owner_id`, `name`);

--> statement-breakpoint
CREATE INDEX `categoryt_user_slug_index` ON `category` (`owner_id`, `slug`);

--> statement-breakpoint
CREATE INDEX `filet_owner_id_index` ON `file` (`owner_id`);

--> statement-breakpoint
CREATE INDEX `tagt_user_name_index` ON `tag` (`owner_id`, `name`);

--> statement-breakpoint
CREATE INDEX `tagt_user_slug_index` ON `tag` (`owner_id`, `slug`);

--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);

--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);

--> statement-breakpoint
CREATE INDEX `usert_name_index` ON `user` (`name`);

--> statement-breakpoint
CREATE INDEX `usert_email_index` ON `user` (`email`);