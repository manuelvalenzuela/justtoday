export type ParsedDay = {
  dayNumber: number;
  goal: string;
  topics: string[];
};

export type ParsedPlan = {
  title: string;
  days: ParsedDay[];
};

export class PlanParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanParseError";
  }
}

const TITLE_RE = /^#\s+(.+?)\s*$/;
const DAY_RE = /^##\s+Day\s+(\d+)\s*$/i;
const GOAL_RE = /^\*\*Goal:\*\*\s*(.+?)\s*$/i;
const TOPIC_RE = /^[-*]\s+(.+?)\s*$/;

export function parsePlan(input: string): ParsedPlan {
  const lines = input.replace(/\r\n/g, "\n").split("\n");

  let title: string | null = null;
  const days: ParsedDay[] = [];
  let current: ParsedDay | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const titleMatch = line.match(TITLE_RE);
    if (titleMatch && title === null && current === null) {
      title = titleMatch[1];
      continue;
    }

    const dayMatch = line.match(DAY_RE);
    if (dayMatch) {
      if (current) finalizeDay(current, days);
      current = {
        dayNumber: Number(dayMatch[1]),
        goal: "",
        topics: [],
      };
      continue;
    }

    if (!current) {
      // Stray content before the first day — ignore quietly.
      continue;
    }

    const goalMatch = line.match(GOAL_RE);
    if (goalMatch) {
      if (current.goal) {
        throw new PlanParseError(
          `Day ${current.dayNumber} has more than one Goal line.`,
        );
      }
      current.goal = goalMatch[1];
      continue;
    }

    const topicMatch = line.match(TOPIC_RE);
    if (topicMatch) {
      current.topics.push(topicMatch[1]);
      continue;
    }

    // Unrecognized non-empty content inside a day — ignore for v1.
  }

  if (current) finalizeDay(current, days);

  if (!title) {
    throw new PlanParseError(
      "Plan is missing a title. Add a `# Plan title` heading at the top.",
    );
  }
  if (days.length === 0) {
    throw new PlanParseError(
      "Plan has no days. Add at least one `## Day 1` section.",
    );
  }

  const seen = new Set<number>();
  for (const day of days) {
    if (seen.has(day.dayNumber)) {
      throw new PlanParseError(`Day ${day.dayNumber} appears more than once.`);
    }
    seen.add(day.dayNumber);
  }

  days.sort((a, b) => a.dayNumber - b.dayNumber);

  return { title, days };
}

function finalizeDay(day: ParsedDay, days: ParsedDay[]) {
  if (!day.goal) {
    throw new PlanParseError(
      `Day ${day.dayNumber} is missing a **Goal:** line.`,
    );
  }
  days.push(day);
}
