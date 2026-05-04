"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Composer } from "@/components/chat/composer";
import { Message } from "@/components/chat/message";
import { Button } from "@/components/ui/button";
import { REFINE_SOFT_CAP_USER_TURNS } from "@/lib/refine-messages";

type RefineChatProps = {
  seedInput: string;
  onBack: () => void;
  onGenerate: (summary: string, messages: UIMessage[]) => void;
};

export function RefineChat({ seedInput, onBack, onGenerate }: RefineChatProps) {
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const seedSentRef = useRef(false);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/plans/refine" }),
  });

  useEffect(() => {
    if (seedSentRef.current) return;
    if (!seedInput.trim()) return;
    seedSentRef.current = true;
    sendMessage({ text: seedInput.trim() });
  }, [seedInput, sendMessage]);

  const isStreaming = status === "submitted" || status === "streaming";
  const userTurnCount = messages.filter((m) => m.role === "user").length;
  const aboveSoftCap = userTurnCount >= REFINE_SOFT_CAP_USER_TURNS;
  const composerDisabled = isStreaming || generating;
  // Per spec, Generate plan is "always available from turn 1" — including
  // while the assistant is mid-stream. We only block on `generating` itself
  // to prevent re-entrant summary calls.
  const canGenerate = userTurnCount > 0 && !generating;

  function handleComposerSubmit() {
    const trimmed = input.trim();
    if (!trimmed || composerDisabled) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  async function handleGenerate() {
    if (!canGenerate) return;
    setGenerateError(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/plans/refine/summarize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      if (!res.ok) {
        throw new Error(`Summarize failed (${res.status})`);
      }
      const data = (await res.json()) as { summary?: unknown };
      const summary = typeof data.summary === "string" ? data.summary.trim() : "";
      if (!summary) {
        throw new Error("Empty summary returned.");
      }
      onGenerate(summary, messages);
    } catch (err) {
      setGenerateError(
        err instanceof Error ? err.message : "Could not generate the plan.",
      );
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-medium tracking-tight">
          Let&apos;s define it together
        </h2>
        <p className="text-sm text-muted-foreground">
          A short conversation to shape your plan. Click{" "}
          <span className="font-medium">Generate plan</span> whenever you&apos;re
          ready.
        </p>
      </div>

      <div className="flex flex-col gap-6 rounded-lg border border-border bg-card/30 p-4 sm:p-6">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sending your input…</p>
        ) : (
          messages.map((m) => <Message key={m.id} message={m} />)
        )}
        {isStreaming &&
        messages[messages.length - 1]?.role !== "assistant" ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Thinking…
          </div>
        ) : null}
        {error ? (
          <p className="text-sm text-destructive">
            {error.message || "Something went wrong. Try again."}
          </p>
        ) : null}
      </div>

      <Composer
        value={input}
        onChange={setInput}
        onSubmit={handleComposerSubmit}
        disabled={composerDisabled}
        placeholder={
          aboveSoftCap
            ? "Add anything else, or click Generate plan."
            : "Reply…"
        }
      />

      {aboveSoftCap ? (
        <p className="text-center text-xs text-muted-foreground">
          We have enough — ready when you are.
        </p>
      ) : null}

      {generateError ? (
        <p className="text-sm text-destructive">{generateError}</p>
      ) : null}

      <div className="flex justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          disabled={generating}
        >
          Back
        </Button>
        <Button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate}
          size={aboveSoftCap ? "lg" : "default"}
          className={aboveSoftCap ? "ring-2 ring-primary/40" : undefined}
        >
          {generating ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Generating…
            </>
          ) : (
            "Generate plan"
          )}
        </Button>
      </div>
    </div>
  );
}
