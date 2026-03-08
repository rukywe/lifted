CREATE TABLE `advisors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `availability_windows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`advisorId` text NOT NULL,
	`startTime` text NOT NULL,
	`endTime` text NOT NULL,
	FOREIGN KEY (`advisorId`) REFERENCES `advisors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`advisorId` text NOT NULL,
	`candidateName` text NOT NULL,
	`visaType` text NOT NULL,
	`startTime` text NOT NULL,
	`endTime` text NOT NULL,
	`status` text NOT NULL,
	`holdExpiresAt` text,
	`confirmedAt` text,
	`createdAt` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`advisorId`) REFERENCES `advisors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_advisor_start` ON `bookings` (`advisorId`,`startTime`);--> statement-breakpoint
CREATE TABLE `idempotency_keys` (
	`key` text PRIMARY KEY NOT NULL,
	`response` text NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `waitlist` (
	`id` text PRIMARY KEY NOT NULL,
	`candidateName` text NOT NULL,
	`visaType` text NOT NULL,
	`status` text NOT NULL,
	`offeredSlotId` text,
	`offerExpiresAt` text,
	`position` integer NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`offeredSlotId`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
