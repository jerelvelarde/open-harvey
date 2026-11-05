// Concept: show the agent's work, as the best legal AI products do.
//
// CopilotChat's "turn" tool-call display (toolCallDisplay: "turn", set in ChatPanel.tsx) folds a
// turn's tool calls behind one line. While the turn runs, that line is the one live line in the
// thread ("Working: Security standards and audits · 8 of 17"): the rail's Plan is the checklist, so
// the rows stay folded (TurnSummary closes them once, through the slot's own toggle) and open on a
// click. Once the reply is done the line reads "Done in 10s · Read Acme Cloud · Ran 16 tasks". A
// call joins that display only when its renderer opts in with
// `group: true`. This registers one wildcard renderer (useRenderTool with name "*") for the data
// tools, the ones with no card of their own, and writes each call as a sentence: present tense
// while it runs ("Running liability…"), past tense with its result when it is done ("Limitation
// of liability · §8.2 · deviation, high risk · PB-LIAB-01"). Never a raw tool name. The cards
// (useGenerativeUI.tsx) and the two gates (useProposePlan.tsx, useRequestApproval.tsx) have
// renderers of their own, so they always show.
//
// TurnSummary is the folded line (the `workSummary` slot, set in ChatPanel.tsx): it names the
// steps the turn took ("Read Acme Cloud · Ran 17 tasks · 7 deviations") and leaves the cards out of it.

import { useRenderTool, type CopilotChatWorkSummaryProps } from "@copilotkit/react-core/v2";
import { useEffect, useRef } from "react";
import { WorkRow, WorkSummary } from "@/components/ui/WorkRow";
import { COLLECTION_DOCS, COLUMNS } from "@/lib/collection";
import { appStore, matterView, useAppState } from "@/lib/store";

type Args = Record<string, unknown>;
type Result = Record<string, unknown> & { error?: string };
type Words = {
  running: (args: Args) => string;
  done: (args: Args, result: Result) => { text: string; detail?: string };
  /** The step in a few words, for the folded summary line. */
  short: (args: Args, result: Result) => string;
};

/** The running step's own title, from the open matter's plan. */
function taskTitleOf(args: Args): string {
  const state = appStore.getState();
  const id = typeof args.matterId === "string" ? args.matterId : state.activeMatterId;
  if (!id || !state.matters[id]) return "the next step";
  return matterView(state, id).plan.find((t) => t.id === args.taskId)?.title ?? "the next step";
}

/** What a turn did with a card or a gate, for the folded summary line, so it is never a bare "Worked for 1s". */
const CARD_WORDS: Record<string, (result: Result) => string> = {
  proposePlan: (r) => (r.approved === true ? "You approved the plan" : r.approved === false ? "Not yet" : "Proposed the plan"),
  requestApproval: (r) => (r.sent === true ? "You sent it for approval" : r.sent === false ? "Nothing sent" : "Asked before sending"),
  showFindings: () => "Showed the findings",
  showRedlines: () => "Showed the redlines",
  showRecheck: () => "Showed the re-check",
};

/** "4 of 17: Limitation of liability" → "Limitation of liability" */
const taskTitle = (r: Result) => String(r.task ?? "").replace(/^\d+ of \d+: /, "");
const RESULT: Record<string, string> = { deviation: "deviation", pass: "passes", request: "request drafted", info: "noted" };

