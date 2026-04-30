"use client";

import { ArrowDown, ArrowUp, Plus, Trash2, Upload, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  convertPlanAction,
  savePlanAction,
} from "@/app/(app)/plans/new/actions";
import type { ParsedPlan } from "@/lib/plan-llm";

type Phase = "input" | "preview";

export function NewPlanFlow() {
  const [phase, setPhase] = useState<Phase>("input");
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState<ParsedPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    file.text().then((text) => setInput(text));
  }

  function handleConvert(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await convertPlanAction(input);
      if (result.ok) {
        setDraft(result.draft);
        setPhase("preview");
      } else {
        setError(result.error);
      }
    });
  }

  function handleSave() {
    if (!draft) return;
    setError(null);
    startTransition(async () => {
      const result = await savePlanAction(input, draft);
      if (!result.ok) {
        setError(result.error);
      }
    });
  }

  function updateTitle(title: string) {
    setDraft((d) => (d ? { ...d, title } : d));
  }

  function updateDay(idx: number, patch: Partial<ParsedPlan["days"][number]>) {
    setDraft((d) =>
      d
        ? {
            ...d,
            days: d.days.map((day, i) =>
              i === idx ? { ...day, ...patch } : day,
            ),
          }
        : d,
    );
  }

  function moveDay(idx: number, dir: -1 | 1) {
    setDraft((d) => {
      if (!d) return d;
      const target = idx + dir;
      if (target < 0 || target >= d.days.length) return d;
      const days = [...d.days];
      [days[idx], days[target]] = [days[target], days[idx]];
      return { ...d, days: renumber(days) };
    });
  }

  function removeDay(idx: number) {
    setDraft((d) =>
      d
        ? { ...d, days: renumber(d.days.filter((_, i) => i !== idx)) }
        : d,
    );
  }

  function addDay() {
    setDraft((d) =>
      d
        ? {
            ...d,
            days: renumber([
              ...d.days,
              { dayNumber: d.days.length + 1, goal: "", topics: [] },
            ]),
          }
        : d,
    );
  }

  function addTopic(idx: number) {
    setDraft((d) =>
      d
        ? {
            ...d,
            days: d.days.map((day, i) =>
              i === idx ? { ...day, topics: [...day.topics, ""] } : day,
            ),
          }
        : d,
    );
  }

  function updateTopic(dayIdx: number, topicIdx: number, value: string) {
    setDraft((d) =>
      d
        ? {
            ...d,
            days: d.days.map((day, i) =>
              i === dayIdx
                ? {
                    ...day,
                    topics: day.topics.map((t, j) =>
                      j === topicIdx ? value : t,
                    ),
                  }
                : day,
            ),
          }
        : d,
    );
  }

  function removeTopic(dayIdx: number, topicIdx: number) {
    setDraft((d) =>
      d
        ? {
            ...d,
            days: d.days.map((day, i) =>
              i === dayIdx
                ? {
                    ...day,
                    topics: day.topics.filter((_, j) => j !== topicIdx),
                  }
                : day,
            ),
          }
        : d,
    );
  }

  if (phase === "input") {
    return (
      <form onSubmit={handleConvert} className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <label htmlFor="plan-input" className="text-sm font-medium">
            Describe your plan
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-4" />
            Upload file
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.markdown,.txt,text/markdown,text/plain"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleFile(file);
              event.target.value = "";
            }}
          />
        </div>

        <Textarea
          id="plan-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Paste anything: a structured markdown plan, a ChatGPT outline, a list of topics, or just a few sentences about what you want to learn and over how many days."
          className="min-h-[320px] text-sm"
          spellCheck={false}
        />

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={pending || !input.trim()}>
            {pending ? "Reading…" : "Convert"}
          </Button>
        </div>
      </form>
    );
  }

  if (!draft) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Here&apos;s how I read your plan. Edit anything that doesn&apos;t look
          right, then save.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="plan-title" className="text-sm font-medium">
          Title
        </label>
        <Input
          id="plan-title"
          value={draft.title}
          onChange={(e) => updateTitle(e.target.value)}
          placeholder="Plan title"
        />
      </div>

      <div className="flex flex-col gap-4">
        {draft.days.map((day, idx) => (
          <div
            key={idx}
            className="flex flex-col gap-3 rounded-lg border border-border bg-card/50 p-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Day {idx + 1}</h3>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={idx === 0}
                  onClick={() => moveDay(idx, -1)}
                  aria-label="Move day up"
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={idx === draft.days.length - 1}
                  onClick={() => moveDay(idx, 1)}
                  aria-label="Move day down"
                >
                  <ArrowDown className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeDay(idx)}
                  aria-label="Remove day"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Goal</label>
              <Input
                value={day.goal}
                onChange={(e) => updateDay(idx, { goal: e.target.value })}
                placeholder="What this day is about"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Topics</label>
              <div className="flex flex-col gap-2">
                {day.topics.map((topic, topicIdx) => (
                  <div key={topicIdx} className="flex items-center gap-1">
                    <Input
                      value={topic}
                      onChange={(e) =>
                        updateTopic(idx, topicIdx, e.target.value)
                      }
                      placeholder="Topic"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeTopic(idx, topicIdx)}
                      aria-label="Remove topic"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  onClick={() => addTopic(idx)}
                >
                  <Plus className="size-4" />
                  Add topic
                </Button>
              </div>
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={addDay}
        >
          <Plus className="size-4" />
          Add day
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setPhase("input");
            setDraft(null);
            setError(null);
          }}
          disabled={pending}
        >
          Back
        </Button>
        <Button onClick={handleSave} disabled={pending}>
          {pending ? "Saving…" : "Save plan"}
        </Button>
      </div>
    </div>
  );
}

function renumber(days: ParsedPlan["days"]): ParsedPlan["days"] {
  return days.map((day, idx) => ({ ...day, dayNumber: idx + 1 }));
}
