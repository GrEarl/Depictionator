-- Add showPathOrder to Map for persistent path numbering toggle
ALTER TABLE "Map"
ADD COLUMN IF NOT EXISTS "showPathOrder" BOOLEAN NOT NULL DEFAULT false;