/** The words for each data tool: what it is doing, and what it did. */
const WORK: Record<string, Words> = {
  readMatter: {
    running: () => "Reading the matter…",
    done: (_, r) => ({ text: `Read the ${r.title ?? "matter"}`, detail: r.sections ? `${r.sections} sections · ${Number(r.words).toLocaleString("en-US")} words` : undefined }),
    short: (_, r) => `Read ${String(r.title ?? "the matter").split(" · ")[0]}`,
  },
  runPlanTask: {
    running: (a) => `Running: ${taskTitleOf(a)}…`,
    done: (_, r) => {
      const result = typeof r.result === "string" ? RESULT[r.result] : null;
      const detail = [r.cite, result && (r.risk ? `${result}, ${r.risk} risk` : result), r.ruleId].filter(Boolean).join(" · ");
      return { text: taskTitle(r) || "Ran a task", detail: detail || "done" };
    },
    short: () => "task",
  },
  recheckRedline: {
    running: (a) => `Re-checking the ${a.ruleId ?? ""} redline…`,
    done: (_, r) => ({ text: `Re-checked ${r.cite ?? "the redline"} against ${r.ruleId ?? "the playbook"}`, detail: r.meetsPlaybook ? "meets it" : "still deviates" }),
    short: (_, r) => `Re-checked ${r.cite ?? "the redline"}`,
  },
  setDeviationReason: {
    running: () => "Recording your reason…",
    done: (_, r) => ({ text: `Recorded the ${r.cite ?? ""} reason`, detail: r.readyToSend ? "ready to send" : undefined }),
    short: () => "Recorded the reason",
  },
  readCollection: {
    running: () => "Opening the collection…",
    done: (_, r) => ({ text: `Opened ${r.name ?? "the collection"}`, detail: Array.isArray(r.documents) ? `${r.documents.length} documents · ${(r.columns as unknown[]).length} questions` : undefined }),
    short: (_, r) => `Opened ${r.name ?? "the collection"}`,
  },
  fillCollectionCell: {
    running: (a) => `Reading ${COLLECTION_DOCS.find((d) => d.id === a.docId)?.vendor ?? "a document"} · ${COLUMNS.find((c) => c.key === a.column)?.label ?? "a cell"}…`,
    done: (_, r) => ({ text: `${r.vendor ?? "A document"} · ${r.column ?? "a cell"}`, detail: [r.answer, r.cite].filter(Boolean).join(" · ") }),
    short: () => "cell",
  },
  readDocument: {
    running: () => "Opening the document…",
    done: (_, r) => ({ text: `Opened ${r.document ?? "the document"}`, detail: Array.isArray(r.changes) ? `${(r.changes as unknown[]).length} tracked changes · ${(r.comments as unknown[]).length} comments` : undefined }),
    short: () => "Opened the document",
  },
  suggestEdit: {
    running: (a) => `Editing ${a.cite ?? "the document"}…`,
    done: (_, r) => (r.refused ? { text: "Left your text as it is", detail: "you wrote it" } : { text: `Suggested an edit in ${r.cite ?? "the document"}`, detail: "tracked" }),
    short: (_, r) => (r.refused ? "Kept your text" : `Edited ${r.cite ?? "a passage"}`),
  },
  insertClause: {
    running: (a) => `Adding ${a.caption ?? "a clause"}…`,
    done: (_, r) => ({ text: `Added ${r.cite ?? ""} ${r.caption ?? "a clause"}`.trim(), detail: "tracked insertion" }),
    short: (_, r) => `Added ${r.cite ?? "a clause"}`,
  },
  addComment: {
    running: (a) => `Commenting on ${a.cite ?? "a passage"}…`,
    done: (a, r) => ({ text: `Commented on ${r.cite ?? a.cite ?? "a passage"}`, detail: typeof a.text === "string" ? a.text : undefined }),
    short: () => "comment",
  },
  replyToComment: {
    running: (a) => `Replying to ${a.commentId ?? "a comment"}…`,
    done: (a) => ({ text: `Replied to ${a.commentId ?? "a comment"}` }),
    short: () => "Replied",
  },
  resolveComment: {
    running: (a) => `Resolving ${a.commentId ?? "a comment"}…`,
    done: (a, r) => (r.refused ? { text: `Left ${a.commentId ?? "your comment"} open`, detail: "you wrote it" } : { text: `Resolved ${a.commentId ?? "a comment"}` }),
    short: () => "Resolved a comment",
  },
  updateRedline: {
    running: (a) => `Updating the ${a.ruleId ?? ""} redline…`,
    done: (_, r) => (r.refused ? { text: "Left your redline as it is", detail: "you wrote it" } : { text: `Updated the ${r.ruleId ?? ""} redline` }),
    short: (_, r) => (r.refused ? "Kept your redline" : "Updated a redline"),
  },
};

