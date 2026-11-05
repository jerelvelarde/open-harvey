// The approval seal, read from a matter: one petal per playbook check, one ring per approver.
// It is drawn in ink and green, with red only on a deviating petal: a pass is green, a deviation
// red, a learned request ink, a check not run yet muted ink. Nothing is computed here that
// lib/review.ts did not already decide.

import type { MatterView } from "@/lib/store";

export type CheckStatus = "pass" | "fail" | "missing" | "warn" | "info";
export type SealTone = "green" | "red" | "ink" | "muted";
export type SealCheck = { id: string; status: CheckStatus; tone?: SealTone };
export type SignerState = "pending" | "approved" | "sent_back" | "rejected";
export type SealSigner = { name: string; state: SignerState };

export function sealFor(view: MatterView): { checks: SealCheck[]; signers: SealSigner[] } {
  const found = new Map(view.found.filter((f) => f.ruleId).map((f) => [f.ruleId!, f]));
  const checks: SealCheck[] = view.review.findings.map((f) => {
    const run = found.get(f.ruleId!);
    const status: CheckStatus = !run ? "info" : run.status === "pass" ? "pass" : run.status === "deviation" ? "fail" : "warn";
    const tone: SealTone = !run ? "muted" : run.status === "pass" ? "green" : run.status === "deviation" ? "red" : "ink";
    return { id: f.ruleId!, status, tone };
  });
  const submission = view.state?.submission;
  const routeKnown = view.plan.some((t) => t.id === "route" && t.status === "done") || Boolean(submission);
  const route = submission?.route ?? (routeKnown ? view.review.route : []);
  const signers: SealSigner[] = route.map((step, i) => ({ name: step.name, state: submission?.decisions[i]?.decision ?? "pending" }));
  return { checks, signers };
}
