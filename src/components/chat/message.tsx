import type { UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
          "max-w-[85%] text-[0.95rem] leading-relaxed",
          isUser
            ? "whitespace-pre-wrap rounded-2xl bg-muted px-4 py-2.5 text-foreground"
            : "prose prose-neutral max-w-none text-foreground dark:prose-invert prose-p:my-2 prose-ol:my-2 prose-ul:my-2 prose-li:my-0.5 prose-headings:font-semibold prose-headings:tracking-tight prose-pre:bg-muted prose-pre:text-foreground prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:before:content-none prose-code:after:content-none",
        )}
      >
        {isUser ? (
          text
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        )}
      </div>
    </div>
  );
}