function parseResult(result: unknown): Result {
  if (typeof result !== "string") return (result as Result) ?? {};
  try {
    const parsed = JSON.parse(result);
    return parsed && typeof parsed === "object" ? (parsed as Result) : {};
  } catch {
    return {};
  }
}

function ToolWork({ name, args, status, result }: { name: string; args?: Args; status: string; result?: unknown }) {
  const words = WORK[name];
  if (status !== "complete") return <WorkRow state="running" text={words ? words.running(args ?? {}) : "Working…"} />;
  const parsed = parseResult(result);
  if (parsed.error) return <WorkRow state="failed" text={words ? words.running(args ?? {}).replace(/…$/, "") : "A step"} detail={String(parsed.error)} />;
  const done = words ? words.done(args ?? {}, parsed) : { text: "Done" };
  return <WorkRow state="done" text={done.text} detail={done.detail} />;
}

export function useWorkRows() {
  useRenderTool(
    {
      name: "*",
      group: true, // join the "turn" display: rows while the agent works, folded once it replies
      render: ({ name, args, status, result }: { name: string; args?: Args; status: string; result?: unknown }) => (
        <ToolWork name={name} args={args} status={status} result={result} />
      ),
    },
    [],
  );
}

const parseArgs = (json: string): Args => {
  const parsed = parseResult(json);
  return parsed as Args;
};

/** The live line while a review runs: the step working now and where it is in the plan, from the store. */
function useLiveStep(calls: CopilotChatWorkSummaryProps["calls"], working: boolean): string | null {
  const state = useAppState();
  if (!working || !calls.some(({ toolCall }) => toolCall.function.name === "runPlanTask")) return null;
  const id = state.activeMatterId;
  if (!id || !state.matters[id]) return null;
  const view = matterView(state, id);
  const step = view.plan.find((t) => t.status === "working") ?? view.plan.find((t) => t.status === "queued");
  return step ? `${step.title} · ${step.number} of ${view.plan.length}` : null;
}

/** The folded line of a turn, naming its data steps ("Read Acme Cloud · Ran 16 tasks · 7 deviations"). Cards and gates are not steps. */
export function TurnSummary({ calls, ...props }: CopilotChatWorkSummaryProps) {
  const live = useLiveStep(calls, props.isWorking);
  // While the turn works, its rows stay folded: the rail's Plan is the checklist. Close them once, with
  // the slot's own toggle, so a click still opens them.
  const closed = useRef(false);
  const { isWorking, isOpen, onClick } = props;
  useEffect(() => {
    if (!isWorking || !isOpen || closed.current) return;
    closed.current = true;
    (onClick as unknown as (() => void) | undefined)?.();
  }, [isWorking, isOpen, onClick]);

  const steps: string[] = [];
  let tasks = 0;
  let deviations = 0;
  let cells = 0;
  let comments = 0;
  for (const { toolCall, toolMessage } of calls) {
    const result = parseResult(toolMessage?.content);
    const words = WORK[toolCall.function.name];
    if (!words) {
      const card = CARD_WORDS[toolCall.function.name];
      if (card && steps.length === 0 && tasks === 0) steps.push(card(result));
      continue;
    }
    if (toolCall.function.name === "fillCollectionCell") {
      cells += 1;
      continue;
    }
    if (toolCall.function.name === "addComment") {
      comments += 1;
      continue;
    }
    if (toolCall.function.name === "runPlanTask") {
      tasks += 1;
      if (result.result === "deviation") deviations += 1;
      continue;
    }
    steps.push(words.short(parseArgs(toolCall.function.arguments), result));
  }
  if (tasks) steps.push(`Ran ${tasks} ${tasks === 1 ? "task" : "tasks"}`);
  if (deviations) steps.push(`${deviations} ${deviations === 1 ? "deviation" : "deviations"}`);
  if (cells) steps.push(`Filled ${cells} ${cells === 1 ? "cell" : "cells"}`);
  if (comments) steps.push(`Left ${comments} ${comments === 1 ? "comment" : "comments"}`);
  return <WorkSummary {...props} steps={steps} live={live} />;
}
