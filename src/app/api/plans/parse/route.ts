import { streamObject } from "ai";

import { getChatModel } from "@/lib/ai";
import { auth } from "@/lib/auth";
import { PLAN_PARSE_SYSTEM_PROMPT, PLAN_SCHEMA } from "@/lib/plan-schema";

export const maxDuration = 300;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await req.json()) as { input?: unknown };
  const input = typeof body.input === "string" ? body.input.trim() : "";
  if (!input) {
    return new Response("Input required", { status: 400 });
  }

  const result = streamObject({
    model: getChatModel(),
    schema: PLAN_SCHEMA,
    system: PLAN_PARSE_SYSTEM_PROMPT,
    prompt: input,
  });

  return result.toTextStreamResponse();
}
