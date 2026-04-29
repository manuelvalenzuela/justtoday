"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { PlanParseError } from "@/lib/markdown";
import { createPlan } from "@/server/plans";

export type CreatePlanState =
  | { status: "idle" }
  | { status: "error"; error: string };

export async function createPlanAction(
  _prev: CreatePlanState,
  formData: FormData,
): Promise<CreatePlanState> {
  const session = await auth();
  if (!session?.user) {
    return { status: "error", error: "You must be signed in." };
  }

  const markdown = String(formData.get("markdown") ?? "").trim();
  if (!markdown) {
    return { status: "error", error: "Paste or upload a plan first." };
  }

  try {
    await createPlan(session.user.id, markdown);
  } catch (err) {
    if (err instanceof PlanParseError) {
      return { status: "error", error: err.message };
    }
    console.error("createPlan failed", err);
    return {
      status: "error",
      error: "Could not save the plan. Try again.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/");
}
