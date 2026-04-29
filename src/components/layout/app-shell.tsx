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
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}
