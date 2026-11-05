// Concept: shared state, two writers.
//
// One small store holds what Maya and the copilot both work on: which matters are open, the plan she
// approved and how far it has run, the redlines (drafted by the copilot, editable by her), the reasons
// she gives for accepting a deviation, the approvals, and the playbook rules a person has published.
// The human writes from the panels; the agent writes through frontend tools (lib/agent-tools.ts).
// Findings, risk, the total contract value and the route are never stored. They are derived from the
// contract with the pure functions in lib/review.ts and lib/plan.ts, so they recompute on every
// change, whoever made it.
//
// Rules that must hold live here in code, not only in the prompt:
// - nothing in the plan runs before a person approves it (runTask refuses);
// - the agent never overwrites a redline Maya wrote, unless she asked (agentRedline refuses);
// - nothing is sent for approval while an accepted deviation has no reason (sendForApproval refuses);
// - nothing goes to the vendor before every approver has approved (task 17 stays held until then).
//
// Tool handlers read appStore.getState() when they run, so they always see the latest state. The
// store persists to localStorage so a reload keeps the demo; "Reset demo" clears it. A saved demo
// that does not match the current shape is discarded on load (validateSavedState).

import { useSyncExternalStore } from "react";
import { z } from "zod";
import { PERSON_IDS, STORY_DATE, storyNow } from "./company";
import { groupSendBacks, proposeRules, sendBacksFrom, type PastReview, type RuleProposal, type SendBack } from "./learning";
import { COLLECTION_ID, answerCell, cellKey, isCellKey, type Cell, type ColumnKey } from "./collection";
import { ACME_ID, MATTERS, getMatter, isMatterId, type MatterRecord } from "./matters";
import { buildPlan, heldLine, reviewState, taskOutcome, type PlanTask, type ReviewState, type TaskOutcome } from "./plan";
import { acceptedDeviations, deviations, recheckRedline, type Finding, type LearnedRule, type RouteStep } from "./review";

export type Writer = "human" | "agent";
export type TaskStatus = "queued" | "working" | "done";
export type DecisionKind = "approved" | "sent_back" | "rejected";
export type Decision = { approverId: string; decision: DecisionKind; comment: string; at: string };

export type Submission = {
  sentAt: string;
  via: "copilot" | "header";
  route: RouteStep[];
  redlineCount: number;
  /** The reasons Maya gave for the deviations she accepted, as sent. */
  reasons: Record<string, string>;
  decisions: Decision[];
  status: "pending" | "approved" | "sent_back" | "rejected";
};

export type MatterState = {
  openedAt: string;
  /** The learned rules the approved plan was built with, so the review reads the same later. */
  planRules: LearnedRule[];
  planApprovedAt: string | null;
  tasks: Record<string, TaskStatus>;
  redlines: Record<string, { text: string; by: Writer }>;
  reasons: Record<string, string>;
  submission: Submission | null;
};

/** A playbook rule a person published in Insights, and who published it. `version` goes up each time it is published again. */
export type PublishedRule = LearnedRule & { markdown: string; publishedAt: string; publishedBy: string };

export type AppState = {
  matters: Record<string, MatterState>;
  activeMatterId: string | null;
  publishedRules: PublishedRule[];
  dismissedRuleIds: string[];
  /** The collection whose thread is open (lib/collection.ts), when no matter is. */
  activeCollectionId: string | null;
  /** The collection review table's answered cells, "docId:column", in the order the agent filled them. */
  collectionCells: string[];
  /** The cell the agent is reading now, for its beat. */
  collectionWorking: string | null;
};

const STORAGE_KEY = "northstar-legal:v2";

export const initialAppState: AppState = { matters: {}, activeMatterId: null, publishedRules: [], dismissedRuleIds: [], activeCollectionId: null, collectionCells: [], collectionWorking: null };

let state: AppState = initialAppState;
const listeners = new Set<() => void>();

