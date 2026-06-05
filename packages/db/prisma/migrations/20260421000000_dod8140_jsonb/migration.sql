-- Change dod_8140 from BOOLEAN to JSONB to store full compliance object
ALTER TABLE "users" ALTER COLUMN "dod_8140" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "dod_8140" TYPE JSONB USING "dod_8140"::text::jsonb;
ALTER TABLE "users" ALTER COLUMN "dod_8140" DROP NOT NULL;
