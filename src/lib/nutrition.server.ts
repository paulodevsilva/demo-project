import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth.server";
import { getServerSidePrismaClient } from "@/lib/db.server";
import { withObservation } from "@/lib/observability.server";

const nutritionEntrySchema = z.object({
  calories: z.number().int().min(0).max(20000),
  protein: z.number().int().min(0).max(2000),
  carbs: z.number().int().min(0).max(2000),
  fat: z.number().int().min(0).max(1000),
  measuredAt: z.date().optional(),
});

function getDayRange(referenceDate = new Date()) {
  const start = new Date(referenceDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export const createNutritionEntryServerFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(nutritionEntrySchema)
  .handler(
    async ({
      context,
      data,
    }: {
      context: { user: { id: string } };
      data: z.infer<typeof nutritionEntrySchema>;
    }) =>
      withObservation("nutrition.create", async (observation) => {
        observation.setUserId(context.user.id);
        const prisma = await getServerSidePrismaClient();
        const entry = await prisma.nutritionEntry.create({
          data: {
            userId: context.user.id,
            calories: data.calories,
            protein: data.protein,
            carbs: data.carbs,
            fat: data.fat,
            measuredAt: data.measuredAt ?? new Date(),
          },
          select: {
            id: true,
            calories: true,
            protein: true,
            carbs: true,
            fat: true,
            measuredAt: true,
          },
        });

        return { success: true as const, entry };
      }),
  );

export const getNutritionEntriesServerFn = createServerFn()
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(10),
    }),
  )
  .handler(async ({ context, data }: { context: { user: { id: string } }; data: { page: number; pageSize: number } }) =>
    withObservation("nutrition.list", async (observation) => {
      observation.setUserId(context.user.id);
      const prisma = await getServerSidePrismaClient();
      const [totalCount, entries] = await prisma.$transaction([
        prisma.nutritionEntry.count({
          where: { userId: context.user.id },
        }),
        prisma.nutritionEntry.findMany({
          where: { userId: context.user.id },
          orderBy: { measuredAt: "desc" },
          skip: (data.page - 1) * data.pageSize,
          take: data.pageSize,
          select: {
            id: true,
            calories: true,
            protein: true,
            carbs: true,
            fat: true,
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

export const getTodayNutritionSummaryServerFn = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) =>
    withObservation("nutrition.todaySummary", async (observation) => {
      observation.setUserId(context.user.id);
      const prisma = await getServerSidePrismaClient();
      const { start, end } = getDayRange();

      const [count, totals] = await prisma.$transaction([
        prisma.nutritionEntry.count({
          where: { userId: context.user.id, measuredAt: { gte: start, lt: end } },
        }),
        prisma.nutritionEntry.aggregate({
          where: { userId: context.user.id, measuredAt: { gte: start, lt: end } },
          _sum: {
            calories: true,
            protein: true,
            carbs: true,
            fat: true,
          },
        }),
      ]);

      return {
        entryCount: count,
        calories: totals._sum.calories ?? 0,
        protein: totals._sum.protein ?? 0,
        carbs: totals._sum.carbs ?? 0,
        fat: totals._sum.fat ?? 0,
      };
    }),
  );
