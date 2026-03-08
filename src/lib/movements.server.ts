import { createServerFn } from "@tanstack/react-start";
import { getServerSidePrismaClient } from "@/lib/db.server";
import { authMiddleware } from "@/lib/auth.server";
import { z } from "zod";
import { withObservation } from "@/lib/observability.server";

export const createMovementServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      name: z.string().min(1),
      isBodyweight: z.boolean().default(false),
      defaultWeight: z.number().int().min(0).optional(),
      defaultReps: z.number().int().min(1).optional(),
    }),
  )
  .handler(
    async ({
      context,
      data,
    }: {
      context: { user: { id: string } };
      data: { name: string; isBodyweight: boolean; defaultWeight?: number; defaultReps?: number };
    }) =>
      withObservation("movements.create", async (observation) => {
        observation.setUserId(context.user.id);
        observation.addMeta({ isBodyweight: data.isBodyweight });
        const prisma = await getServerSidePrismaClient();
        const movement = await prisma.movement.create({
          data: {
            name: data.name,
            isBodyweight: data.isBodyweight,
            defaultWeight: data.isBodyweight ? null : data.defaultWeight ?? null,
            defaultReps: data.defaultReps ?? null,
            userId: context.user.id,
          },
        });
        return { success: true as const, movement };
      }),
  );

export const updateMovementServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      movementId: z.string(),
      name: z.string().min(1),
      isBodyweight: z.boolean(),
      defaultWeight: z.number().int().min(0).optional(),
      defaultReps: z.number().int().min(1).optional(),
    }),
  )
  .handler(
    async ({
      context,
      data,
    }: {
      context: { user: { id: string } };
      data: { movementId: string; name: string; isBodyweight: boolean; defaultWeight?: number; defaultReps?: number };
    }) =>
      withObservation("movements.update", async (observation) => {
        observation.setUserId(context.user.id);
        const prisma = await getServerSidePrismaClient();
        const movement = await prisma.movement.updateMany({
          where: { id: data.movementId, userId: context.user.id },
          data: {
            name: data.name,
            isBodyweight: data.isBodyweight,
            defaultWeight: data.isBodyweight ? null : data.defaultWeight ?? null,
            defaultReps: data.defaultReps ?? null,
          },
        });

        if (movement.count === 0) {
          observation.addMeta({ outcome: "not_found" });
          return { success: false as const, error: "Movement not found" };
        }

        return { success: true as const };
      }),
  );

export const deleteMovementServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ movementId: z.string() }))
  .handler(async ({ context, data }: { context: { user: { id: string } }; data: { movementId: string } }) =>
    withObservation("movements.delete", async (observation) => {
      observation.setUserId(context.user.id);
      const prisma = await getServerSidePrismaClient();
      const hasSets = await prisma.set.findFirst({
        where: { movementId: data.movementId, workout: { userId: context.user.id } },
        select: { id: true },
      });

      if (hasSets) {
        observation.addMeta({ outcome: "blocked_has_sets" });
        return { success: false as const, error: "Cannot delete movement that already has sets." };
      }

      const deleted = await prisma.movement.deleteMany({
        where: { id: data.movementId, userId: context.user.id },
      });

      if (deleted.count === 0) {
        observation.addMeta({ outcome: "not_found" });
        return { success: false as const, error: "Movement not found" };
      }

      return { success: true as const };
    }),
  );

export const getMovementsServerFn = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) =>
    withObservation("movements.list", async (observation) => {
      observation.setUserId(context.user.id);
      const prisma = await getServerSidePrismaClient();
      const movements = await prisma.movement.findMany({
        where: { userId: context.user.id },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          isBodyweight: true,
          defaultWeight: true,
          defaultReps: true,
        },
      });
      observation.addMeta({ count: movements.length });
      return movements;
    }),
  );
