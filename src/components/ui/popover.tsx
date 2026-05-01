"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import * as React from "react";

import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;

function PopoverContent({
  className,
  side = "bottom",
  align = "start",
  sideOffset = 6,
  alignOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Popup> & {
  side?: React.ComponentProps<typeof PopoverPrimitive.Positioner>["side"];
  align?: React.ComponentProps<typeof PopoverPrimitive.Positioner>["align"];
  sideOffset?: number;
  alignOffset?: number;
}) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        className="z-50 outline-none"
      >
        <PopoverPrimitive.Popup
          className={cn(
            "w-[min(22rem,calc(100vw-1.5rem))] rounded-xl border border-border/80 bg-popover text-popover-foreground shadow-lg outline-none",
            "origin-[var(--transform-origin)] transition duration-150 ease-out",
            "data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0",
            "data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0",
            className,
          )}
          {...props}
        >
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverTrigger, PopoverContent };
