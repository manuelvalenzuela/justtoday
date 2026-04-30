"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Composer } from "./composer";
import { Message } from "./message";

export type ChatSurfaceProps = {
  planTitle: string;
  greeting?: string;
};

export function ChatSurface({ planTitle, greeting }: ChatSurfaceProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onFinish: ({ message }) => {
      const planMutated = message.parts.some(
        (p) =>
          (p.type === "tool-closeOutDay" ||
            p.type === "tool-adjustUpcomingDays") &&
          "state" in p &&
          p.state === "output-available",
      );
      if (planMutated) router.refresh();
    },
  });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const isStreaming = status === "submitted" || status === "streaming";

  function handleSubmit() {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center border-b px-6">
        <h2 className="text-sm font-medium tracking-tight">{planTitle}</h2>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-6 py-8">
          {messages.length === 0 ? (
            <div className="pt-12 text-center">
              <p className="text-base text-muted-foreground">
                {greeting ?? "What would you like to work on today?"}
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <Message key={message.id} message={message} />
            ))
          )}

          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error.message || "Something went wrong. Try again."}
            </div>
          ) : null}
        </div>
      </div>

      <Composer
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        disabled={isStreaming}
      />
    </div>
  );
}
