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
import { saveTranscript } from "@/server/conversations";
import {
  adjustUpcomingDays,
  completeDay,
  getActivePlan,
} from "@/server/plans";

export const maxDuration = 60;

type CloseOutInput = { recap: string; feedback: string };
type AdjustInput = {
  summary: string;
  days: Array<{ dayNumber: number; goal: string; topics: string[] }>;
};

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
  const hasPending = plan.days.some((d) => d.status === "pending");

  const closeOutTool = today
    ? tool({
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
      })
    : undefined;

  const adjustTool = hasPending
    ? tool({
        description:
          "Replace all upcoming (pending) days with a new sequence based on the user's pace and feedback. Use for moderate adjustments (insert catch-up/review days, reorder, split, or merge). For aggressive changes (dropping topics or rewriting larger sections), describe the proposed change in chat first and only call this tool after the user confirms. Past/completed days are never affected.",
        inputSchema: jsonSchema<AdjustInput>({
          type: "object",
          properties: {
            summary: {
              type: "string",
              description:
                "One short sentence describing what changed and why, written for the user (e.g., 'Added a review day before moving on, since conjugations felt shaky.').",
            },
            days: {
              type: "array",
              description:
                "The full new sequence of upcoming days. Day numbers must be contiguous starting at the day immediately after the most recently completed day.",
              minItems: 1,
              items: {
                type: "object",
                properties: {
                  dayNumber: { type: "integer", minimum: 1 },
                  goal: { type: "string", minLength: 1 },
                  topics: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
                required: ["dayNumber", "goal", "topics"],
                additionalProperties: false,
              },
            },
          },
          required: ["summary", "days"],
          additionalProperties: false,
        }),
        execute: async ({ summary, days }) => {
          const result = await adjustUpcomingDays(userId, plan.id, days);
          return { ok: true, summary, count: result.count };
        },
      })
    : undefined;

  const tools = {
    ...(closeOutTool ? { closeOutDay: closeOutTool } : {}),
    ...(adjustTool ? { adjustUpcomingDays: adjustTool } : {}),
  };

  const result = streamText({
    model: getChatModel(),
    system: buildSystemPrompt(plan),
    messages: await convertToModelMessages(messages),
    tools: Object.keys(tools).length > 0 ? tools : undefined,
    stopWhen: stepCountIs(5),
  });

  const pendingDayNumber = today?.dayNumber;

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onFinish: pendingDayNumber
      ? async ({ messages: finalMessages, isAborted }) => {
          if (isAborted) return;
          try {
            await saveTranscript(userId, plan.id, pendingDayNumber, finalMessages);
          } catch (err) {
            console.error("Failed to persist transcript", err);
          }
        }
      : undefined,
  });
}
