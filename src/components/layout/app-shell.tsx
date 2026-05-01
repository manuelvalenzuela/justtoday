import type { ReactNode } from "react";

import { Sidebar, type SidebarPlan, type SidebarUser } from "@/components/layout/sidebar";

export function AppShell({
  user,
  plans,
  children,
}: {
  user: SidebarUser;
  plans: SidebarPlan[];
  children: ReactNode;
}) {
  return (
    <div className="flex h-dvh">
      <Sidebar user={user} plans={plans} />
      <main className="flex flex-1 min-w-0 flex-col">{children}</main>
    </div>
  );
}
