"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import * as React from "react";

import { cn } from "@/lib/utils";

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;

type SheetSide = "left" | "right";

const sideStyles: Record<SheetSide, string> = {
  left: [
    "left-0 top-0 h-dvh border-r",
    "data-[starting-style]:-translate-x-full",
    "data-[ending-style]:-translate-x-full",
  ].join(" "),
  right: [
    "right-0 top-0 h-dvh border-l",
    "data-[starting-style]:translate-x-full",
    "data-[ending-style]:translate-x-full",
  ].join(" "),
};

function SheetContent({
  className,
  side = "left",
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Popup> & {
  side?: SheetSide;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]",
          "transition-opacity duration-200 ease-out",
          "data-[starting-style]:opacity-0",
          "data-[ending-style]:opacity-0",
        )}
      />
      <DialogPrimitive.Popup
        className={cn(
          "fixed z-50 flex w-[min(320px,80vw)] flex-col overflow-hidden bg-sidebar text-sidebar-foreground shadow-xl outline-none",
          "transition-transform duration-200 ease-out",
          sideStyles[side],
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

export { Sheet, SheetTrigger, SheetClose, SheetContent };
