CREATE TABLE `garden_access` (
	`owner_email` text NOT NULL,
	`visitor_email` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`owner_email`, `visitor_email`)
);
