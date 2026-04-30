import "server-only";

import { generateObject, jsonSchema } from "ai";

import { getChatModel } from "@/lib/ai";

export type ParsedDay = {
  dayNumber: number;
  goal: string;
  topics: string[];
};

export type ParsedPlan = {
  title: string;
  days: ParsedDay[];
};

const PROMPT = [
  "You convert a user's free-form study plan into a structured day-by-day schedule.",
  "Rules:",
  "- Output a concise plan title (3-8 words). If the user provided one, keep its intent.",
  "- Decompose the plan into a sequence of days, numbered starting at 1, contiguous.",
  "- Each day has one short goal sentence and 2-5 concrete topics. Keep topics specific and actionable.",
  "- If the input is vague about pacing, use your judgement to split into a reasonable day count (3-10 days for typical plans). Don't invent topics that go beyond the user's intent.",
  "- Preserve the user's language. If they wrote in Spanish, the days should be in Spanish.",
].join("\n");

const SCHEMA = jsonSchema<ParsedPlan>({
  type: "object",
  properties: {
    title: { type: "string", minLength: 1 },
    days: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          dayNumber: { type: "integer", minimum: 1 },
          goal: { type: "string", minLength: 1 },
          topics: {
            type: "array",
            items: { type: "string", minLength: 1 },
          },
        },
        required: ["dayNumber", "goal", "topics"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "days"],
  additionalProperties: false,
});

export async function parsePlanWithLLM(input: string): Promise<ParsedPlan> {
  const { object } = await generateObject({
    model: getChatModel(),
    schema: SCHEMA,
    system: PROMPT,
    prompt: input,
  });

  const sorted = [...object.days].sort((a, b) => a.dayNumber - b.dayNumber);
  return {
    title: object.title.trim(),
    days: sorted.map((day, idx) => ({
      dayNumber: idx + 1,
      goal: day.goal.trim(),
      topics: day.topics.map((t) => t.trim()).filter(Boolean),
    })),
  };
}