function setState(update: (current: AppState) => AppState) {
  state = update(state);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode, storage full, or a test: the demo still works, it just won't survive a reload.
  }
  listeners.forEach((listener) => listener());
}

function setMatter(id: string, update: (m: MatterState) => MatterState) {
  setState((s) => {
    const current = s.matters[id];
    return current ? { ...s, matters: { ...s.matters, [id]: update(current) } } : s;
  });
}

// ---------------------------------------------------------------------------------------------
// The saved demo, checked against the current data and shape before it is loaded

const personId = z.string().refine((id) => PERSON_IDS.includes(id), { message: "unknown person" });
const learnedRule = z.object({ id: z.string(), version: z.number().int().positive(), title: z.string() }).strict();
const decision = z.object({ approverId: personId, decision: z.enum(["approved", "sent_back", "rejected"]), comment: z.string(), at: z.string() }).strict();
const routeStep = z
  .object({ personId, name: z.string(), title: z.string(), ruleId: z.enum(["PB-APR-01", "PB-APR-02", "PB-APR-03"]), reason: z.string() })
  .strict();

const matterState = z
  .object({
    openedAt: z.string(),
    planRules: z.array(learnedRule),
    planApprovedAt: z.string().nullable(),
    tasks: z.record(z.string(), z.enum(["queued", "working", "done"])),
    redlines: z.record(z.string(), z.object({ text: z.string(), by: z.enum(["human", "agent"]) }).strict()),
    reasons: z.record(z.string(), z.string()),
    submission: z
      .object({
        sentAt: z.string(),
        via: z.enum(["copilot", "header"]),
        route: z.array(routeStep),
        redlineCount: z.number().int().nonnegative(),
        reasons: z.record(z.string(), z.string()),
        decisions: z.array(decision),
        status: z.enum(["pending", "approved", "sent_back", "rejected"]),
      })
      .strict()
      .nullable(),
  })
  .strict();

const savedStateSchema = z
  .object({
    matters: z.record(z.string().refine(isMatterId, { message: "unknown matter" }), matterState),
    activeMatterId: z.string().refine(isMatterId, { message: "unknown matter" }).nullable(),
    publishedRules: z.array(learnedRule.extend({ markdown: z.string(), publishedAt: z.string(), publishedBy: personId }).strict()),
    dismissedRuleIds: z.array(z.string()),
    activeCollectionId: z.literal(COLLECTION_ID).nullable().default(null),
    collectionCells: z.array(z.string().refine(isCellKey, { message: "unknown cell" })).default([]),
    collectionWorking: z.string().nullable().default(null),
  })
  .strict();

/** The saved demo if it matches the current ids and shape; otherwise why not. */
export function validateSavedState(json: string): { ok: true; state: AppState } | { ok: false; reason: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, reason: "it is not valid JSON" };
  }
  const result = savedStateSchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    return { ok: false, reason: `${issue.path.join(".") || "(root)"}: ${issue.message}` };
  }
  // A reload mid-run leaves a task "working" that nothing will finish: put it back in the queue.
  const matters = Object.fromEntries(
    Object.entries(result.data.matters).map(([id, m]) => [id, { ...m, tasks: Object.fromEntries(Object.entries(m.tasks).map(([t, s]) => [t, s === "working" ? "queued" : s])) }]),
  ) as AppState["matters"];
  return { ok: true, state: { ...result.data, matters, collectionWorking: null } };
}

export const appStore = {
  getState: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Load the saved demo. Called once after the first render, so server and client HTML match. */
  hydrate() {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      return; // No storage: start fresh.
    }
    if (!saved) return;
    const result = validateSavedState(saved);
    if (result.ok) {
      setState(() => result.state);
      return;
    }
    console.warn(`[legal] Discarded the saved demo, which does not match the current data (${result.reason}). Starting clean.`);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to remove.
    }
  },
};

/** For tests: back to a clean demo, without touching the page. */
export function resetStoreForTests() {
  state = initialAppState;
}

export function useAppState(): AppState {
  return useSyncExternalStore(appStore.subscribe, appStore.getState, () => initialAppState);
}

