import { convertToModelMessages, streamText, type UIMessage } from "ai";

import { getChatModel } from "@/lib/ai";
import { auth } from "@/lib/auth";
import { buildSystemPrompt } from "@/lib/system-prompt";
import { getActivePlan } from "@/server/plans";

export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages }: { messages: UIMessage[] } = await req.json();

  const plan = await getActivePlan(session.user.id);
  if (!plan) {
    return new Response("No active plan.", { status: 400 });
  }

  const result = streamText({
    model: getChatModel(),
    system: buildSystemPrompt(plan),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
