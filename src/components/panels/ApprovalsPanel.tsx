// Concept: approvals stay with people. A review sent for approval waits here, and the presenter acts
// as each approver in turn, in the order the rules set (PB-APR-01/02/03). An approver approves
// Northstar's position: what Northstar gives up and why, in Maya's words, and the redlines that go to
// the vendor once every approver has approved. The route is the decision record: each approver's
// decision, when, and their comment in their own words, said once, in their row. Send-backs feed
// Insights. The matter header above carries the status and the counts, so this tab does not repeat them.

"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Blackline } from "@/components/ui/Blackline";
import { Button } from "@/components/ui/Card";
import { CiteChip, ResultTag } from "@/components/ui/LegalTags";
import { RouteList } from "@/components/ui/RouteList";
import { personName } from "@/components/ui/format";
import type { SignerState } from "@/components/ui/seal-state";
import { matterTitle } from "@/lib/matters";
import { redlineSummary, byRisk } from "@/lib/review";
import { currentApprover, matterView, recordDecision, useAppState, type DecisionKind, type MatterView, type Submission } from "@/lib/store";

export function ApprovalsPanel() {
  const state = useAppState();
  const sent = Object.keys(state.matters)
    .map((id) => matterView(state, id))
    .filter((v) => v.state?.submission)
    .sort((a, b) => (a.matter.id === state.activeMatterId ? -1 : b.matter.id === state.activeMatterId ? 1 : 0));

  if (sent.length === 0) {
    return (
      <article aria-label="Approvals" className="rounded-md border border-hairline bg-surface px-5 py-8 @3xl:px-8">
        <h2 className="font-semibold text-ink">Nothing to approve yet</h2>
        <p className="mt-1 max-w-[54ch] text-muted">
          A review lands here when Maya sends it for approval. Then you act as each approver in turn, in the order the playbook sets: approve it, send it back with a
          comment, or reject it.
        </p>
      </article>
    );
  }
  return (
    <div className="space-y-4">
      {sent.map((view) => (
        <SubmissionRow key={view.matter.id} view={view} submission={view.state!.submission!} />
      ))}
    </div>
  );
}

function SubmissionRow({ view, submission: sub }: { view: MatterView; submission: Submission }) {
  const step = currentApprover(sub);
  const states: SignerState[] = sub.route.map((_, i) => sub.decisions[i]?.decision ?? "pending");
  const devs = view.review.findings.filter((f) => f.status === "deviation").sort(byRisk);
  const requests = view.review.findings.filter((f) => f.status === "request");
  const accepted = view.accepted;

  return (
    <article aria-label={`${matterTitle(view.matter)} approval`} className="rounded-md border border-hairline bg-surface" data-testid="approval-row">
      <div className="grid grid-cols-1 gap-6 px-5 py-4 @3xl:px-6 @5xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-5">
          {step && <DecisionForm key={`${view.matter.id}-${sub.decisions.length}`} matterId={view.matter.id} approverId={step.personId} approverTitle={step.title} reason={step.reason} />}

          <section aria-label="What Northstar gives up">
            <h3 className="section-label mb-1 border-b border-hairline pb-1.5">What Northstar gives up, and why</h3>
            {accepted.length === 0 ? (
              <p className="py-2 text-small text-muted">Nothing: every redline asks for the playbook position.</p>
            ) : (
              <ul className="divide-y divide-hairline">
                {accepted.map((f) => (
                  <li key={f.ruleId} className="py-2">
                    <p className="flex flex-wrap items-center gap-2">
                      <ResultTag status={f.status} risk={f.risk} />
                      <span className="font-medium">{f.topic}</span>
                      <CiteChip matterId={view.matter.id} cite={f.cite} quote={f.quote} label={f.ruleId!} />
                    </p>
                    <p className="mt-1 text-ink">{redlineSummary(f.ruleId!, view.redlines[f.ruleId!] ?? "") ?? view.redlines[f.ruleId!]}</p>
                    <p className="mt-0.5 text-small text-muted">
                      The playbook asks for: {f.position}. Maya&apos;s reason: <span className="text-ink">&ldquo;{sub.reasons[f.ruleId!] ?? view.state?.reasons[f.ruleId!]}&rdquo;</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Redlines for the vendor">
            <h3 className="section-label mb-1 border-b border-hairline pb-1.5">Goes to {view.matter.vendorTerm} once every approver has approved</h3>
            <ul className="divide-y divide-hairline">
              {[...devs, ...requests].map((f) => {
                const text = view.redlines[f.ruleId!] ?? f.redline ?? "";
                return (
                  <li key={f.ruleId} className="grid grid-cols-[52px_minmax(0,1fr)] gap-x-3 py-2">
                    <span className="font-mono text-small text-muted">{f.cite}</span>
                    {f.status === "request" ? <p className="text-quote text-ink">{text}</p> : <Blackline before={f.clause} after={text} />}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <div className="min-w-0">
          <h3 className="section-label mb-1 border-b border-hairline pb-1.5">Approval route</h3>
          <RouteList
            steps={sub.route}
            states={states}
            waitingIndex={step ? sub.decisions.length : undefined}
            comments={sub.route.map((_, i) => sub.decisions[i]?.comment || null)}
            times={sub.route.map((_, i) => sub.decisions[i]?.at ?? null)}
          />
        </div>
      </div>
    </article>
  );
}

function DecisionForm({ matterId, approverId, approverTitle, reason }: { matterId: string; approverId: string; approverTitle: string; reason: string }) {
  const [comment, setComment] = useState("");
  const needsComment = comment.trim() === "";
  const decide = (decision: DecisionKind) => recordDecision(matterId, decision, comment);
  const name = personName(approverId);
  return (
    <section aria-label={`Decision as ${name}`} className="rounded-md bg-stone px-4 py-3.5" data-testid="decision-form">
      <p className="flex items-center gap-2">
        <Avatar name={name} size={24} tone="paper" />
        <span>
          Acting as <span className="font-semibold">{name}</span>, {approverTitle}
        </span>
      </p>
      <p className="mt-1 text-small text-muted">On the route for: {reason}</p>
      <label className="mt-3 block">
        <span className="mb-1.5 block text-small text-muted">Comment, required to send it back or reject it</span>
        <textarea
          className="w-full rounded-[5px] border border-rule bg-surface px-2.5 py-1.5 text-body text-ink outline-none transition-[border-color,box-shadow] duration-150 focus:border-muted focus:shadow-[0_0_0_3px_rgb(22_20_15/0.06)]"
          rows={2}
          placeholder="e.g. Ask for their SOC 2 Type II report before we sign."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => decide("approved")}>
          Approve
        </Button>
        <Button onClick={() => decide("sent_back")} disabled={needsComment}>
          Send back
        </Button>
        <Button variant="danger" onClick={() => decide("rejected")} disabled={needsComment}>
          Reject
        </Button>
      </div>
    </section>
  );
}
