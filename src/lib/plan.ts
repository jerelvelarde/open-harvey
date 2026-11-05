// Concept: the plan the copilot proposes, built in code.
//
// A contract review is the same 17 tasks every time, in this order: who and what, one task per
// playbook topic, then redlines, routing, and sending the redline package to the vendor, which waits
// for every approval. buildPlan returns them, with the rule each task checks and the passages it
// reads. A rule a person published in Insights adds its own task (lib/learning.ts), so the next plan
// includes it without anyone asking. Task titles are the topics in lib/playbook.ts TOPICS, the one
// name each clause has on every screen.
//
// taskOutcome is what a finished task found, in one line, worked out from the same pure functions
// as the review table (lib/review.ts). The copilot ticks tasks through the runPlanTask tool; the
// words and numbers come from here. Tested in plan.test.ts.

import type { PassageId } from "./contract";
import type { DealTerms, MatterRecord } from "./matters";
import { TOPICS } from "./playbook";
import {
  NOTES,
  LEARNED_CHECKS,
  deviations,
  reviewContract,
  routeApprovals,
  totalContractValue,
  type Finding,
  type LearnedRule,
  type RouteStep,
} from "./review";

export type TaskKind = "identify" | "check" | "note" | "learned" | "redlines" | "route" | "packet";

export type PlanTask = {
  id: string;
  title: string;
  kind: TaskKind;
  /** The playbook rules the task checks (shown as its rule id). */
  ruleIds: string[];
  /** The terms it reads; their passages are "what it read". */
  terms: (keyof DealTerms)[];
  /** For a task added by a published rule: which rule and version. */
  learned?: LearnedRule;
};

const BASE_PLAN: PlanTask[] = [
  { id: "parties", kind: "identify", title: TOPICS.parties, ruleIds: [], terms: ["parties", "orderOfPrecedence", "productScope"] },
  { id: "renewal", kind: "check", title: TOPICS["PB-REN-01"], ruleIds: ["PB-REN-01"], terms: ["initialTermMonths", "renewalTermMonths"] },
  { id: "fees", kind: "check", title: TOPICS["PB-PAY-01"], ruleIds: ["PB-PAY-01"], terms: ["annualFee", "paymentDays", "priceIncreasePct"] },
  { id: "liability", kind: "check", title: TOPICS["PB-LIAB-01"], ruleIds: ["PB-LIAB-01"], terms: ["liabilityCapMonths"] },
  { id: "indemnities", kind: "check", title: TOPICS["PB-IND-01"], ruleIds: ["PB-IND-01"], terms: ["ipIndemnity"] },
  { id: "data-protection", kind: "check", title: TOPICS["PB-DATA-01"], ruleIds: ["PB-DATA-01"], terms: ["processesCustomerPersonalData", "dataProcessingAddendum"] },
  { id: "incident-notice", kind: "check", title: TOPICS["PB-DATA-02"], ruleIds: ["PB-DATA-02"], terms: ["breachNoticeHours"] },
  { id: "security", kind: "note", title: TOPICS.security, ruleIds: [], terms: ["securityProgram"] },
  { id: "usage-data", kind: "check", title: TOPICS["PB-IP-01"], ruleIds: ["PB-IP-01"], terms: ["usageData"] },
  { id: "confidentiality", kind: "check", title: TOPICS["PB-CONF-01"], ruleIds: ["PB-CONF-01"], terms: ["confidentialityYearsAfter"] },
  { id: "termination", kind: "check", title: TOPICS["PB-TERM-01"], ruleIds: ["PB-TERM-01"], terms: ["terminationForConvenienceDays"] },
  { id: "assignment", kind: "check", title: TOPICS["PB-ASSIGN-01"], ruleIds: ["PB-ASSIGN-01"], terms: ["assignment"] },
  { id: "insurance", kind: "check", title: TOPICS["PB-INS-01"], ruleIds: ["PB-INS-01"], terms: ["insurance"] },
  { id: "governing-law", kind: "check", title: TOPICS["PB-LAW-01"], ruleIds: ["PB-LAW-01"], terms: ["governingLaw"] },
  { id: "redlines", kind: "redlines", title: "Draft a redline for every deviation", ruleIds: [], terms: [] },
  { id: "route", kind: "route", title: "Route for approval", ruleIds: ["PB-APR-01", "PB-APR-02", "PB-APR-03"], terms: [] },
  // Waits for every approval: runTask leaves it held until the last approver approves (lib/store.ts).
  { id: "packet", kind: "packet", title: "Send the redline package to Acme (only after every approval)", ruleIds: [], terms: [] },
];

/** The task a published rule adds, and where: right after the task it extends. */
const LEARNED_TASKS: Record<string, { title: string; after: string; terms: (keyof DealTerms)[] }> = {
  "PB-SEC-01": { title: TOPICS["PB-SEC-01"], after: "security", terms: ["securityProgram"] },
};

export const learnedTaskId = (ruleId: string) => `learned-${ruleId}`;

/** The plan for one contract: 17 tasks, plus one for each published rule that applies to it. */
/** Task 17 names the vendor the package goes to. */
const packetTitle = (matter: { vendorTerm?: string }) => `Send the redline package to ${matter.vendorTerm ?? "the vendor"} (only after every approval)`;

