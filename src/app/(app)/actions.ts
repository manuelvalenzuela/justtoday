"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { setActivePlan } from "@/server/plans";

export async function setActivePlanAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const planId = String(formData.get("planId") ?? "");
  if (!planId) return;

  await setActivePlan(session.user.id, planId);
  revalidatePath("/", "layout");
}