export function resetDemo() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing saved.
  }
  window.location.reload();
}

// ---------------------------------------------------------------------------------------------
// Reading a matter: everything a panel, a card or a tool needs, derived from the store

export const learnedRules = (s: AppState): LearnedRule[] => s.publishedRules.map(({ id, version, title }) => ({ id, version, title }));

/** "Now" for a matter: 10:00 on the story day, or when it arrived if that is later (Brightwater, at 4:40 pm). */
export const matterNow = (matter: MatterRecord) => (matter.receivedAt > storyNow() ? matter.receivedAt : storyNow());

export type MatterStatus = "new" | "in_review" | "needs_reason" | "ready" | "pending" | "approved" | "sent_back" | "rejected";

/** A task as the screens show it. "held" is task 17 once the review is done: it waits for every approver. */
export type TaskView = PlanTask & { status: TaskStatus | "proposed" | "held"; outcome: TaskOutcome | null; number: number };

export type MatterView = {
  matter: MatterRecord;
  state: MatterState | null;
  /** The approved plan, or the plan the copilot would propose now. */
  plan: TaskView[];
  planApproved: boolean;
  review: ReviewState;
  /** What the finished tasks found, in plan order: the review table's rows. */
  found: Finding[];
  doneCount: number;
  /** The review has run: every task is done except task 17, which waits for the approvers. */
  complete: boolean;
  /** The current redline text for each rule, once drafted. */
  redlines: Record<string, string>;
  redlinesBy: Record<string, Writer>;
  /** Deviations whose redline no longer restores the playbook position: each needs a reason (PB-APR-01). */
  accepted: Finding[];
  missingReasons: Finding[];
  status: MatterStatus;
};

export function matterView(s: AppState, id: string): MatterView {
  const matter = getMatter(id);
  const ms = s.matters[id] ?? null;
  const planApproved = Boolean(ms?.planApprovedAt);
  const rules = planApproved && ms ? ms.planRules : learnedRules(s);
  const review = reviewState(matter, rules);
  const tasks = buildPlan(matter, rules);
  const reviewDone = planApproved && tasks.every((t) => t.kind === "packet" || ms?.tasks[t.id] === "done");
  const plan: TaskView[] = tasks.map((task, i) => {
    let status: TaskView["status"] = planApproved ? (ms?.tasks[task.id] ?? "queued") : "proposed";
    // Task 17 is done only when every approver has approved; until then, once the review has run, it is held.
    if (task.kind === "packet" && planApproved) status = ms?.submission?.status === "approved" ? "done" : reviewDone && status !== "working" ? "held" : status === "done" ? "queued" : status;
    const outcome = status === "done" ? taskOutcome(task, matter, review) : status === "held" ? { status: "done" as const, line: heldLine(matter, review), cite: null, reads: [], finding: null } : null;
    return { ...task, number: i + 1, status, outcome };
  });
  const found = plan.flatMap((t) => (t.outcome?.finding ? [t.outcome.finding] : []));
  const redlines = Object.fromEntries(Object.entries(ms?.redlines ?? {}).map(([rule, r]) => [rule, r.text]));
  const redlinesBy = Object.fromEntries(Object.entries(ms?.redlines ?? {}).map(([rule, r]) => [rule, r.by]));
  const drafted = Object.keys(redlines).length > 0;
  const accepted = drafted ? acceptedDeviations(review.findings, redlines) : [];
  const missingReasons = accepted.filter((f) => !(ms?.reasons[f.ruleId!] ?? "").trim());
  const doneCount = plan.filter((t) => t.status === "done").length;
  const complete = reviewDone;
  const status: MatterStatus = ms?.submission
    ? ms.submission.status
    : !planApproved
      ? "new"
      : !complete
        ? "in_review"
        : missingReasons.length
          ? "needs_reason"
          : "ready";
  return { matter, state: ms, plan, planApproved, review, found, doneCount, complete, redlines, redlinesBy, accepted, missingReasons, status };
}

