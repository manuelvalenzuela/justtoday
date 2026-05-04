import type { UIMessage } from "ai";

// Refinement chat constraints. These bound what we accept from clients on
// /api/plans/refine, /api/plans/refine/summarize, and on the savePlanAction
// `refinementMessages` arg. The values are intentionally loose enough for
// real conversations and tight enough to refuse abuse.
export const REFINE_MAX_MESSAGES = 30;
export const REFINE_MAX_PARTS_PER_MESSAGE = 8;
export const REFINE_MAX_TEXT_LEN = 8000;
export const REFINE_MAX_PAYLOAD_BYTES = 64_000;

export const REFINE_SOFT_CAP_USER_TURNS = 3;

type SanitizedPart = { type: "text"; text: string };
type SanitizedMessage = {
  id: string;
  role: "user" | "assistant";
  parts: SanitizedPart[];
};

// Returns a normalized UIMessage[] when the input is structurally sound and
// within bounds; null otherwise. We strip non-text parts and trim long ids
// rather than throwing — UIMessage shapes evolve and we don't want to break
// on harmless fields, but role/text content must be exactly what we expect.
export function sanitizeRefineMessages(value: unknown): UIMessage[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length === 0 || value.length > REFINE_MAX_MESSAGES) return null;

  const out: SanitizedMessage[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") return null;
    const m = raw as Record<string, unknown>;
    const id = typeof m.id === "string" && m.id.length > 0 ? m.id.slice(0, 64) : null;
    if (!id) return null;
    if (m.role !== "user" && m.role !== "assistant") return null;
    if (!Array.isArray(m.parts) || m.parts.length === 0) return null;
    if (m.parts.length > REFINE_MAX_PARTS_PER_MESSAGE) return null;

    const parts: SanitizedPart[] = [];
    for (const p of m.parts) {
      if (!p || typeof p !== "object") continue;
      const part = p as Record<string, unknown>;
      if (part.type !== "text") continue;
      if (typeof part.text !== "string") continue;
      if (part.text.length > REFINE_MAX_TEXT_LEN) return null;
      parts.push({ type: "text", text: part.text });
    }
    if (parts.length === 0) return null;

    out.push({ id, role: m.role, parts });
  }

  if (JSON.stringify(out).length > REFINE_MAX_PAYLOAD_BYTES) return null;

  return out as unknown as UIMessage[];
}
