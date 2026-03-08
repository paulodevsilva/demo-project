-- Ensure only one active workout (completedAt IS NULL) exists per user.
WITH ranked_active AS (
  SELECT
    "id",
    "userId",
    ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "id") AS rn
  FROM "Workout"
  WHERE "completedAt" IS NULL
)
UPDATE "Workout" w
SET "completedAt" = CURRENT_TIMESTAMP
FROM ranked_active r
WHERE w."id" = r."id"
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "Workout_userId_active_unique_idx"
ON "Workout"("userId")
WHERE "completedAt" IS NULL;
