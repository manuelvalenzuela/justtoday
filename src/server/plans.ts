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

export type AdjustedDay = {
  dayNumber: number;
  goal: string;
  topics: string[];
};

export async function adjustUpcomingDays(
  userId: string,
  planId: string,
  newDays: AdjustedDay[],
) {
  if (newDays.length === 0) {
    throw new Error("Adaptation must include at least one upcoming day.");
  }

  return db.$transaction(async (tx) => {
    const plan = await tx.plan.findFirst({
      where: { id: planId, userId },
      select: { id: true },
    });
    if (!plan) {
      throw new Error("Plan not found.");
    }

    const completed = await tx.day.findMany({
      where: { planId, status: "completed" },
      select: { dayNumber: true },
    });
    const maxCompleted = completed.reduce(
      (max, d) => (d.dayNumber > max ? d.dayNumber : max),
      0,
    );
    const expectedFirst = maxCompleted + 1;

    const sorted = [...newDays].sort((a, b) => a.dayNumber - b.dayNumber);
    sorted.forEach((day, idx) => {
      const expected = expectedFirst + idx;
      if (day.dayNumber !== expected) {
        throw new Error(
          `Day numbers must be contiguous starting at ${expectedFirst}; got ${day.dayNumber} at position ${idx}.`,
        );
      }
      if (!day.goal.trim()) {
        throw new Error(`Day ${day.dayNumber} is missing a goal.`);
      }
    });

    await tx.day.deleteMany({
      where: { planId, status: "pending" },
    });

    await tx.day.createMany({
      data: sorted.map((day) => ({
        planId,
        dayNumber: day.dayNumber,
        goal: day.goal,
        topics: day.topics,
      })),
    });

    return { count: sorted.length, firstDayNumber: expectedFirst };
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
