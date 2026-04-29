"use client";

import { Upload } from "lucide-react";
import { useActionState, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  createPlanAction,
  type CreatePlanState,
} from "@/app/(app)/plans/new/actions";

const initialState: CreatePlanState = { status: "idle" };

export function ImportForm() {
  const [markdown, setMarkdown] = useState("");
  const [state, formAction] = useActionState(createPlanAction, initialState);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    file.text().then((text) => setMarkdown(text));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("markdown", markdown);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <label htmlFor="plan-markdown" className="text-sm font-medium">
          Plan markdown
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="size-4" />
          Upload .md
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.markdown,text/markdown,text/plain"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) handleFile(file);
            event.target.value = "";
          }}
        />
      </div>

      <Textarea
        id="plan-markdown"
        name="markdown"
        value={markdown}
        onChange={(event) => setMarkdown(event.target.value)}
        placeholder={`# My Study Plan\n\n## Day 1\n**Goal:** Understand X\n- Topic A\n- Topic B`}
        className="min-h-[320px] font-mono text-sm"
        spellCheck={false}
      />

      {state.status === "error" ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending || !markdown.trim()}>
          {isPending ? "Saving…" : "Create plan"}
        </Button>
      </div>
    </form>
  );
}
