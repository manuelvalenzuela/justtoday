import type { ReactNode } from "react";

import { Sidebar, type SidebarUser } from "@/components/layout/sidebar";

export function AppShell({
  user,
  children,
}: {
  user: SidebarUser;
  children: ReactNode;
}) {
  return (
    <div className="flex h-dvh">
      <Sidebar user={user} />
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}
