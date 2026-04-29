"use client";

import { useEffect, useRef, useState } from "react";

import { Composer } from "./composer";
import { Message } from "./message";
import type { ChatMessage } from "./types";

export type ChatSurfaceProps = {
  planTitle: string;
  greeting?: string;
};

export function ChatSurface({ planTitle, greeting }: ChatSurfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  function handleSubmit() {
    const trimmed = input.trim();
    if (!trimmed) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };
    const assistantStub: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "(LLM responses arrive in Phase 6.)",
    };

    setMessages((prev) => [...prev, userMessage, assistantStub]);
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
        </div>
      </div>

      <Composer value={input} onChange={setInput} onSubmit={handleSubmit} />
    </div>
  );
}
