import { convertToModelMessages, generateText } from "ai";

import { getChatModel } from "@/lib/ai";
import { auth } from "@/lib/auth";
import {
  REFINE_MAX_PAYLOAD_BYTES,
  sanitizeRefineMessages,
} from "@/lib/refine-messages";

export const maxDuration = 60;

const SUMMARIZE_SYSTEM_PROMPT = [
  "You are turning a planning conversation into a clean, self-contained brief that will be fed to a separate step that generates a day-by-day study plan.",
  "Output: a short markdown brief, written from the user's perspective in the first person.",
  "Include: what they want to learn, target length in days if discussed, prior knowledge, emphasis or constraints, and any specific topics they called out.",
  "Do NOT produce a day-by-day schedule. Do NOT add anything the user did not say or imply.",
  "Match the user's language. If the conversation is in Spanish, write the brief in Spanish.",
  "Keep it tight — a few short paragraphs or a small bulleted list.",
].join("\n");

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > REFINE_MAX_PAYLOAD_BYTES) {
    return new Response("Payload too large", { status: 413 });
  }

  const body = (await req.json()) as { messages?: unknown };
  const messages = sanitizeRefineMessages(body.messages);
  if (!messages) {
    return new Response("Invalid messages", { status: 400 });
  }

  const result = await generateText({
    model: getChatModel(),
    system: SUMMARIZE_SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
  });

  return Response.json({ summary: result.text });
}
