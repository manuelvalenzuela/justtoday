import "server-only";

import type { Prisma, PrismaClient } from "@prisma/client";
import type { UIMessage } from "ai";

import { db } from "@/lib/db";

type Tx = Prisma.TransactionClient | PrismaClient;

export async function getActiveTranscript(
  userId: string,
): Promise<{ planId: string; dayNumber: number; messages: UIMessage[] } | null> {
  const plan = await db.plan.findFirst({
    where: { userId, active: true },
    select: {
      id: true,
      days: {
        where: { status: "pending" },
        orderBy: { dayNumber: "asc" },
        take: 1,
        select: { dayNumber: true },
      },
    },
  });
  if (!plan) return null;
  const pending = plan.days[0];
  if (!pending) return null;

  const row = await db.dayConversation.findUnique({
    where: { planId_dayNumber: { planId: plan.id, dayNumber: pending.dayNumber } },
    select: { messages: true },
  });

  return {
    planId: plan.id,
    dayNumber: pending.dayNumber,
    messages: (row?.messages as UIMessage[] | undefined) ?? [],
  };
}

export async function saveTranscript(
  userId: string,
  planId: string,
  dayNumber: number,
  messages: UIMessage[],
): Promise<void> {
  const plan = await db.plan.findFirst({
    where: { id: planId, userId },
    select: { id: true },
  });
  if (!plan) return;

  await db.dayConversation.upsert({
    where: { planId_dayNumber: { planId, dayNumber } },
    create: { planId, dayNumber, messages: messages as unknown as Prisma.InputJsonValue },
    update: { messages: messages as unknown as Prisma.InputJsonValue },
  });
}

export async function clearTranscript(
  tx: Tx,
  planId: string,
  dayNumber: number,
): Promise<void> {
  await tx.dayConversation.deleteMany({
    where: { planId, dayNumber },
  });
}

// Delete every DayConversation for the plan whose dayNumber doesn't match the
// current pending day. Used after adjustUpcomingDays — preserves the in-progress
// chat while cleaning up rows orphaned by day-number shifts.
export async function clearOrphanedTranscripts(
  tx: Tx,
  planId: string,
  currentPendingDayNumber: number,
): Promise<void> {
  await tx.dayConversation.deleteMany({
    where: {
      planId,
      NOT: { dayNumber: currentPendingDayNumber },
    },
  });
}
