"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const ABOUT_COPY =
  "justtoday is a study tracker built around one simple idea: you only need to think about today. Tell it what you're learning, and it turns the goal into a day-by-day plan you can actually follow. Each day you check in, talk through what you covered, and the plan adjusts to how things are really going. Whatever language you start in — Spanish, English, anything — is the language it'll keep speaking. When life shifts, the plan shifts with you.";

export function AboutPopover() {
  return (
    <Popover>
      <PopoverTrigger className="rounded-md px-2 py-1 text-left text-xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
        About
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={8} className="p-5">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {ABOUT_COPY}
        </p>
      </PopoverContent>
    </Popover>
  );
}
