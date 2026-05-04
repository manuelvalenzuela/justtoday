"use client";

import { experimental_useObject as useObject } from "@ai-sdk/react";
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { savePlanAction } from "@/app/(app)/plans/new/actions";
import { PLAN_SCHEMA, type ParsedPlan } from "@/lib/plan-schema";

type Phase = "input" | "preview";

const MAX_TARGET_DAYS = 60;

export function NewPlanFlow() {
  const [phase, setPhase] = useState<Phase>("input");
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState<ParsedPlan | null>(null);
  const [targetDays, setTargetDays] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastStreamedSnapshotRef = useRef<string | null>(null);

  const {
    object,
    submit,
    isLoading: isStreaming,
    error: streamError,
    stop,
  } = useObject({
    api: "/api/plans/parse",
    schema: PLAN_SCHEMA,
  });

  useEffect(() => {
    if (isStreaming || !object || draft) return;
    const candidate = sanitizeStreamed(object);
    if (!candidate) return;
    setDraft(candidate);
    lastStreamedSnapshotRef.current = JSON.stringify(candidate);
    setTargetDays((current) =>
      current === null ? candidate.days.length : current,
    );
  }, [isStreaming, object, draft]);

  function handleFile(file: File) {
    file.text().then((text) => setInput(text));
  }

  function handleConvert(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.trim()) return;
    setSaveError(null);
    setDraft(null);
    setTargetDays(null);
    lastStreamedSnapshotRef.current = null;
    setPhase("preview");
    submit({ input });
  }

  function handleBack() {
    if (isStreaming) stop();
    setPhase("input");
    setDraft(null);
    setTargetDays(null);
    setSaveError(null);
    lastStreamedSnapshotRef.current = null;
  }

  function isDraftDirty(): boolean {
    if (!draft || !lastStreamedSnapshotRef.current) return false;
    return JSON.stringify(draft) !== lastStreamedSnapshotRef.current;
  }

  function handleReshape() {
    if (isStreaming || saving || !targetDays || targetDays < 1) return;
    if (
      isDraftDirty() &&
      !window.confirm(
        "This will replace the current plan, including your edits. Continue?",
      )
    ) {
      return;
    }
    setSaveError(null);
    setDraft(null);
    lastStreamedSnapshotRef.current = null;
    submit({ input, days: targetDays });
  }

  function handleSave() {
    if (!draft) return;
    setSaveError(null);
    startSaving(async () => {
      const result = await savePlanAction(input, draft);
      if (!result.ok) setSaveError(result.error);
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
      d ? { ...d, days: renumber(d.days.filter((_, i) => i !== idx)) } : d,
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

        <div className="flex justify-end">
          <Button type="submit" disabled={!input.trim()}>
            Convert
          </Button>
        </div>
      </form>
    );
  }

  // preview phase — render whichever is freshest: edited draft (post-stream)
  // or the live partial object during streaming.
  const display: PartialPlan | ParsedPlan | null = draft ?? (object as PartialPlan | null);
  const actualDays = draft?.days.length ?? display?.days?.length ?? 0;
  const showDrift =
    !!draft &&
    !isStreaming &&
    targetDays !== null &&
    targetDays !== actualDays;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {isStreaming
            ? "Reading your plan…"
            : "Here's how I read your plan. Edit anything that doesn't look right, then save."}
        </p>
        {isStreaming ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
        ) : null}
      </div>

      {streamError ? (
        <p className="text-sm text-destructive">
          Stream failed: {streamError.message}
        </p>
      ) : null}

      {display ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-2">
            <label htmlFor="plan-title" className="text-sm font-medium">
              Title
            </label>
            <Input
              id="plan-title"
              value={draft?.title ?? display.title ?? ""}
              onChange={(e) => updateTitle(e.target.value)}
              placeholder="Plan title"
              disabled={isStreaming || !draft}
            />
          </div>
          <div className="flex flex-col gap-2 sm:w-44">
            <label htmlFor="plan-days" className="text-sm font-medium">
              Length
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="plan-days"
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_TARGET_DAYS}
                value={targetDays ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    setTargetDays(null);
                    return;
                  }
                  const parsed = Number.parseInt(raw, 10);
                  if (Number.isFinite(parsed)) {
                    setTargetDays(
                      Math.min(MAX_TARGET_DAYS, Math.max(1, parsed)),
                    );
                  }
                }}
                placeholder="—"
                disabled={isStreaming || !draft}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">
                days{showDrift ? ` (actual: ${actualDays})` : ""}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={handleReshape}
                disabled={
                  isStreaming ||
                  saving ||
                  !draft ||
                  !targetDays ||
                  targetDays === actualDays
                }
                aria-label={
                  targetDays
                    ? `Re-shape plan to ${targetDays} day${targetDays === 1 ? "" : "s"}`
                    : "Re-shape plan to this length"
                }
                title="Re-shape plan to this length"
              >
                <RefreshCw className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        {(draft?.days ?? display?.days ?? []).map((day, idx) => {
          const editable = !!draft && !isStreaming;
          return (
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
                    disabled={!editable || idx === 0}
                    onClick={() => moveDay(idx, -1)}
                    aria-label="Move day up"
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={
                      !editable ||
                      idx === (draft?.days.length ?? display?.days?.length ?? 0) - 1
                    }
                    onClick={() => moveDay(idx, 1)}
                    aria-label="Move day down"
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={!editable}
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
                  value={day?.goal ?? ""}
                  onChange={(e) => updateDay(idx, { goal: e.target.value })}
                  placeholder="What this day is about"
                  disabled={!editable}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">Topics</label>
                <div className="flex flex-col gap-2">
                  {(day?.topics ?? []).map((topic, topicIdx) => (
                    <div key={topicIdx} className="flex items-center gap-1">
                      <Input
                        value={topic ?? ""}
                        onChange={(e) =>
                          updateTopic(idx, topicIdx, e.target.value)
                        }
                        placeholder="Topic"
                        disabled={!editable}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeTopic(idx, topicIdx)}
                        disabled={!editable}
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
                    disabled={!editable}
                    onClick={() => addTopic(idx)}
                  >
                    <Plus className="size-4" />
                    Add topic
                  </Button>
                </div>
              </div>
            </div>
          );
        })}

        {draft && !isStreaming ? (
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
        ) : null}
      </div>

      {saveError ? (
        <p className="text-sm text-destructive">{saveError}</p>
      ) : null}

      <div className="flex justify-between">
        <Button type="button" variant="ghost" onClick={handleBack} disabled={saving}>
          {isStreaming ? "Cancel" : "Back"}
        </Button>
        <Button onClick={handleSave} disabled={!draft || isStreaming || saving}>
          {saving ? "Saving…" : "Save plan"}
        </Button>
      </div>
    </div>
  );
}

type PartialDay = Partial<ParsedPlan["days"][number]>;
type PartialPlan = { title?: string; days?: PartialDay[] };

function renumber(days: ParsedPlan["days"]): ParsedPlan["days"] {
  return days.map((day, idx) => ({ ...day, dayNumber: idx + 1 }));
}

function sanitizeStreamed(obj: unknown): ParsedPlan | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as PartialPlan;
  if (typeof o.title !== "string" || !o.title.trim()) return null;
  if (!Array.isArray(o.days) || o.days.length === 0) return null;

  const days: ParsedPlan["days"] = [];
  for (const [idx, raw] of o.days.entries()) {
    if (!raw || typeof raw.goal !== "string" || !raw.goal.trim()) return null;
    const topics = Array.isArray(raw.topics)
      ? raw.topics.filter(
          (t): t is string => typeof t === "string" && t.trim().length > 0,
        )
      : [];
    days.push({ dayNumber: idx + 1, goal: raw.goal.trim(), topics });
  }

  return { title: o.title.trim(), days };
}
