import "server-only";

import { db } from "@/lib/db";
import { parsePlan } from "@/lib/markdown";

export async function listPlansForUser(userId: string) {
  return db.plan.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, active: true, createdAt: true },
  });
}

export async function createPlan(userId: string, markdown: string) {
  const parsed = parsePlan(markdown);

  return db.$transaction(async (tx) => {
    const plan = await tx.plan.create({
      data: {
        userId,
        title: parsed.title,
        originalMarkdown: markdown,
        active: true,
      },
    });

    await tx.day.createMany({
      data: parsed.days.map((day) => ({
        planId: plan.id,
        dayNumber: day.dayNumber,
        goal: day.goal,
        topics: day.topics,
      })),
    });

    return plan;
  });
}
