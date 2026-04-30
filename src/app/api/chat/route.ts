import {
  convertToModelMessages,
  jsonSchema,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";

import { getChatModel } from "@/lib/ai";
import { auth } from "@/lib/auth";
import { buildSystemPrompt } from "@/lib/system-prompt";
import { completeDay, getActivePlan } from "@/server/plans";

export const maxDuration = 60;

type CloseOutInput = { recap: string; feedback: string };

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;

  const { messages }: { messages: UIMessage[] } = await req.json();

  const plan = await getActivePlan(userId);
  if (!plan) {
    return new Response("No active plan.", { status: 400 });
  }

  const today = plan.days.find((d) => d.status === "pending");

  const tools = today
    ? {
        closeOutDay: tool({
          description:
            "Mark today's day as complete and record a recap of what was studied plus the user's verbatim close-out feedback. Call exactly once when the user signals they're done with today.",
          inputSchema: jsonSchema<CloseOutInput>({
            type: "object",
            properties: {
              recap: {
                type: "string",
                description:
                  "A short paragraph (2-4 sentences) synthesizing today's objectives, accomplishments, and key learnings.",
              },
              feedback: {
                type: "string",
                description:
                  "The user's verbatim close-out message — exactly as they wrote it.",
              },
            },
            required: ["recap", "feedback"],
            additionalProperties: false,
          }),
          execute: async ({ recap, feedback }) => {
            await completeDay(userId, plan.id, today.dayNumber, recap, feedback);
            return { ok: true, dayNumber: today.dayNumber };
          },
        }),
      }
    : undefined;

  const result = streamText({
    model: getChatModel(),
    system: buildSystemPrompt(plan),
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(3),
  });

  return result.toUIMessageStreamResponse();
}