/**
 * The counts every screen shows, from one function: the tab badge, the review table's groups, the
 * seal key, the plan subtitle and the chat cards all read these, so they can never disagree.
 * - checks: the playbook rules this matter is checked against (plus learned ones), run or not;
 * - pass, deviations, high: of the checks that have run;
 * - learned: rows added by a published rule (requests that go out with the redlines);
 * - toVendor: what goes to the vendor, deviations plus learned requests (the Review table badge);
 * - context: rows with no playbook rule (who and what, security standards), shown apart.
 */
export type MatterCounts = { checks: number; checked: number; pass: number; deviations: number; high: number; learned: number; toVendor: number; context: number };

export function matterCounts(view: Pick<MatterView, "review" | "found">): MatterCounts {
  const run = view.found.filter((f) => f.ruleId);
  const deviations = run.filter((f) => f.status === "deviation");
  const learned = run.filter((f) => f.learned).length;
  return {
    checks: view.review.findings.filter((f) => f.ruleId).length,
    checked: run.length,
    pass: run.filter((f) => f.status === "pass").length,
    deviations: deviations.length,
    high: deviations.filter((f) => f.risk === "high").length,
    learned,
    toVendor: deviations.length + run.filter((f) => f.status === "request").length,
    context: view.found.filter((f) => !f.ruleId).length,
  };
}

/** Matters shown in the queue: Acme Cloud from the start, and any other the copilot has opened. */
export const queueMatterIds = (s: AppState) => MATTERS.map((m) => m.id).filter((id) => id === ACME_ID || s.matters[id]);

// ---------------------------------------------------------------------------------------------
// Opening and the plan

export function openMatter(id: string): MatterState {
  if (!isMatterId(id)) throw new Error(`Unknown matter: ${id}`);
  const existing = state.matters[id];
  const ms: MatterState = existing ?? { openedAt: matterNow(getMatter(id)), planRules: [], planApprovedAt: null, tasks: {}, redlines: {}, reasons: {}, submission: null };
  setState((s) => ({ ...s, activeMatterId: id, activeCollectionId: null, matters: { ...s.matters, [id]: ms } }));
  return ms;
}

/** Back to the matter queue, or a new thread: no matter and no collection open. */
export function closeMatter() {
  setState((s) => ({ ...s, activeMatterId: null, activeCollectionId: null }));
}

// ---------------------------------------------------------------------------------------------
// The collection review table (lib/collection.ts): its thread, and the cells the agent has answered

/** Open the collection's thread. No matter is open while it is. */
export function openCollection(id: string = COLLECTION_ID) {
  if (id !== COLLECTION_ID) throw new Error(`Unknown collection: ${id}`);
  setState((s) => ({ ...s, activeMatterId: null, activeCollectionId: id }));
}

/** The agent starts reading a cell: it shows as working until fillCell. false when it is already answered. */
export function startCell(docId: string, column: ColumnKey): boolean {
  const key = cellKey(docId, column);
  if (state.collectionCells.includes(key)) return false;
  setState((s) => ({ ...s, collectionWorking: key }));
  return true;
}

/** Answer a cell: the answer itself is worked out from the document (answerCell), so only which cells are filled is kept. */
export function fillCell(docId: string, column: ColumnKey): Cell {
  const key = cellKey(docId, column);
  const cell = answerCell(docId, column);
  setState((s) => ({ ...s, collectionWorking: s.collectionWorking === key ? null : s.collectionWorking, collectionCells: s.collectionCells.includes(key) ? s.collectionCells : [...s.collectionCells, key] }));
  return cell;
}

export const isCellFilled = (s: AppState, docId: string, column: ColumnKey) => s.collectionCells.includes(cellKey(docId, column));

