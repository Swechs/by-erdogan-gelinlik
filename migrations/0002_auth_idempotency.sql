-- Saved booking responses so a retried submission returns the same booking instead of a conflict.
CREATE TABLE `requests` (
	`id` text PRIMARY KEY NOT NULL,
	`response` text NOT NULL,
	`expires` integer NOT NULL
);
