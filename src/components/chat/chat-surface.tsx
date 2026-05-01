"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Composer } from "./composer";
import { Message } from "./message";
import { ScrollToBottomPill } from "./scroll-to-bottom-pill";
import { TodayPill } from "./today-pill";
import { TodaySummary } from "./today-summary";

export type TodayInfo = {
  dayNumber: number;
  goal: string;
  topics: string[];
};

export type ChatSurfaceProps = {
  planTitle: string;
  today: TodayInfo | null;
  initialMessages?: UIMessage[];
};

const NEAR_BOTTOM_THRESHOLD = 120;

export function ChatSurface({
  planTitle,
  today,
  initialMessages,
}: ChatSurfaceProps) {
  const [input, setInput] = useState("");
  const surfaceRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerWrapperRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const [showScrollPill, setShowScrollPill] = useState(false);
  const router = useRouter();

  const { messages, sendMessage, status, error } = useChat({
    messages: initialMessages,
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

  // Track whether the user is near the bottom so we can decide whether to
  // auto-scroll on new content. If they've scrolled up to read context, we
  // don't yank them down on every streamed token.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      const near = distance <= NEAR_BOTTOM_THRESHOLD;
      nearBottomRef.current = near;
      setShowScrollPill(!near);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    return () => el.removeEventListener("scroll", update);
  }, []);

  // Auto-scroll on new content only if the user was already near the bottom.
  useEffect(() => {
    if (!nearBottomRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Measure composer height → CSS var so the message list reserves the right
  // amount of bottom space (and the scroll-to-bottom pill rides above it).
  useEffect(() => {
    const surface = surfaceRef.current;
    const composer = composerWrapperRef.current;
    if (!surface || !composer) return;
    const apply = () => {
      surface.style.setProperty(
        "--composer-h",
        `${composer.offsetHeight}px`,
      );
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(composer);
    return () => observer.disconnect();
  }, []);

  // Dedupe by id before rendering — persisted transcripts can occasionally
  // contain duplicate message ids from past streaming edge cases, which would
  // otherwise trip React's "two children with the same key" warning.
  const renderedMessages = useMemo(() => {
    const seen = new Set<string>();
    return messages.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }, [messages]);

  const isStreaming = status === "submitted" || status === "streaming";

  function handleSubmit() {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  function scrollToBottom() {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }

  const hasMessages = renderedMessages.length > 0;
  const showTopChrome = today !== null;

  return (
    <div
      ref={surfaceRef}
      className="relative flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <div ref={scrollRef} className="absolute inset-0 overflow-y-auto">
        <div
          className="flex min-h-full flex-col"
          style={{
            paddingTop: showTopChrome ? "3.5rem" : "2rem",
            paddingBottom: `calc(var(--composer-h, 4.5rem) + 3rem)`,
          }}
        >
          <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col px-6">
            {hasMessages ? (
              <div className="flex flex-col gap-6 py-6">
                {renderedMessages.map((message) => (
                  <Message key={message.id} message={message} />
                ))}
                {error ? (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {error.message || "Something went wrong. Try again."}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center py-6">
                {today ? (
                  <TodaySummary
                    dayNumber={today.dayNumber}
                    goal={today.goal}
                    topics={today.topics}
                    className="w-full"
                  />
                ) : (
                  <p className="text-center text-base text-muted-foreground">
                    All days complete. Add a new plan to keep going.
                  </p>
                )}
                {error ? (
                  <div className="mt-6 w-full rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {error.message || "Something went wrong. Try again."}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      {showTopChrome ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 hidden md:block">
          <div className="pointer-events-auto bg-background">
            <div className="flex h-14 items-center px-4 md:px-6">
              {today ? (
                <TodayPill
                  dayNumber={today.dayNumber}
                  goal={today.goal}
                  topics={today.topics}
                />
              ) : (
                <h2 className="truncate text-sm font-medium tracking-tight">
                  {planTitle}
                </h2>
              )}
            </div>
          </div>
          <div className="h-8 bg-gradient-to-b from-background to-transparent" />
        </div>
      ) : null}

      <ScrollToBottomPill visible={showScrollPill} onClick={scrollToBottom} />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
        <div className="h-8 bg-gradient-to-t from-background to-transparent" />
        <div ref={composerWrapperRef} className="pointer-events-auto bg-background">
          <Composer
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            disabled={isStreaming}
          />
        </div>
      </div>
    </div>
  );
}
