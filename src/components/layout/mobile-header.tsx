import type { ReactNode } from "react";

import { MobileNav } from "@/components/layout/mobile-nav";
import { auth } from "@/lib/auth";
import { listPlansForUser } from "@/server/plans";

export async function MobileHeader({ children }: { children?: ReactNode }) {
  const session = await auth();
  if (!session?.user) return null;
  const plans = await listPlansForUser(session.user.id);

  return (
    <header className="md:hidden sticky top-0 z-30 shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pt-[env(safe-area-inset-top)]">
      <div className="flex h-14 items-center gap-2 px-3">
        <MobileNav user={session.user} plans={plans} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </header>
  );
}
