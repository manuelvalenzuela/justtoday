import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { listPlansForUser } from "@/server/plans";

export default async function Home() {
  const session = await auth();
  const plans = session?.user
    ? await listPlansForUser(session.user.id)
    : [];

  return (
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
  );
}
