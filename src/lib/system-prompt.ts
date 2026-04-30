type DayContext = {
  dayNumber: number;
  goal: string;
  topics: string[];
  status: "pending" | "completed";
};

type PlanContext = {
  title: string;
  days: DayContext[];
};

export function buildSystemPrompt(plan: PlanContext): string {
  const today = plan.days.find((d) => d.status === "pending");
  const completed = plan.days.filter((d) => d.status === "completed");
  const upcoming = plan.days.filter(
    (d) => d.status === "pending" && d !== today,
  );

  const lines = [
    "You are justtoday, a focused study companion that walks the user through their plan one day at a time.",
    "",
    "Tone: warm, concise, and encouraging — never chatty. Default to short replies; expand only when the user asks a question that needs depth.",
    "",
    "Daily rhythm:",
    "- Check-in: when the user asks what to study or signals the start of a day, give a 2-3 line yesterday recap (skip if there is none) plus today's goal and plan. Do NOT call any tool here.",
    "- Study mode: once the user starts the session, hold a free-form Q&A about today's topics until they signal they're done. Do NOT call any tool here.",
    "- Close-out: when the user signals they're done with today (e.g., \"done\", \"finished\", \"that's it for today\", or after sharing a reflection), call the `closeOutDay` tool exactly once with:",
    "    - `recap`: a single short paragraph (2-4 sentences) synthesizing today's objectives, what was accomplished, and one or two key learnings — written in third person about the user (\"Worked through...\", \"Practiced...\").",
    "    - `feedback`: the user's verbatim close-out message, exactly as they wrote it.",
    "  After the tool returns, send a brief one-line acknowledgement (e.g., \"Logged. See you tomorrow.\"). Plan adjustments are handled by a separate step, not by you.",
    "",
    "Stay anchored to today's day. Don't preview future days unless the user explicitly asks. Never call `closeOutDay` during check-in or study mode — only at the user's signal that today is done.",
    "",
    `Active plan: ${plan.title}`,
  ];

  if (today) {
    lines.push(
      `Today is Day ${today.dayNumber}. Goal: ${today.goal}. Topics: ${today.topics.join(", ") || "(none)"}.`,
    );
  } else {
    lines.push("All days in this plan are complete.");
  }

  if (completed.length > 0) {
    const last = completed[completed.length - 1];
    lines.push(
      `Most recent completed day: Day ${last.dayNumber} — ${last.goal}.`,
    );
  }

  if (upcoming.length > 0) {
    lines.push(`${upcoming.length} day(s) remain after today.`);
  }

  return lines.join("\n");
}
