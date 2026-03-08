-- Improve query performance for the most frequent workout and set access patterns
CREATE INDEX IF NOT EXISTS "Workout_userId_completedAt_idx"
ON "Workout"("userId", "completedAt" DESC);

CREATE INDEX IF NOT EXISTS "Set_workoutId_idx"
ON "Set"("workoutId");

CREATE INDEX IF NOT EXISTS "Set_movementId_workoutId_idx"
ON "Set"("movementId", "workoutId");
