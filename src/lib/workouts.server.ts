import { createServerFn } from "@tanstack/react-start";
import { getServerSidePrismaClient } from "@/lib/db.server";
import { authMiddleware } from "@/lib/auth.server";
import { z } from "zod";
import { withObservation } from "@/lib/observability.server";

export const createWorkoutServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) =>
    withObservation("workouts.create", async (observation) => {
      observation.setUserId(context.user.id);
      const prisma = await getServerSidePrismaClient();
      try {
        const workout = await prisma.workout.create({
          data: {
            userId: context.user.id,
          },
        });
        observation.addMeta({ outcome: "created" });
        return { success: true, workout };
      } catch (error) {
        // Guard against concurrent create requests when an active workout already exists.
        if ((error as { code?: string } | undefined)?.code !== "P2002") {
          throw error;
        }
        const existingWorkout = await prisma.workout.findFirst({
          where: { userId: context.user.id, completedAt: null },
        });
        if (!existingWorkout) {
          throw error;
        }
        observation.addMeta({ outcome: "already_active" });
        return { success: true, workout: existingWorkout };
      }
    }),
  );

export const getCurrentWorkoutServerFn = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) =>
    withObservation("workouts.getCurrent", async (observation) => {
      observation.setUserId(context.user.id);
      const prisma = await getServerSidePrismaClient();
      const workout = await prisma.workout.findFirst({
        where: { userId: context.user.id, completedAt: null },
        include: {
          sets: {
            select: {
              id: true,
              reps: true,
              weight: true,
              movement: {
                select: {
                  id: true,
                  name: true,
                  isBodyweight: true,
                },
              },
            },
          },
        },
      });
      observation.addMeta({ hasActiveWorkout: Boolean(workout) });
      return workout;
    }),
  );

export const completeWorkoutServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) =>
    withObservation("workouts.complete", async (observation) => {
      observation.setUserId(context.user.id);
      const prisma = await getServerSidePrismaClient();

      const updated = await prisma.workout.updateMany({
        where: { userId: context.user.id, completedAt: null },
        data: { completedAt: new Date() },
      });

      if (updated.count === 0) {
        observation.addMeta({ outcome: "not_found" });
        return { success: false, error: "No active workout to complete" };
      }

      observation.addMeta({ outcome: "success", completed: updated.count });
      return { success: true };
    }),
  );

export const addSetServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ movementId: z.string(), reps: z.number().min(1), weight: z.number().min(0).optional() }))
  .handler(
    async ({
      context,
      data,
    }: {
      context: { user: { id: string } };
      data: { movementId: string; reps: number; weight?: number };
    }) =>
      withObservation("workouts.addSet", async (observation) => {
        observation.setUserId(context.user.id);
        const prisma = await getServerSidePrismaClient();

        const result = await prisma.$transaction(async (tx) => {
          const workout = await tx.workout.findFirst({
            where: { userId: context.user.id, completedAt: null },
            select: { id: true },
          });

          if (!workout) {
            return { success: false as const, error: "No active workout", outcome: "no_active_workout" as const };
          }

          const movement = await tx.movement.findFirst({
            where: { id: data.movementId, userId: context.user.id },
            select: { id: true, isBodyweight: true },
          });

          if (!movement) {
            return { success: false as const, error: "Movement not found", outcome: "movement_not_found" as const };
          }

          let resolvedWeight = data.weight;

          if (movement.isBodyweight && typeof resolvedWeight !== "number") {
            const latestBodyWeight = await tx.bodyWeightEntry.findFirst({
              where: { userId: context.user.id },
              orderBy: { measuredAt: "desc" },
              select: { weight: true },
            });

            if (!latestBodyWeight) {
              return {
                success: false as const,
                error: "Add a bodyweight entry before logging this movement.",
                outcome: "missing_bodyweight_entry" as const,
              };
            }

            resolvedWeight = latestBodyWeight.weight;
          }

          if (typeof resolvedWeight !== "number") {
            return { success: false as const, error: "Weight is required", outcome: "missing_weight" as const };
          }

          const set = await tx.set.create({
            data: {
              workoutId: workout.id,
              movementId: data.movementId,
              reps: data.reps,
              weight: resolvedWeight,
            },
            select: {
              id: true,
              reps: true,
              weight: true,
              movement: {
                select: {
                  id: true,
                  name: true,
                  isBodyweight: true,
                },
              },
            },
          });

          return { success: true as const, set, outcome: "success" as const };
        });

        observation.addMeta({ outcome: result.outcome });

        if (!result.success) {
          return { success: false as const, error: result.error };
        }

        return { success: true as const, set: result.set };
      }),
  );

