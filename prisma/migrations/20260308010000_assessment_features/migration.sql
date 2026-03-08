-- Add user ownership and bodyweight support to movements
ALTER TABLE "Movement" ADD COLUMN "userId" TEXT;
ALTER TABLE "Movement" ADD COLUMN "isBodyweight" BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing movements to first available user to keep legacy data reachable
UPDATE "Movement"
SET "userId" = (
  SELECT "id"
  FROM "User"
  ORDER BY "createdAt" ASC
  LIMIT 1
)
WHERE "userId" IS NULL;

-- If there are no users yet, remove orphaned movements (legacy bootstrap data)
DELETE FROM "Movement" WHERE "userId" IS NULL;

ALTER TABLE "Movement" ALTER COLUMN "userId" SET NOT NULL;

ALTER TABLE "Movement"
ADD CONSTRAINT "Movement_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Movement_userId_name_key" ON "Movement"("userId", "name");
CREATE INDEX "Movement_userId_isBodyweight_idx" ON "Movement"("userId", "isBodyweight");

-- Track user bodyweight over time
CREATE TABLE "BodyWeightEntry" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "weight" INTEGER NOT NULL,
  "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BodyWeightEntry_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BodyWeightEntry"
ADD CONSTRAINT "BodyWeightEntry_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "BodyWeightEntry_userId_measuredAt_idx" ON "BodyWeightEntry"("userId", "measuredAt" DESC);
