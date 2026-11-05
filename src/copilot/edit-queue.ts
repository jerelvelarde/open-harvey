// The redline edits waiting to be told to the agent (copilot/useTellCopilot.ts), as plain functions so
// they are tested on their own. No CopilotKit imports here. readEditMessage turns a sent edit message
// back into its parts, so the chat can show it as a quiet event row (copilot/ChatUserMessage.tsx), and
// editSummary says what changed in a few words ("12 months of fees" → "6 months of fees, with a
// $1,000,000 cap for data-protection breaches").
//
// An edit made while the agent is busy (mid-reply, or waiting on a card) is queued, not dropped.
// Edits to the same redline coalesce: the agent hears the text it last knew and the latest, once.

import { redlineSummary } from "@/lib/review";
import type { RedlineEdit } from "@/lib/store";

export type Edit = RedlineEdit;

/** 'I changed the §8.2 redline (PB-LIAB-01) from "…" to "…".' */
export const describeEdit = (edit: Edit) => `I changed the ${edit.cite} redline (${edit.ruleId}) from "${edit.before}" to "${edit.after}".`;

/** Edit messages get ids with this prefix, so the chat can tell them from what a person typed. */
export const HUMAN_EDIT_ID_PREFIX = "human-edit-";

export type EditLine = { cite: string; ruleId: string; before: string; after: string };

const EDIT_SENTENCE = /\s*I changed the (§\d+\.\d+) redline \((PB-[A-Z]+-\d{2})\) from "([\s\S]*?)" to "([\s\S]*?)"\.(?=\s+I changed the §|\s*$)/y;

/** The parts of a message editMessage() wrote, in order, or null when the text is not one. */
export function readEditMessage(text: string): EditLine[] | null {
  const lines: EditLine[] = [];
  EDIT_SENTENCE.lastIndex = 0;
  const source = text.trimEnd();
  while (EDIT_SENTENCE.lastIndex < source.length) {
    const match = EDIT_SENTENCE.exec(source);
    if (!match) return null;
    lines.push({ cite: match[1], ruleId: match[2], before: match[3], after: match[4] });
  }
  return lines.length ? lines : null;
}

/** Add an edit. A second edit to the same redline keeps the first "before" and takes the new "after". */
export function enqueueEdit(queue: readonly Edit[], edit: Edit): Edit[] {
  const index = queue.findIndex((e) => e.matterId === edit.matterId && e.ruleId === edit.ruleId);
  if (index === -1) return [...queue, edit];
  return queue.map((e, i) => (i === index ? { ...e, after: edit.after } : e));
}

/**
 * The message to send for the queued edits, oldest first, or null when there is nothing to say.
 * Edits to a matter that is no longer open are dropped (the agent sees the redlines in the app
 * context either way), and so are edits that ended where they started.
 */
export function editMessage(queue: readonly Edit[], openMatterId: string | null): string | null {
  const lines = queue.filter((e) => e.matterId === openMatterId && e.before !== e.after).map(describeEdit);
  return lines.length ? lines.join(" ") : null;
}

/**
 * The words that changed between two versions of a redline, with up to `context` unchanged words
 * after the change, so "12" → "6" reads as "12 months of fees" → "6 months of fees".
 */
export function changedSpan(before: string, after: string, context = 3): { before: string; after: string } {
  const a = before.split(/\s+/).filter(Boolean);
  const b = after.split(/\s+/).filter(Boolean);
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const tail = Math.min(context, a.length - endA);
  const strip = (words: string[]) => words.join(" ").replace(/[.,;:]$/, "");
  return { before: strip(a.slice(start, endA + tail)), after: strip(b.slice(start, endB + tail)) };
}

/**
 * An edit in a few words. For a rule with a summary (the liability cap) both sides are summarised, so
 * the edit reads "12 months of fees → 6 months of fees, with a $1,000,000 cap for data-protection
 * breaches"; otherwise it is the words that changed.
 */
export function editSummary(ruleId: string, before: string, after: string): { before: string; after: string } {
  const a = redlineSummary(ruleId, before);
  const b = redlineSummary(ruleId, after);
  return a && b && a !== b ? { before: a, after: b } : changedSpan(before, after);
}

type AgentMessages = { role: string; toolCalls?: { id: string }[]; toolCallId?: string }[];

/**
 * True while the agent is mid-turn: running, or waiting on a tool call (the plan and approval cards
 * wait for a click). When `followUpPending` is set, a tool result with nothing after it also counts:
 * CopilotKit is about to send it back to the model in a follow-up run.
 */
export function isBusy(agent: { isRunning: boolean; messages: AgentMessages }, followUpPending = true): boolean {
  if (agent.isRunning) return true;
  const answered = new Set(agent.messages.filter((m) => m.role === "tool").map((m) => m.toolCallId));
  if (agent.messages.some((m) => m.role === "assistant" && m.toolCalls?.some((call) => !answered.has(call.id)))) return true;
  return followUpPending && agent.messages.at(-1)?.role === "tool";
}