/** Only a person's click calls this: Approve plan on the copilot's plan card. */
export function approvePlan(id: string): PlanTask[] {
  const ms = state.matters[id] ?? openMatter(id);
  if (ms.planApprovedAt) return buildPlan(getMatter(id), ms.planRules);
  const rules = learnedRules(state);
  const plan = buildPlan(getMatter(id), rules);
  setMatter(id, (m) => ({ ...m, planRules: rules, planApprovedAt: matterNow(getMatter(id)), tasks: Object.fromEntries(plan.map((t) => [t.id, "queued"])) }));
  return plan;
}

export type RunResult = { ok: true; taskId: string; number: number; of: number; title: string; outcome: TaskOutcome; held?: boolean; next: string | null } | { ok: false; error: string };

/** Whether a task may run now: the plan is approved, and every task before it is done. */
function checkRunnable(id: string, taskId: string): { ok: true; view: MatterView; index: number } | { ok: false; error: string } {
  if (!state.matters[id]) return { ok: false, error: `${id} is not open. Call readMatter first.` };
  const view = matterView(state, id);
  if (!view.planApproved) return { ok: false, error: "The plan is not approved yet. Call proposePlan and wait for the user's click; nothing runs before it." };
  const index = view.plan.findIndex((t) => t.id === taskId);
  if (index === -1) return { ok: false, error: `${taskId} is not in the approved plan. Task ids: ${view.plan.map((t) => t.id).join(", ")}.` };
  const pending = view.plan.slice(0, index).find((t) => t.status !== "done" && t.status !== "held");
  if (pending) return { ok: false, error: `Run the tasks in order: ${pending.id} ("${pending.title}") is not done yet.` };
  return { ok: true, view, index };
}

/** Mark a task as working (the checklist row starts to move). The tool's handler calls this first. */
export function startTask(id: string, taskId: string): boolean {
  const check = checkRunnable(id, taskId);
  if (!check.ok || check.view.plan[check.index].status === "done" || check.view.plan[check.index].status === "held") return false;
  setMatter(id, (m) => ({ ...m, tasks: { ...m.tasks, [taskId]: "working" } }));
  return true;
}

/**
 * Run one task of the approved plan and tick it. The work itself is a pure function (plan.ts
 * taskOutcome); running "redlines" also writes the drafted redlines into the store, leaving any
 * redline the user wrote as it is.
 */
export function runTask(id: string, taskId: string): RunResult {
  const check = checkRunnable(id, taskId);
  if (!check.ok) return check;
  const { view, index } = check;
  const task = view.plan[index];
  if (task.kind === "redlines") {
    const drafts = [...deviations(view.review.findings), ...view.review.findings.filter((f) => f.status === "request")];
    setMatter(id, (m) => {
      const redlines = { ...m.redlines };
      for (const f of drafts) if (f.ruleId && f.redline && redlines[f.ruleId]?.by !== "human") redlines[f.ruleId] = { text: f.redline, by: "agent" };
      return { ...m, redlines };
    });
  }
  if (task.kind === "packet") {
    // Nothing goes to the vendor before every approver has approved: the task stays held, and the run ends here.
    setMatter(id, (m) => ({ ...m, tasks: { ...m.tasks, [taskId]: "queued" } }));
    const held = matterView(state, id).plan[index];
    return { ok: true, taskId, number: held.number, of: view.plan.length, title: held.title, outcome: held.outcome!, held: held.status !== "done", next: null };
  }
  setMatter(id, (m) => ({ ...m, tasks: { ...m.tasks, [taskId]: "done" } }));
  const after = matterView(state, id);
  const done = after.plan[index];
  const next = after.plan.find((t) => t.status !== "done" && t.status !== "held");
  return { ok: true, taskId, number: done.number, of: after.plan.length, title: done.title, outcome: done.outcome!, next: next?.id ?? null };
}

// ---------------------------------------------------------------------------------------------
// Redlines and reasons

export type RedlineEdit = { matterId: string; ruleId: string; cite: string; before: string; after: string };

