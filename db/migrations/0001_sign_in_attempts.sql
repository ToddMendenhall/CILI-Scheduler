CREATE TABLE IF NOT EXISTS "sign_in_attempts" (
	"key" varchar(400) PRIMARY KEY NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sign_in_attempts_window_idx" ON "sign_in_attempts" USING btree ("window_start");