import Link from "next/link";

import { ChatSurface } from "@/components/chat/chat-surface";
import { TodayPill } from "@/components/chat/today-pill";
import { MobileHeader } from "@/components/layout/mobile-header";
import { buttonVariants } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { getActiveTranscript } from "@/server/conversations";
import { getActivePlan, listPlansForUser } from "@/server/plans";

export default async function Home() {
  const session = await auth();
  if (!session?.user) return null;

  const [active, plans, transcript] = await Promise.all([
    getActivePlan(session.user.id),
    listPlansForUser(session.user.id),
    getActiveTranscript(session.user.id),
  ]);

  if (active) {
    const nextDay = active.days.find((d) => d.status === "pending");
    const today = nextDay
      ? {
          dayNumber: nextDay.dayNumber,
          goal: nextDay.goal,
          topics: nextDay.topics,
        }
      : null;

    const initialMessages =
      transcript &&
      transcript.planId === active.id &&
      nextDay &&
      transcript.dayNumber === nextDay.dayNumber
        ? transcript.messages
        : [];

    return (
      <>
        <MobileHeader>
          {today ? (
            <TodayPill
              dayNumber={today.dayNumber}
              goal={today.goal}
              topics={today.topics}
            />
          ) : (
            <h2 className="truncate text-sm font-medium tracking-tight">
              {active.title}
            </h2>
          )}
        </MobileHeader>
        <ChatSurface
          key={`${active.id}:${nextDay?.dayNumber ?? "done"}`}
          planTitle={active.title}
          today={today}
          initialMessages={initialMessages}
        />
      </>
    );
  }

  return (
    <>
      <MobileHeader>
        <h2 className="text-sm font-medium tracking-tight">Today</h2>
      </MobileHeader>
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-[720px] px-6 py-12 text-center">
          <h2 className="text-xl font-semibold tracking-tight">Today</h2>
          {plans.length === 0 ? (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                Load a plan to get started.
              </p>
              <div className="mt-6">
                <Link href="/plans/new" className={buttonVariants()}>
                  New plan
                </Link>
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Pick a plan from the sidebar to begin.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
