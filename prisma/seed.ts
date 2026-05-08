// Seed script for local development and screenshot capture.
//
// Creates a deterministic demo user, plan, and in-progress chat so the app
// looks "real" without needing to walk through OAuth + plan import each time.
//
// Run with:    npx prisma db seed
// Idempotent — re-running wipes the demo user and recreates everything.
//
// IMPORTANT: refuses to run against a remote/production database. Only use
// this against a local Postgres instance.

import { PrismaClient } from "@prisma/client";
import type { UIMessage } from "ai";

const db = new PrismaClient();

const DEMO_EMAIL = "demo@justtoday.local";
const DEMO_NAME = "Demo User";
const DEMO_SESSION_TOKEN = "demo-session-token-local-only";

const PLAN_TITLE = "Intro to React Hooks";

const PLAN_ORIGINAL_MARKDOWN = `# Intro to React Hooks

A short, hands-on pass through the most common React hooks. Goal: recognize
when each hook is the right tool, not memorize APIs.

## Day 1: useState and useEffect
- useState basics
- useEffect lifecycle
- dependency arrays

## Day 2: useReducer for complex state
- when to reach for useReducer
- action shapes
- co-locating reducers with components

## Day 3: useContext and custom hooks
- useContext basics
- custom hook patterns
- avoiding context overuse

## Day 4: useMemo and useCallback
- when memoization actually helps
- reference equality
- profiling renders before optimizing

## Day 5: Putting it together
- combining hooks in a small todo app
- structuring components
- keeping local state local
`;

const DAYS = [
  {
    dayNumber: 1,
    status: "completed" as const,
    goal: "Get comfortable with useState and useEffect",
    topics: ["useState basics", "useEffect lifecycle", "dependency arrays"],
    recap:
      "Walked through useState with a counter and a controlled input, then refactored a small data fetch from class-style lifecycle methods to useEffect. Learned how dependency arrays gate re-runs and why an empty array means 'on mount only'.",
    feedback:
      "useEffect dependency arrays still feel a bit fuzzy — want to come back to this once something breaks for real.",
  },
  {
    dayNumber: 2,
    status: "pending" as const,
    goal: "Use useReducer for complex state",
    topics: [
      "when to reach for useReducer instead of useState",
      "action shapes and reducer functions",
      "co-locating reducers with components",
    ],
  },
  {
    dayNumber: 3,
    status: "pending" as const,
    goal: "Share state with useContext and custom hooks",
    topics: [
      "useContext basics",
      "extracting custom hooks",
      "avoiding context overuse",
    ],
  },
  {
    dayNumber: 4,
    status: "pending" as const,
    goal: "Optimize renders with useMemo and useCallback",
    topics: [
      "when memoization actually helps",
      "reference equality and re-renders",
      "profiling before optimizing",
    ],
  },
  {
    dayNumber: 5,
    status: "pending" as const,
    goal: "Build a small todo app end-to-end",
    topics: [
      "combining the hooks you've learned",
      "structuring components",
      "keeping local state local",
    ],
  },
];

const DAY_2_TRANSCRIPT: UIMessage[] = [
  {
    id: "demo-msg-1",
    role: "user",
    parts: [{ type: "text", text: "let's start" }],
  },
  {
    id: "demo-msg-2",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "Great — today is about **useReducer**. Three things to walk away with:\n\n- when to reach for it instead of `useState`\n- what an action looks like in practice\n- where to put the reducer in your file\n\nWant me to motivate why `useReducer` exists first, or jump straight into a concrete example?",
      },
    ],
  },
  {
    id: "demo-msg-3",
    role: "user",
    parts: [{ type: "text", text: "motivate first please" }],
  },
  {
    id: "demo-msg-4",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "`useState` handles independent values cleanly — a count, a name, an `isOpen` flag. But the moment two pieces of state need to change together, or one transition has multiple branches (\"add the item if it's new, otherwise increment its quantity\"), `useState` starts to feel like a flowchart: several `setX` calls per handler, ordering matters, and bugs sneak in.\n\n`useReducer` lets you describe the transition as a single function: given the current state and an action, return the next state. The component fires off actions; the reducer decides what they mean.\n\nA quick smell test: if you find yourself writing two or three `setX` calls in a row inside one handler, that's usually `useReducer` knocking. Want to walk through a small example next?",
      },
    ],
  },
];

function assertLocalDatabase(): void {
  const url = process.env.DATABASE_URL ?? "";
  const isLocal =
    /localhost|127\.0\.0\.1|::1/.test(url) || url.startsWith("file:");
  const isProd = process.env.NODE_ENV === "production";
  if (!isLocal || isProd) {
    throw new Error(
      `Refusing to seed: DATABASE_URL must point to a local database, and NODE_ENV must not be production.\n  DATABASE_URL: ${url.replace(/:[^:@/]+@/, ":<redacted>@")}\n  NODE_ENV:     ${process.env.NODE_ENV ?? "(unset)"}`,
    );
  }
}

async function main() {
  assertLocalDatabase();

  console.log("→ Wiping any existing demo user...");
  await db.user.deleteMany({ where: { email: DEMO_EMAIL } });

  console.log("→ Creating demo user...");
  const user = await db.user.create({
    data: { email: DEMO_EMAIL, name: DEMO_NAME },
  });

  console.log("→ Creating session (for cookie-based local sign-in)...");
  await db.session.create({
    data: {
      sessionToken: DEMO_SESSION_TOKEN,
      userId: user.id,
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  console.log("→ Creating plan + days...");
  const plan = await db.plan.create({
    data: {
      userId: user.id,
      title: PLAN_TITLE,
      originalMarkdown: PLAN_ORIGINAL_MARKDOWN,
      active: true,
    },
  });

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await db.day.createMany({
    data: DAYS.map((d) => ({
      planId: plan.id,
      dayNumber: d.dayNumber,
      status: d.status,
      goal: d.goal,
      topics: d.topics,
      recap: "recap" in d ? d.recap : null,
      feedback: "feedback" in d ? d.feedback : null,
      completedAt: d.status === "completed" ? yesterday : null,
    })),
  });

  console.log("→ Creating in-progress transcript for day 2...");
  await db.dayConversation.create({
    data: {
      planId: plan.id,
      dayNumber: 2,
      messages: DAY_2_TRANSCRIPT as object,
    },
  });

  console.log("\n✅ Seed complete.\n");
  console.log(`   User:    ${user.name} <${user.email}>`);
  console.log(`   Plan:    "${plan.title}" (${DAYS.length} days, day 2 in progress)`);
  console.log(`\nTo sign in as the demo user without OAuth, set this cookie`);
  console.log(`on http://localhost:3000:\n`);
  console.log(`   Name:  authjs.session-token`);
  console.log(`   Value: ${DEMO_SESSION_TOKEN}\n`);
}

main()
  .catch((err) => {
    console.error("\n❌ Seed failed:");
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
