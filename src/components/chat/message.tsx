import { cn } from "@/lib/utils";

import type { ChatMessage } from "./types";

export function Message({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap text-[0.95rem] leading-relaxed",
          isUser
            ? "rounded-2xl bg-muted px-4 py-2.5 text-foreground"
            : "text-foreground",
        )}
      >
        {message.content}
      </div>
    </div>
  );
}
