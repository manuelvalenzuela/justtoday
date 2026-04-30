"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { parsePlanWithLLM, type ParsedPlan } from "@/lib/plan-llm";
import { createPlan } from "@/server/plans";

export type ConvertResult =
  | { ok: true; draft: ParsedPlan }
  | { ok: false; error: string };

export async function convertPlanAction(input: string): Promise<ConvertResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "You must be signed in." };
  }
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: "Paste a plan first." };
  }

  try {
    const draft = await parsePlanWithLLM(trimmed);
    return { ok: true, draft };
  } catch (err) {
    console.error("parsePlanWithLLM failed", err);
    return {
      ok: false,
      error: "Could not interpret that plan. Try rephrasing or adding more detail.",
    };
  }
}

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function savePlanAction(
  originalInput: string,
  draft: ParsedPlan,
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

  try {
    await createPlan(session.user.id, originalInput, cleaned);
  } catch (err) {
    console.error("createPlan failed", err);
    return { ok: false, error: "Could not save the plan. Try again." };
  }

  revalidatePath("/", "layout");
  redirect("/");
}
