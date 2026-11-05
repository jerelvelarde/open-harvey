// Concept: learning from corrections, with a person deciding what the copilot learns.
//
// Open Harvey went live on Monday (GO_LIVE), with the earlier reviews imported
// (review-history.jsonl). From then on it checks each new send-back against that history. Read the
// imported reviews plus this session's decisions, pull out every send-back
// with the days it cost, sort the approvers' comments into reasons, and, when the same reason keeps
// coming back and no playbook rule covers it, draft a rule from a hand-written template. Nothing here
// calls a model: it is deterministic and offline, so the demo runs the same every time. A person
// publishes or dismisses the draft in Insights; only published rules reach the plan and the copilot.
//
// In production you would not write the classifier or the template: CopilotKit Intelligence's
// Automatic Learning reads real threads and proposes skills, and a person still reviews them before
// they go live: https://docs.copilotkit.ai/intelligence/overview

import { getPerson } from "./company";

/** The Monday Open Harvey went live, with the earlier reviews imported. */
export const GO_LIVE = "2026-11-02";

export type DecisionKind = "approved" | "sent_back" | "rejected";
export type PastDecision = { approver: string; decision: DecisionKind; at: string; comment: string };
export type PastRound = { submitted: string; decisions: PastDecision[] };
export type PastReview = {
  id: string;
  vendor: string;
  agreement: string;
  owner: string;
  annualFee: number;
  termMonths: number;
  processesCustomerData: boolean;
  rounds: PastRound[];
  signed: string | null;
};

export function parseReviewHistory(jsonl: string): PastReview[] {
  return jsonl
    .split("\n")
    .filter((line) => line.trim())
    .map((line, i) => {
      const review = JSON.parse(line) as PastReview;
      if (!review.id || !Array.isArray(review.rounds)) throw new Error(`review-history.jsonl line ${i + 1} is not a review`);
      return review;
    });
}

/** One send-back: who sent which review back, in their own words, and how long it cost. */
export type SendBack = {
  matterId: string;
  vendor: string;
  agreement: string;
  approver: string;
  at: string;
  comment: string;
  /** When the review came back to the approvers, or null if it has not (yet). */
  resubmitted: string | null;
  /** Days from the send-back to the resubmission. Null for this session's, which has no later date yet. */
  daysLost: number | null;
  source: "history" | "session";
};

const DAY_MS = 24 * 60 * 60 * 1000;
const days = (from: string, to: string) => Math.round((Date.parse(to.slice(0, 10)) - Date.parse(from.slice(0, 10))) / DAY_MS);

export function sendBacksFrom(reviews: readonly PastReview[]): SendBack[] {
  return reviews.flatMap((review) =>
    review.rounds.flatMap((round, r) =>
      round.decisions
        .filter((d) => d.decision === "sent_back")
        .map((d) => {
          const resubmitted = review.rounds[r + 1]?.submitted ?? null;
          return {
            matterId: review.id,
            vendor: review.vendor,
            agreement: review.agreement,
            approver: d.approver,
            at: d.at,
            comment: d.comment,
            resubmitted,
            daysLost: resubmitted ? days(d.at, resubmitted) : null,
            source: "history" as const,
          };
        }),
    ),
  );
}

/** Days lost across send-backs, counting only those resubmitted. Insights' rule text and the collection both add them up here. */
export function totalDaysLost(sendBacks: readonly { daysLost?: number | null }[]): number {
  return sendBacks.reduce((sum, s) => sum + (s.daysLost ?? 0), 0);
}

/**
 * Security evidence that reached Security only after a send-back: a review sent back for its SOC 2
 * Type II report and pen-test summary, then approved by the same approver in a later round, which is
 * when the evidence was in the file. Read from the imported history alone.
 */
export type EvidenceReceipt = { matterId: string; vendor: string; approver: string; sentBackAt: string; receivedAt: string; daysLost: number | null };

export function securityEvidenceReceipts(history: readonly PastReview[]): EvidenceReceipt[] {
  return sendBacksFrom(history)
    .filter((s) => classifyComment(s.comment) === "security_evidence")
    .flatMap((s) => {
      const review = history.find((r) => r.id === s.matterId);
      const later = review?.rounds.filter((round) => round.submitted >= (s.resubmitted ?? "9999"));
      const approval = later?.flatMap((round) => round.decisions).find((d) => d.approver === s.approver && d.decision === "approved");
      return approval ? [{ matterId: s.matterId, vendor: s.vendor, approver: s.approver, sentBackAt: s.at, receivedAt: approval.at, daysLost: s.daysLost }] : [];
    });
}