/** A person's edit in the review table. Returns the edit (for the copilot to hear), or null if nothing changed. */
export function humanRedline(id: string, ruleId: string, text: string): RedlineEdit | null {
  const view = matterView(state, id);
  const before = view.redlines[ruleId];
  const finding = view.review.findings.find((f) => f.ruleId === ruleId);
  const after = text.trim();
  if (before === undefined || !finding || after === before || !after) return null;
  setMatter(id, (m) => ({ ...m, redlines: { ...m.redlines, [ruleId]: { text: after, by: "human" } } }));
  return { matterId: id, ruleId, cite: finding.cite, before, after };
}

export type AgentRedlineResult = { ok: true; ruleId: string; changed: boolean } | { ok: false; refused: true; ruleId: string; userValue: string; note: string } | { ok: false; error: string };

/** The agent's updateRedline tool. Never writes a redline the user wrote, unless `userAsked`. */
export function agentRedline(id: string, ruleId: string, text: string, userAsked = false): AgentRedlineResult {
  const view = state.matters[id] ? matterView(state, id) : null;
  if (!view) return { ok: false, error: `${id} is not open.` };
  if (view.redlines[ruleId] === undefined) return { ok: false, error: `There is no redline for ${ruleId} yet. Redlines are drafted by the plan's "Draft a redline for every deviation" task.` };
  if (view.redlinesBy[ruleId] === "human" && !userAsked) {
    return {
      ok: false,
      refused: true,
      ruleId,
      userValue: view.redlines[ruleId],
      note: "The user wrote this redline, so it was not changed. Ask before changing it; call again with userAsked: true only if they say yes.",
    };
  }
  const changed = view.redlines[ruleId] !== text.trim();
  setMatter(id, (m) => ({ ...m, redlines: { ...m.redlines, [ruleId]: { text: text.trim(), by: userAsked ? "human" : "agent" } } }));
  return { ok: true, ruleId, changed };
}

/** The reason Northstar accepts a deviation, for the General Counsel (PB-APR-01). */
export function setReason(id: string, ruleId: string, reason: string) {
  setMatter(id, (m) => ({ ...m, reasons: { ...m.reasons, [ruleId]: reason.trim() } }));
}

/** The re-check after an edit: does the redline still deviate, and who needs a reason? */
export function recheck(id: string, ruleId: string) {
  const view = matterView(state, id);
  const finding = view.review.findings.find((f) => f.ruleId === ruleId);
  const text = view.redlines[ruleId];
  if (!finding || text === undefined) return { error: `There is no redline for ${ruleId}.` };
  const result = recheckRedline(ruleId, text);
  const gc = view.review.route.find((s) => s.ruleId === "PB-APR-01");
  return {
    ruleId,
    cite: finding.cite,
    topic: finding.topic,
    redline: text,
    editedByUser: view.redlinesBy[ruleId] === "human",
    meetsPlaybook: result.meets,
    detail: result.detail,
    needsReason: !result.meets,
    reasonFrom: !result.meets && gc ? `${gc.name} (${gc.title})` : null,
    reason: view.state?.reasons[ruleId] || null,
    route: view.review.route.map((s) => s.name),
    stillToExplain: view.missingReasons.map((f) => f.ruleId),
  };
}

// ---------------------------------------------------------------------------------------------
// Sending for approval, and the approvers' decisions

export type SendResult = { sent: true; matterId: string; to: string[]; redlines: number } | { sent: false; reason: string };

/** Only a person's click calls this: Send for approval on the copilot's card, or in the matter header. */
export function sendForApproval(id: string, via: Submission["via"]): SendResult {
  const view = matterView(state, id);
  if (!view.complete) return { sent: false, reason: "The review plan has not finished running." };
  if (view.state?.submission?.status === "pending") return { sent: false, reason: "It is already with the approvers." };
  if (view.missingReasons.length) return { sent: false, reason: `A reason is needed for ${view.missingReasons.map((f) => `${f.cite} (${f.ruleId})`).join(", ")} before it goes to the General Counsel (PB-APR-01).` };
  const redlineCount = Object.keys(view.redlines).filter((rule) => view.review.findings.some((f) => f.ruleId === rule && f.status === "deviation")).length;
  const reasons = Object.fromEntries(view.accepted.map((f) => [f.ruleId!, view.state?.reasons[f.ruleId!] ?? ""]));
  const submission: Submission = { sentAt: matterNow(view.matter), via, route: view.review.route, redlineCount, reasons, decisions: [], status: "pending" };
  setMatter(id, (m) => ({ ...m, submission }));
  return { sent: true, matterId: id, to: view.review.route.map((s) => `${s.name} (${s.title})`), redlines: redlineCount };
}

