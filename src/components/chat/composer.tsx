"use client";

import { ArrowUp } from "lucide-react";
import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ComposerHandle = {
  focus: () => void;
};

type ComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
};

export const Composer = forwardRef<ComposerHandle, ComposerProps>(
  function Composer(
    { value, onChange, onSubmit, disabled, placeholder },
    ref,
  ) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
    }));

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      if (disabled || !value.trim()) return;
      onSubmit();
    }

    function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        if (disabled || !value.trim()) return;
        onSubmit();
      }
    }

    const canSend = !disabled && value.trim().length > 0;

    return (
      <form onSubmit={handleSubmit} className="px-4 pb-4 pt-2">
        <div
          className={cn(
            "mx-auto flex w-full max-w-[720px] items-end gap-2 rounded-2xl border bg-background px-3 py-2 shadow-sm transition-colors",
            "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30",
          )}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? "Message justtoday…"}
            rows={1}
            disabled={disabled}
            className="field-sizing-content max-h-48 min-h-7 flex-1 resize-none bg-transparent text-[0.95rem] leading-relaxed outline-none placeholder:text-muted-foreground disabled:opacity-50"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!canSend}
            aria-label="Send"
            className="size-8 shrink-0 rounded-full"
          >
            <ArrowUp className="size-4" />
          </Button>
        </div>
      </form>
    );
  },
);
