// Concept: governance you can read. How reviews are going, and who decided what, worked out from the
// same data as everything else: the reviews imported when Open Harvey went live (review-history.jsonl)
// and this session's store, which the demo moves. Nothing here is estimated, benchmarked or invented.
// Every figure is a pure function of that data, tested in analytics.test.ts; the Analytics page and
// the copilot's app context both read it.

import { getPerson } from "./company";
import { GO_LIVE, classifyComment, groupSendBacks, REASONS, sendBacksFrom, type PastReview, type ReasonKey } from "./learning";
import { getMatter, matterTitle } from "./matters";
import { matterView, sessionSendBacks, type AppState } from "./store";

const DAY_MS = 24 * 60 * 60 * 1000;
const days = (from: string, to: string) => Math.round((Date.parse(to.slice(0, 10)) - Date.parse(from.slice(0, 10))) / DAY_MS);

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Before go-live: the imported reviews, from first submission to signature. */
export type BeforeGoLive = {
  reviews: number;
  /** Approved by every approver in the first round, with no send-back. */
  firstPass: number;
  sentBack: number;
  medianCycleDays: number | null;
  daysLost: number;
};

export function beforeGoLive(history: readonly PastReview[]): BeforeGoLive {
  const backs = sendBacksFrom(history);
  const firstPass = history.filter((r) => r.rounds[0]?.decisions.every((d) => d.decision === "approved")).length;
  const cycles = history.filter((r) => r.signed && r.rounds[0]).map((r) => days(r.rounds[0].submitted, r.signed!));
  return {
    reviews: history.length,
    firstPass,
    sentBack: history.length - firstPass,
    medianCycleDays: median(cycles),
    daysLost: backs.reduce((sum, s) => sum + (s.daysLost ?? 0), 0),
  };
}

/** Since go-live: what this session did, counted from the store. */
export type SinceGoLive = {
  reviews: number;
  tasksRun: number;
  redlinesDrafted: number;
  humanEdits: number;
  approvalsRequested: number;
  decisions: number;
  firstPass: number;
  sentBack: number;
  rulesPublished: number;
};

export function sinceGoLive(state: AppState): SinceGoLive {
  const matters = Object.values(state.matters);
  const subs = matters.flatMap((m) => (m.submission ? [m.submission] : []));
  return {
    reviews: matters.filter((m) => m.planApprovedAt).length,
    tasksRun: matters.reduce((n, m) => n + Object.values(m.tasks).filter((t) => t === "done").length, 0),
    redlinesDrafted: matters.reduce((n, m) => n + Object.keys(m.redlines).length, 0),
    humanEdits: matters.reduce((n, m) => n + Object.values(m.redlines).filter((r) => r.by === "human").length, 0),
    approvalsRequested: subs.length,
    decisions: subs.reduce((n, s) => n + s.decisions.length, 0),
    firstPass: subs.filter((s) => s.status === "approved" && s.decisions.every((d) => d.decision === "approved")).length,
    sentBack: subs.filter((s) => s.decisions.some((d) => d.decision === "sent_back")).length,
    rulesPublished: state.publishedRules.length,
  };
}

/** Send-back reasons, before go-live and since: the learning signal. */
export type ReasonRow = { key: ReasonKey; label: string; before: number; since: number };

export function sendBackReasons(history: readonly PastReview[], state: AppState): ReasonRow[] {
  const groups = groupSendBacks([...sendBacksFrom(history), ...sessionSendBacks(state)]);
  return groups.map((g) => ({
    key: g.key,
    label: REASONS[g.key].label,
    before: g.sendBacks.filter((s) => s.source === "history").length,
    since: g.sendBacks.filter((s) => s.source === "session").length,
  }));
}

/** What kind of gated action an entry records. Trajectory events are named after it (lib/trajectory-events.ts). */
export type DecisionKind = "plan_approved" | "sent_for_approval" | "approved" | "sent_back" | "rejected" | "rule_published";

/** One gated action: who did it, what, on which matter, when; `key` names it once, `comment` is the approver's words. */
export type LogEntry = { key: string; kind: DecisionKind; at: string; who: string; role: string; action: string; matter: string | null; matterId: string | null; comment?: string; to?: string[]; ruleId?: string; version?: number };

/**
 * The decision log: every action that waited for a person, in order. A plan approved, a review sent
 * for approval, each approver's decision, a rule published. The copilot appears in none of them: it
 * proposes, people decide.
 */
