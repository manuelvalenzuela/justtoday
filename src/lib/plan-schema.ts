import { jsonSchema } from "ai";

export type ParsedDay = {
  dayNumber: number;
  goal: string;
  topics: string[];
};

export type ParsedPlan = {
  title: string;
  days: ParsedDay[];
};

export const PLAN_SCHEMA = jsonSchema<ParsedPlan>({
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

export const PLAN_PARSE_SYSTEM_PROMPT = [
  "You convert a user's free-form study plan into a structured day-by-day schedule.",
  "Rules:",
  "- Output a concise plan title (3-8 words). If the user provided one, keep its intent.",
  "- Decompose the plan into a sequence of days, numbered starting at 1, contiguous.",
  "- Each day has one short goal sentence and 2-5 concrete topics. Keep topics specific and actionable.",
  "- If the input is vague about pacing, infer a sensible day count from intent: short, focused goals (\"learn the basics of X\") fit in a few days; broader, structured goals (\"month-long course\") fit in many. Typical range 3-30 days. Don't invent topics that go beyond the user's intent.",
  "- Preserve the user's language. If they wrote in Spanish, the days should be in Spanish.",
].join("\n");

export function buildPlanParsePrompt(input: string, targetDays?: number): string {
  const trimmed = input.trim();
  if (!targetDays || !Number.isFinite(targetDays) || targetDays < 1) {
    return trimmed;
  }
  const n = Math.floor(targetDays);
  return [
    `Target plan length: exactly ${n} day${n === 1 ? "" : "s"}. Produce exactly ${n} day entries — no more, no less. Distribute the user's intent across that span; if they implied a different length, override it.`,
    "",
    "User input:",
    trimmed,
  ].join("\n");
}
