import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth.server";
import { getServerSidePrismaClient } from "@/lib/db.server";
import { withObservation } from "@/lib/observability.server";

export const createBodyWeightEntryServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      weight: z.number().int().min(1).max(1000),
      measuredAt: z.date().optional(),
    }),
  )
  .handler(
    async ({
      context,
      data,
    }: {
      context: { user: { id: string } };
      data: { weight: number; measuredAt?: Date };
    }) =>
      withObservation("bodyWeight.create", async (observation) => {
        observation.setUserId(context.user.id);
        const prisma = await getServerSidePrismaClient();
        const entry = await prisma.bodyWeightEntry.create({
          data: {
            userId: context.user.id,
            weight: data.weight,
            measuredAt: data.measuredAt ?? new Date(),
          },
        });
        return { success: true as const, entry };
      }),
  );

export const getBodyWeightEntriesServerFn = createServerFn()
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
    }),
  )
  .handler(async ({ context, data }: { context: { user: { id: string } }; data: { page: number; pageSize: number } }) =>
    withObservation("bodyWeight.list", async (observation) => {
      observation.setUserId(context.user.id);
      const prisma = await getServerSidePrismaClient();
      const [totalCount, entries] = await prisma.$transaction([
        prisma.bodyWeightEntry.count({
          where: { userId: context.user.id },
        }),
        prisma.bodyWeightEntry.findMany({
          where: { userId: context.user.id },
          orderBy: { measuredAt: "desc" },
          skip: (data.page - 1) * data.pageSize,
          take: data.pageSize,
          select: {
            id: true,
            weight: true,
            measuredAt: true,
          },
        }),
      ]);
      const totalPages = Math.max(1, Math.ceil(totalCount / data.pageSize));
      observation.addMeta({ page: data.page, pageSize: data.pageSize, returned: entries.length, totalCount });
      return {
        items: entries,
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

export const getLatestBodyWeightServerFn = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) =>
    withObservation("bodyWeight.latest", async (observation) => {
      observation.setUserId(context.user.id);
      const prisma = await getServerSidePrismaClient();
      return prisma.bodyWeightEntry.findFirst({
        where: { userId: context.user.id },
        orderBy: { measuredAt: "desc" },
        select: {
          id: true,
          weight: true,
          measuredAt: true,
        },
      });
    }),
  );