export function buildPlan(matter: { terms: DealTerms; vendorTerm?: string }, learned: readonly LearnedRule[] = []): PlanTask[] {
  const plan = BASE_PLAN.map((t) => (t.kind === "packet" ? { ...t, title: packetTitle(matter) } : t));
  for (const rule of learned) {
    const spec = LEARNED_TASKS[rule.id];
    const applies = LEARNED_CHECKS[rule.id]?.(matter.terms, rule);
    if (!spec || !applies) continue;
    const at = plan.findIndex((t) => t.id === spec.after) + 1;
    plan.splice(at, 0, { id: learnedTaskId(rule.id), kind: "learned", title: spec.title, ruleIds: [rule.id], terms: spec.terms, learned: rule });
  }
  return plan;
}

export const isTaskId = (plan: readonly PlanTask[], id: string) => plan.some((t) => t.id === id);

/** "(PB-SEC-01 v1, learned)": the label a learned task carries in the plan. */
export const learnedLabel = (rule: LearnedRule) => `(${rule.id} v${rule.version}, learned)`;

// ---------------------------------------------------------------------------------------------
// What a task found

/** Everything the outcomes need, worked out once from the matter, the published rules and the redlines. */
export type ReviewState = {
  findings: Finding[];
  totalValue: number;
  route: RouteStep[];
};

export function reviewState(matter: MatterRecord, learned: readonly LearnedRule[]): ReviewState {
  const findings = reviewContract(matter, learned);
  const totalValue = totalContractValue(matter.terms);
  return { findings, totalValue, route: routeApprovals(findings, totalValue) };
}

export type TaskOutcome = {
  /** attention: the task found a deviation a person must decide on. */
  status: "done" | "attention";
  /** One line, for the plan row and the work row. */
  line: string;
  /** The passage to open from the plan row's cite chip, if any. */
  cite: PassageId | null;
  /** The passages the task read. */
  reads: PassageId[];
  finding: Finding | null;
};

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const names = (route: readonly RouteStep[]) => route.map((s) => s.name).join(" → ");

/** What each rule wants, in a few words, for the one-line finding. The full position is in the review table. */
export const WANTS: Record<string, string> = {
  "PB-REN-01": "12-month renewals on 30 days' notice",
  "PB-PAY-01": "net 45",
  "PB-LIAB-01": "12 months of fees",
  "PB-IND-01": "an IP indemnity outside the cap",
  "PB-DATA-01": "a signed DPA before any processing",
  "PB-DATA-02": "72 hours",
  "PB-IP-01": "Northstar to own its data and outputs",
  "PB-CONF-01": "at least 3 years",
  "PB-TERM-01": "30 days' notice for convenience",
  "PB-ASSIGN-01": "consent, except a successor",
  "PB-INS-01": "$5M cyber and $2M general cover",
  "PB-LAW-01": "California or Delaware law",
  "PB-SEC-01": "the SOC 2 Type II report and latest pen-test summary before signing",
};

/** "Cap = fees paid in the 3 months before the claim; the playbook wants 12 months of fees." The risk and the rule have their own columns. */
export function findingLine(f: Finding): string {
  const wants = (f.ruleId && WANTS[f.ruleId]) || f.position;
  if (f.status === "deviation") return `${f.vendorWrote}; the playbook wants ${wants}.`;
  if (f.status === "request") return `Request drafted for ${wants}. It goes out with the first redlines.`;
  if (f.status === "info") return `${f.vendorWrote}. ${f.position}.`;
  return `${f.vendorWrote}.`;
}

export function taskOutcome(task: PlanTask, matter: MatterRecord, review: ReviewState): TaskOutcome {
  const reads = [...new Set(task.terms.map((key) => matter.terms[key].cite))];
  const devs = deviations(review.findings);
  switch (task.kind) {
    case "identify": {
      const f = NOTES.parties(matter.terms);
      return { status: "done", line: `${matter.terms.parties.value.join(" and ")} · ${matter.product} · the signed agreement controls (${matter.terms.orderOfPrecedence.cite}).`, cite: f.cite, reads, finding: f };
    }
    case "note": {
      const f = NOTES.security(matter.terms);
      return { status: "done", line: findingLine(f), cite: f.cite, reads, finding: f };
    }
    case "check":
    case "learned": {
      const f = review.findings.find((x) => x.ruleId === task.ruleIds[0]) ?? null;
      if (!f) return { status: "done", line: "Nothing to check.", cite: null, reads, finding: null };
      return { status: f.status === "deviation" ? "attention" : "done", line: findingLine(f), cite: f.cite, reads, finding: f };
    }
    case "redlines": {
      const requests = review.findings.filter((f) => f.status === "request").length;
      return {
        status: "done",
        line: `${devs.length} ${devs.length === 1 ? "redline" : "redlines"} drafted, one per deviation${requests ? `, plus ${requests} learned ${requests === 1 ? "request" : "requests"}` : ""}. Edit any of them in the review table.`,
        cite: null,
        reads: devs.map((f) => f.cite),
        finding: null,
      };
    }
    case "route": {
      const cfo = review.route.find((s) => s.ruleId === "PB-APR-03");
      return {
        status: "done",
        line: review.route.length ? `${names(review.route)}${cfo ? ` · ${cfo.reason.replace(/^The spend: /, "")}` : ""}.` : "No deviations and under the CFO line: no approvals needed.",
        cite: null,
        reads: [],
        finding: null,
      };
    }
    case "packet":
      return {
        status: "done",
        line: `All ${review.route.length} approved: the redline package (${devs.length} ${devs.length === 1 ? "redline" : "redlines"} and a cover note) is released to send to ${matter.vendorShort}.`,
        cite: null,
        reads: [],
        finding: null,
      };
  }
}

/** What task 17 says while it waits for the approvers. */
export function heldLine(matter: MatterRecord, review: ReviewState): string {
  return `Held until all ${review.route.length} approvers approve. Then the redline package goes to ${matter.vendorShort}.`;
}
