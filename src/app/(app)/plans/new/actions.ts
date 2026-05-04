"use server";

import type { UIMessage } from "ai";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import type { ParsedPlan } from "@/lib/plan-schema";
import { sanitizeRefineMessages } from "@/lib/refine-messages";
import { createPlan } from "@/server/plans";

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function savePlanAction(
  originalInput: string,
  draft: ParsedPlan,
  refinementMessages?: UIMessage[] | null,
): Promise<SaveResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "You must be signed in." };
  }

  const cleaned: ParsedPlan = {
    title: draft.title.trim(),
    days: draft.days.map((day) => ({
      dayNumber: day.dayNumber,
      goal: day.goal.trim(),
      topics: day.topics.map((t) => t.trim()).filter(Boolean),
    })),
  };

  if (!cleaned.title) {
    return { ok: false, error: "Title is required." };
  }
  if (cleaned.days.length === 0) {
    return { ok: false, error: "Add at least one day." };
  }
  for (const [i, day] of cleaned.days.entries()) {
    if (!day.goal) {
      return { ok: false, error: `Day ${i + 1} is missing a goal.` };
    }
  }

  let refinement: UIMessage[] | null = null;
  if (refinementMessages != null) {
    refinement = sanitizeRefineMessages(refinementMessages);
    if (!refinement) {
      return { ok: false, error: "Refinement chat failed validation." };
    }
  }

  try {
    await createPlan(session.user.id, originalInput, cleaned, refinement);
  } catch (err) {
    console.error("createPlan failed", err);
    return { ok: false, error: "Could not save the plan. Try again." };
  }

  revalidatePath("/", "layout");
  redirect("/");
}
