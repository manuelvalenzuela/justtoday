import { LogOut } from "lucide-react";
import Image from "next/image";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth";

export type SidebarUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export function Sidebar({ user }: { user: SidebarUser }) {
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="px-5 py-4 border-b">
        <h1 className="text-base font-semibold tracking-tight">justtoday</h1>
      </div>

      <div className="flex-1 px-3 py-4">
        <h2 className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Plans
        </h2>
        <p className="mt-3 px-2 text-sm text-muted-foreground">No plans yet.</p>
      </div>

      <div className="border-t px-3 py-3">
        <div className="flex items-center gap-3 px-1">
          {user.image ? (
            <Image
              src={user.image}
              alt=""
              width={32}
              height={32}
              className="rounded-full"
            />
          ) : (
            <div className="size-8 rounded-full bg-muted" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {user.name ?? "Signed in"}
            </p>
            {user.email ? (
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <ThemeToggle />
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/signin" });
            }}
          >
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </Button>
          </form>
        </div>
      </div>
    </aside>
  );
}