export function decisionLog(state: AppState): LogEntry[] {
  const person = (id: string) => getPerson(id);
  const entries: (LogEntry & { order: number })[] = [];
  let order = 0;
  const push = (e: LogEntry) => entries.push({ ...e, order: order++ });
  const maya = person("maya");
  const byOpened = Object.entries(state.matters).sort(([, a], [, b]) => (a.openedAt < b.openedAt ? -1 : 1));
  for (const [id, m] of byOpened) {
    const title = matterTitle(getMatter(id));
    if (m.planApprovedAt) push({ key: `${id}:plan`, kind: "plan_approved", at: m.planApprovedAt, who: maya.name, role: maya.title, action: "approved the review plan", matter: title, matterId: id });
    const sub = m.submission;
    if (!sub) continue;
    const to = sub.route.map((s) => s.name);
    push({ key: `${id}:sent:${sub.sentAt}`, kind: "sent_for_approval", at: sub.sentAt, who: maya.name, role: maya.title, action: `sent it for approval to ${to.join(", ")}`, matter: title, matterId: id, to });
    sub.decisions.forEach((d, i) => {
      const p = person(d.approverId);
      push({
        key: `${id}:sent:${sub.sentAt}:decision:${i}`,
        kind: d.decision,
        at: d.at,
        who: p.name,
        role: p.title,
        action: d.decision === "approved" ? "approved" : d.decision === "sent_back" ? "sent it back" : "rejected it",
        matter: title,
        matterId: id,
        comment: d.comment,
      });
    });
  }
  for (const r of state.publishedRules) {
    const p = person(r.publishedBy);
    push({ key: `rule:${r.id}:v${r.version}`, kind: "rule_published", at: r.publishedAt, who: p.name, role: p.title, action: `published ${r.id} v${r.version}, "${r.title}"`, matter: null, matterId: null, ruleId: r.id, version: r.version });
  }
  return entries.sort((a, b) => (a.at === b.at ? a.order - b.order : a.at < b.at ? -1 : 1)).map(({ order: _order, ...e }) => e);
}

/** What to do next, worked out from where each matter stands and what the playbook has learned. */
export function nextSteps(state: AppState, history: readonly PastReview[]): string[] {
  const steps: string[] = [];
  const learned = state.publishedRules.map((r) => r.id);
  for (const id of Object.keys(state.matters)) {
    const view = matterView(state, id);
    const vendor = view.matter.vendorShort;
    const sub = view.state?.submission;
    if (sub?.status === "sent_back") {
      const by = sub.decisions.at(-1)!;
      const security = classifyComment(by.comment) === "security_evidence";
      steps.push(
        security && learned.includes("PB-SEC-01")
          ? `Resubmit ${vendor} to ${getPerson(by.approverId).name} with the SOC 2 Type II report and pen-test summary request (PB-SEC-01).`
          : `Resubmit ${vendor} to ${getPerson(by.approverId).name} with what they asked for.`,
      );
    } else if (sub?.status === "pending") {
      const next = sub.route[sub.decisions.length];
      if (next) steps.push(`${vendor} waits on ${next.name}.`);
    } else if (view.status === "ready") steps.push(`Send ${vendor} for approval (${view.review.route.map((s) => s.name).join(", ")}).`);
    else if (view.status === "needs_reason") steps.push(`Give the reason for ${view.missingReasons.map((f) => f.cite).join(", ")} on ${vendor}.`);
  }
  const proposals = sendBackReasons(history, state).filter((r) => r.key === "security_evidence" && r.since > 0);
  if (proposals.length && !learned.includes("PB-SEC-01")) steps.push("Rachel Adler to review the proposed PB-SEC-01 in Playbooks.");
  if (Object.keys(state.matters).length === 0) steps.push("Review Acme Cloud: its pricing holds until Nov 13.");
  return steps;
}

/** Below this many decisions a percentage says more than the data does: show the count instead. */
export const SMALL_COUNT = 5;

/** A rate as the page shows it: "33%" of six, but "0 of 1" of one; "—" of none. */
export function rateFigure(n: number, of: number): string {
  if (of === 0) return "—";
  return of < SMALL_COUNT ? `${n} of ${of}` : `${Math.round((n / of) * 100)}%`;
}

/** The whole page, in one call, for the Analytics view and the copilot's context. */
export function analytics(state: AppState, history: readonly PastReview[]) {
  return {
    goLive: GO_LIVE,
    before: beforeGoLive(history),
    since: sinceGoLive(state),
    reasons: sendBackReasons(history, state),
    log: decisionLog(state),
    next: nextSteps(state, history),
  };
}

export type Analytics = ReturnType<typeof analytics>;
