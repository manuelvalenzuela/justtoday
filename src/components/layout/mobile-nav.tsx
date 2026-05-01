"use client";

import { PanelLeft } from "lucide-react";
import { useState } from "react";

import {
  SidebarContent,
  type SidebarPlan,
  type SidebarUser,
} from "@/components/layout/sidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function MobileNav({
  user,
  plans,
}: {
  user: SidebarUser;
  plans: SidebarPlan[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open menu"
        className="-ml-1 inline-flex size-9 shrink-0 items-center justify-center rounded-md text-foreground/80 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <PanelLeft className="size-[1.05rem]" />
      </SheetTrigger>
      <SheetContent side="left">
        <SidebarContent
          user={user}
          plans={plans}
          onPlanSelect={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
