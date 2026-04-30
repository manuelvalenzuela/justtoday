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

export async function getActivePlan(userId: string) {
  return db.plan.findFirst({
    where: { userId, active: true },
    include: { days: { orderBy: { dayNumber: "asc" } } },
  });
}

export async function createPlan(userId: string, markdown: string) {
  const parsed = parsePlan(markdown);

  return db.$transaction(async (tx) => {
    await tx.plan.updateMany({
      where: { userId, active: true },
      data: { active: false },
    });

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

export async function completeDay(
  userId: string,
  planId: string,
  dayNumber: number,
  recap: string,
  feedback: string,
) {
  const day = await db.day.findFirst({
    where: {
      dayNumber,
      status: "pending",
      plan: { id: planId, userId },
    },
    select: { id: true },
  });
  if (!day) {
    throw new Error("Day not found, already completed, or not yours.");
  }

  await db.day.update({
    where: { id: day.id },
    data: {
      status: "completed",
      recap,
      feedback,
      completedAt: new Date(),
    },
  });
}

export async function setActivePlan(userId: string, planId: string) {
  const plan = await db.plan.findFirst({
    where: { id: planId, userId },
    select: { id: true },
  });
  if (!plan) {
    throw new Error("Plan not found.");
  }

  await db.$transaction([
    db.plan.updateMany({
      where: { userId, active: true },
      data: { active: false },
    }),
    db.plan.update({
      where: { id: planId },
      data: { active: true },
    }),
  ]);
}