/** The approver whose turn it is, or null when the review is no longer pending. */
export function currentApprover(submission: Submission): RouteStep | null {
  if (submission.status !== "pending") return null;
  return submission.route[submission.decisions.length] ?? null;
}

export function recordDecision(id: string, kind: DecisionKind, comment: string) {
  setMatter(id, (m) => {
    const sub = m.submission;
    const step = sub && currentApprover(sub);
    if (!sub || !step) return m;
    const decisions = [...sub.decisions, { approverId: step.personId, decision: kind, comment: comment.trim(), at: sub.sentAt }];
    const status: Submission["status"] = kind === "approved" ? (decisions.length === sub.route.length ? "approved" : "pending") : kind;
    return { ...m, submission: { ...sub, decisions, status } };
  });
}

/** This session's send-backs, in the same shape as the history, for Insights. */
export function sessionSendBacks(s: AppState): SendBack[] {
  return Object.entries(s.matters).flatMap(([id, m]) => {
    const matter = getMatter(id);
    return (m.submission?.decisions ?? [])
      .filter((d) => d.decision === "sent_back")
      .map((d) => ({ matterId: matter.matterNumber, vendor: matter.vendorShort, agreement: matter.kind, approver: d.approverId, at: d.at, comment: d.comment, resubmitted: null, daysLost: null, source: "session" as const }));
  });
}

/** The rules Insights proposes now: from the history plus this session's send-backs. */
export const proposalsFor = (s: AppState, history: readonly PastReview[]): RuleProposal[] => proposeRules(groupSendBacks([...sendBacksFrom(history), ...sessionSendBacks(s)]));

export type ProposalReview = "proposed" | "published" | "dismissed";
export const reviewOf = (s: AppState, proposal: RuleProposal): ProposalReview =>
  s.publishedRules.some((r) => r.id === proposal.id) ? "published" : s.dismissedRuleIds.includes(proposal.id) ? "dismissed" : "proposed";

/**
 * The Insights tab's badge: proposals waiting for a person to publish or dismiss them. One lights the
 * badge only once it includes a send-back from this session, so the tab does not give the lesson away
 * before the approvers have acted (step 5).
 */
export const pendingProposals = (s: AppState, history: readonly PastReview[]): number =>
  proposalsFor(s, history).filter((p) => reviewOf(s, p) === "proposed" && p.evidence.some((e) => e.source === "session")).length;

// ---------------------------------------------------------------------------------------------
// Playbook rules (published by a person in Insights, then part of every new plan)

/** Playbook changes belong to the General Counsel: in the demo, the presenter publishes acting as Rachel Adler. */
export const PLAYBOOK_OWNER = "rachel";

export function publishRule(proposal: { id: string; title: string; markdown: string }, by: string = PLAYBOOK_OWNER) {
  const version = (state.publishedRules.find((r) => r.id === proposal.id)?.version ?? 0) + 1;
  const rule: PublishedRule = { id: proposal.id, version, title: proposal.title, markdown: proposal.markdown, publishedAt: storyNow(), publishedBy: by };
  setState((s) => ({ ...s, publishedRules: [...s.publishedRules.filter((r) => r.id !== rule.id), rule], dismissedRuleIds: s.dismissedRuleIds.filter((d) => d !== rule.id) }));
}

export function dismissRule(id: string) {
  setState((s) => ({ ...s, dismissedRuleIds: [...new Set([...s.dismissedRuleIds, id])] }));
}