// ---------------------------------------------------------------------------------------------
// 1. Sort each comment into a reason

export type ReasonKey = "security_evidence" | "indemnity" | "other";

export const REASONS: Record<ReasonKey, { label: string; pattern: RegExp | null; coveredBy?: string }> = {
  security_evidence: { label: "Missing security evidence (SOC 2 Type II, pen-test summary)", pattern: /SOC ?2|pen-?test|penetration[- ]test/i },
  indemnity: { label: "Indemnity scope", pattern: /indemn/i, coveredBy: "PB-IND-01 (the copilot already checks it)" },
  other: { label: "Other", pattern: null },
};

export function classifyComment(comment: string): ReasonKey {
  for (const key of ["security_evidence", "indemnity"] as const) {
    if (REASONS[key].pattern?.test(comment)) return key;
  }
  return "other";
}

// ---------------------------------------------------------------------------------------------
// 2. Group by reason, most send-backs first

export type ReasonGroup = { key: ReasonKey; label: string; coveredBy?: string; sendBacks: SendBack[] };

export function groupSendBacks(sendBacks: readonly SendBack[]): ReasonGroup[] {
  const groups = new Map<ReasonKey, ReasonGroup>();
  for (const sendBack of sendBacks) {
    const key = classifyComment(sendBack.comment);
    const group = groups.get(key) ?? { key, label: REASONS[key].label, coveredBy: REASONS[key].coveredBy, sendBacks: [] };
    group.sendBacks.push(sendBack);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.sendBacks.length - a.sendBacks.length);
}

// ---------------------------------------------------------------------------------------------
// 3. Draft a playbook rule for a send-back that keeps recurring and no rule covers

/** A reason needs this many send-backs before a rule is proposed. */
export const RECURRING = 3;

export type RuleProposal = { id: string; title: string; reason: ReasonKey; markdown: string; evidence: SendBack[] };

function securityEvidenceRule(evidence: SendBack[]): RuleProposal {
  const history = evidence.filter((s) => s.source === "history");
  const approvers = [...new Set(evidence.map((s) => getPerson(s.approver).name))].join(" and ");
  const total = totalDaysLost(history);
  const markdown = [
    "# PB-SEC-01 Security evidence for data processors",
    "## The rule",
    "For any vendor that processes Northstar customer data, request the vendor's SOC 2 Type II report and its latest penetration-test summary before signing.",
    "## Why",
    `${approvers} sent back ${evidence.length} vendor reviews for this evidence, ${history.length} of them before go-live. The ones resubmitted lost ${total} days between them, about a week each.`,
    "## What the copilot does",
    '- Adds a task to the review plan whenever the vendor processes customer data: "Request the SOC 2 Type II report and pen-test summary".',
    "- Adds the request to the review table, cited to the vendor's security clause, and sends it with the first redlines.",
    "- Routes the review to the Head of Security (PB-APR-02).",
  ].join("\n");
  return { id: "PB-SEC-01", title: "Security evidence for data processors", reason: "security_evidence", markdown, evidence };
}

/**
 * What Insights says about a proposal, from the dates alone: "First new send-back since go-live ·
 * matches 3 in the imported history". Before a new send-back, Insights has nothing to say.
 */
export function insightSignal(evidence: readonly SendBack[]): string | null {
  const imported = evidence.filter((s) => s.source === "history").length;
  const fresh = evidence.filter((s) => s.source === "session").length;
  if (fresh === 0) return null;
  const first = fresh === 1 ? "First new send-back since go-live" : `${fresh} new send-backs since go-live`;
  return `${first} · matches ${imported} in the imported history`;
}

const TEMPLATES: Partial<Record<ReasonKey, (evidence: SendBack[]) => RuleProposal>> = {
  security_evidence: securityEvidenceRule,
};

/** One proposal per recurring reason that has a template and is not already covered by a rule. */
export function proposeRules(groups: readonly ReasonGroup[]): RuleProposal[] {
  return groups.flatMap((group) => {
    const template = TEMPLATES[group.key];
    if (!template || group.coveredBy || group.sendBacks.length < RECURRING) return [];
    return [template([...group.sendBacks].sort((a, b) => (a.at < b.at ? -1 : 1)))];
  });
}
