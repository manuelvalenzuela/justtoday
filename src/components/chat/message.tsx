import type { UIMessage } from "ai";

import { cn } from "@/lib/utils";

export function Message({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const text = message.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("");

  if (!text) return null;

  return (
    <div
      className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap text-[0.95rem] leading-relaxed",
          isUser
            ? "rounded-2xl bg-muted px-4 py-2.5 text-foreground"
            : "text-foreground",
        )}
      >
        {text}
      </div>
    </div>
  );
}
