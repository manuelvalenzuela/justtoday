"use client";

import { ArrowDown } from "lucide-react";

import { cn } from "@/lib/utils";

type ScrollToBottomPillProps = {
  visible: boolean;
  onClick: () => void;
};

export function ScrollToBottomPill({
  visible,
  onClick,
}: ScrollToBottomPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Scroll to latest"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      style={{ bottom: `calc(var(--composer-h, 4.5rem) + 0.75rem)` }}
      className={cn(
        "absolute left-1/2 z-20 flex size-9 -translate-x-1/2 items-center justify-center rounded-full border bg-background text-foreground/80 shadow-md transition-[opacity,transform] duration-200 ease-out hover:text-foreground hover:shadow-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-2 opacity-0",
      )}
    >
      <ArrowDown className="size-4" />
    </button>
  );
}
