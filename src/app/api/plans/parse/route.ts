import { streamObject } from "ai";

import { getChatModel } from "@/lib/ai";
import { auth } from "@/lib/auth";
import {
  PLAN_PARSE_SYSTEM_PROMPT,
  PLAN_SCHEMA,
  buildPlanParsePrompt,
} from "@/lib/plan-schema";

export const maxDuration = 300;

const MAX_TARGET_DAYS = 60;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await req.json()) as { input?: unknown; days?: unknown };
  const input = typeof body.input === "string" ? body.input.trim() : "";
  if (!input) {
    return new Response("Input required", { status: 400 });
  }

  let targetDays: number | undefined;
  if (typeof body.days === "number" && Number.isFinite(body.days)) {
    const n = Math.floor(body.days);
    if (n >= 1 && n <= MAX_TARGET_DAYS) targetDays = n;
  }

  const result = streamObject({
    model: getChatModel(),
    schema: PLAN_SCHEMA,
    system: PLAN_PARSE_SYSTEM_PROMPT,
    prompt: buildPlanParsePrompt(input, targetDays),
  });

  return result.toTextStreamResponse();
}