export const deleteSetServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ setId: z.string() }))
  .handler(async ({ context, data }: { context: { user: { id: string } }; data: { setId: string } }) =>
    withObservation("workouts.deleteSet", async (observation) => {
      observation.setUserId(context.user.id);
      const prisma = await getServerSidePrismaClient();
      const set = await prisma.set.findFirst({
        where: { id: data.setId, workout: { userId: context.user.id, completedAt: null } },
      });
      if (!set) {
        observation.addMeta({ outcome: "set_not_found" });
        return { success: false, error: "Set not found" };
      }
      await prisma.set.delete({ where: { id: data.setId } });
      observation.addMeta({ outcome: "success" });
      return { success: true };
    }),
  );

export const getWorkoutHistoryServerFn = createServerFn()
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
    }),
  )
  .handler(async ({ context, data }: { context: { user: { id: string } }; data: { page: number; pageSize: number } }) =>
    withObservation("workouts.getHistory", async (observation) => {
      observation.setUserId(context.user.id);
      const prisma = await getServerSidePrismaClient();
      const [totalCount, workouts] = await prisma.$transaction([
        prisma.workout.count({
          where: { userId: context.user.id, completedAt: { not: null } },
        }),
        prisma.workout.findMany({
          where: { userId: context.user.id, completedAt: { not: null } },
          orderBy: { completedAt: "desc" },
          skip: (data.page - 1) * data.pageSize,
          take: data.pageSize,
          include: {
            sets: {
              select: {
                id: true,
                reps: true,
                weight: true,
                movement: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        }),
      ]);

      const totalPages = Math.max(1, Math.ceil(totalCount / data.pageSize));
      observation.addMeta({ page: data.page, pageSize: data.pageSize, returned: workouts.length, totalCount });

      return {
        items: workouts,
        pagination: {
          page: data.page,
          pageSize: data.pageSize,
          totalCount,
          totalPages,
          hasNextPage: data.page < totalPages,
          hasPreviousPage: data.page > 1,
        },
      };
    }),
  );

export const deleteWorkoutsServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ workoutIds: z.array(z.string()) }))
  .handler(async ({ context, data }: { context: { user: { id: string } }; data: { workoutIds: string[] } }) =>
    withObservation("workouts.deleteMany", async (observation) => {
      observation.setUserId(context.user.id);
      observation.addMeta({ requestedDeletes: data.workoutIds.length });
      const prisma = await getServerSidePrismaClient();

      await prisma.$transaction([
        prisma.set.deleteMany({
          where: { workout: { id: { in: data.workoutIds }, userId: context.user.id } },
        }),
        prisma.workout.deleteMany({
          where: { id: { in: data.workoutIds }, userId: context.user.id },
        }),
      ]);

      return { success: true };
    }),
  );

export const getMovementProgressionServerFn = createServerFn()
  .middleware([authMiddleware])
  .inputValidator(z.object({ movementId: z.string(), metric: z.enum(["max_weight", "total_reps", "total_volume"]) }))
  .handler(
    async ({
      context,
      data,
    }: {
      context: { user: { id: string } };
      data: { movementId: string; metric: "max_weight" | "total_reps" | "total_volume" };
    }) =>
      withObservation("workouts.getMovementProgression", async (observation) => {
        observation.setUserId(context.user.id);
        observation.addMeta({ metric: data.metric });
        const prisma = await getServerSidePrismaClient();

        type ProgressionRow = {
          date: Date;
          maxWeight: number;
          totalReps: number;
          totalVolume: number | bigint;
        };

        const rows = await prisma.$queryRaw<ProgressionRow[]>`
          SELECT
            w."completedAt" AS "date",
            MAX(s."weight")::int AS "maxWeight",
            SUM(s."reps")::int AS "totalReps",
            SUM((s."weight" * s."reps")::bigint) AS "totalVolume"
          FROM "Set" s
          INNER JOIN "Workout" w ON w."id" = s."workoutId"
          WHERE w."userId" = ${context.user.id}
            AND w."completedAt" IS NOT NULL
            AND s."movementId" = ${data.movementId}
          GROUP BY w."id", w."completedAt"
          ORDER BY w."completedAt" ASC
        `;

        const points = rows.map((row) => {
          const value =
            data.metric === "max_weight"
              ? row.maxWeight
              : data.metric === "total_reps"
                ? row.totalReps
                : Number(row.totalVolume);

          return {
            date: row.date.toISOString(),
            value,
          };
        });

        observation.addMeta({ points: points.length });
        return points;
      }),
  );
