import { LogOut, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { setActivePlanAction, signOutAction } from "@/app/(app)/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SidebarUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export type SidebarPlan = {
  id: string;
  title: string;
  active: boolean;
};

export function Sidebar({
  user,
  plans,
}: {
  user: SidebarUser;
  plans: SidebarPlan[];
}) {
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <SidebarContent user={user} plans={plans} />
    </aside>
  );
}

export function SidebarContent({
  user,
  plans,
  onPlanSelect,
}: {
  user: SidebarUser;
  plans: SidebarPlan[];
  onPlanSelect?: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-5 py-4 border-b">
        <h1 className="text-base font-semibold tracking-tight">justtoday</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Plans
          </h2>
          <Link
            href="/plans/new"
            aria-label="New plan"
            onClick={onPlanSelect}
            className={buttonVariants({
              variant: "ghost",
              size: "icon",
              className: "size-7",
            })}
          >
            <Plus className="size-4" />
          </Link>
        </div>

        {plans.length === 0 ? (
          <p className="mt-3 px-2 text-sm text-muted-foreground">
            No plans yet.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-0.5">
            {plans.map((plan) => (
              <li key={plan.id}>
                <form action={setActivePlanAction} onSubmit={onPlanSelect}>
                  <input type="hidden" name="planId" value={plan.id} />
                  <button
                    type="submit"
                    className={cn(
                      "block w-full truncate rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                      plan.active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/90 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                    )}
                  >
                    {plan.title}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
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
          <form action={signOutAction}>
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
    </div>
  );
}
