CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`lookup` text NOT NULL,
	`start` text NOT NULL,
	`model` text NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`wedding` text NOT NULL,
	`status` text NOT NULL,
	`notify` integer NOT NULL,
	`delivery` text NOT NULL,
	FOREIGN KEY (`start`) REFERENCES `slots`(`start`) ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX `bookings_lookup_unique` ON `bookings` (`lookup`);
CREATE UNIQUE INDEX `one_booking` ON `bookings` (`start`) WHERE status IN ('pending','confirmed');
CREATE TABLE `counts` (
	`day` text PRIMARY KEY NOT NULL,
	`tries` integer NOT NULL
);

CREATE TABLE `docs` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL
);

CREATE TABLE `jobs` (
	`key` text PRIMARY KEY NOT NULL,
	`remote` text NOT NULL,
	`model` text NOT NULL,
	`state` text NOT NULL,
	`image` text,
	`expires` integer NOT NULL
);

CREATE TABLE `limits` (
	`id` text PRIMARY KEY NOT NULL,
	`used` integer NOT NULL,
	`expires` integer NOT NULL
);

CREATE TABLE `slots` (
	`start` text PRIMARY KEY NOT NULL,
	`enabled` integer NOT NULL
);
