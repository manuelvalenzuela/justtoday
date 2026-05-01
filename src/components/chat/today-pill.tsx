"use client";

import { ChevronDown } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { TodaySummary } from "./today-summary";

export type TodayPillProps = {
  dayNumber: number;
  goal: string;
  topics: string[];
};

export function TodayPill({ dayNumber, goal, topics }: TodayPillProps) {
  return (
    <Popover>
      <PopoverTrigger
        className="group inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium tracking-tight text-foreground/90 outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-muted"
        aria-label={`Day ${dayNumber} details`}
      >
        <span className="text-[0.7rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Day {dayNumber}
        </span>
        <span aria-hidden className="text-muted-foreground/50">
          ·
        </span>
        <span className="min-w-0 truncate text-foreground/90">{goal}</span>
        <ChevronDown
          aria-hidden
          className="size-3 shrink-0 text-muted-foreground transition-transform duration-200 group-aria-expanded:rotate-180"
        />
      </PopoverTrigger>
      <PopoverContent className="p-4">
        <TodaySummary dayNumber={dayNumber} goal={goal} topics={topics} />
      </PopoverContent>
    </Popover>
  );
}
