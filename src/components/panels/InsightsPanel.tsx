// Concept: learning, with a person deciding what the copilot learns.
//
// Open Harvey went live on Monday with the earlier reviews imported (review-history.jsonl). When
// an approver sends a review back, Insights checks the new send-back against that history and groups
// the comments by reason (lib/learning.ts). When the same reason keeps coming back and no playbook
// rule covers it, it proposes one. The panel is a recommendation review: the proposed rule as a
// document (the hero), the evidence in the approvers' own words, and the gate. Playbook changes belong
// to the General Counsel, so the presenter publishes acting as Rachel Adler; nothing reaches the
// copilot until that click. A published rule adds its task to every new plan and its row to the review
// table, and goes to the agent as context.

"use client";

import { Avatar } from "@/components/ui/Avatar";
import { Button, Tag } from "@/components/ui/Card";
import { SkillDocument } from "@/components/ui/SkillDocument";
import { dateLabel, personName } from "@/components/ui/format";
import { getPerson } from "@/lib/company";
import { GO_LIVE, groupSendBacks, insightSignal, proposeRules, sendBacksFrom, type PastReview, type ReasonGroup, type RuleProposal, type SendBack } from "@/lib/learning";
import { PLAYBOOK_OWNER, dismissRule, publishRule, reviewOf, sessionSendBacks, useAppState, type AppState, type ProposalReview as Review } from "@/lib/store";

export { pendingProposals } from "@/lib/store";

const groupsFor = (state: AppState, history: PastReview[]) => groupSendBacks([...sendBacksFrom(history), ...sessionSendBacks(state)]);

/** `inMatter`: shown as a matter's tab, under the matter's own 22px title, so the rule's title steps down. */
export function InsightsPanel({ history, inMatter = false }: { history: PastReview[]; inMatter?: boolean }) {
  const state = useAppState();
  const fresh = sessionSendBacks(state).length;
  const groups = groupsFor(state, history);
  // Insights reads the history when a new send-back arrives: before one, it has nothing to propose.
  const proposals = fresh ? proposeRules(groups).filter((p) => p.evidence.some((e) => e.source === "session")) : [];
  const others = fresh ? groups.filter((g) => !proposals.some((p) => p.reason === g.key)) : [];

  return (
    <div className="space-y-6">
      {proposals.length === 0 && (
        <article className="rounded-md border border-hairline bg-surface px-5 py-8 @3xl:px-8" data-testid="insights-empty">
          <h2 className="font-semibold text-ink">{fresh ? "Nothing recurring in the new send-backs" : "No new send-backs since go-live"}</h2>
          <p className="mt-1 max-w-[60ch] text-muted">
            Open Harvey went live on {dateLabel(GO_LIVE)} with {history.length} earlier reviews imported. Each new send-back is checked against them, and a reason
            that keeps coming back becomes a proposed playbook rule here, for the General Counsel to review.
          </p>
        </article>
      )}
      {proposals.map((proposal) => (
        <Recommendation key={proposal.id} proposal={proposal} review={reviewOf(state, proposal)} inMatter={inMatter} />
      ))}

      {others.length > 0 && (
        <section aria-label="Other approver feedback">
          <h2 className="section-label mb-1 border-b border-hairline pb-1.5">Also in approver comments</h2>
          <ul className="divide-y divide-hairline">
            {others.map((group) => (
              <li key={group.key} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2">
                <span className="min-w-0">
                  <span className="font-medium">{group.label}</span>
                  <span className="text-small text-muted"> · {group.sendBacks.map((s) => s.vendor).join(", ")}</span>
                </span>
                <span className="text-small text-muted">
                  {group.sendBacks.length} send-back{group.sendBacks.length === 1 ? "" : "s"} · {watchNote(group)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Recommendation({ proposal, review, inMatter }: { proposal: RuleProposal; review: Review; inMatter: boolean }) {
  const state = useAppState();
  const published = state.publishedRules.find((r) => r.id === proposal.id);
  const version = published?.version ?? 1;
  const owner = getPerson(PLAYBOOK_OWNER);

  return (
    <article aria-label="Recommendation" className="rounded-md border border-hairline bg-surface" data-testid="recommendation">
      <header className="flex flex-col gap-3 border-b border-hairline px-5 py-3.5 @3xl:px-6 @4xl:flex-row @4xl:items-center @4xl:justify-between">
        <div className="min-w-0">
          <h2 className="font-semibold text-ink [text-wrap:balance]">Security keeps sending back data-processor contracts that lack security evidence</h2>
          <p className="mt-0.5 text-small text-muted" data-testid="insight-signal">
            {insightSignal(proposal.evidence)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-1 @4xl:items-end" data-testid="publish-gate">
          {review === "proposed" && (
            <>
              <div className="flex gap-2">
                <Button onClick={() => dismissRule(proposal.id)}>Dismiss</Button>
                <Button variant="primary" onClick={() => publishRule(proposal, owner.id)}>
                  Publish to the copilot
                </Button>
              </div>
              <p className="flex items-center gap-1.5 text-small text-muted @4xl:justify-end" data-testid="acting-as">
                <Avatar name={owner.name} size={24} tone="paper" />
                Acting as {owner.name}, {owner.title}
              </p>
            </>
          )}
          {review === "published" && published && (
            <>
              <Tag tone="green" data-testid="published-stamp">
                Published v{published.version}
              </Tag>
              <p className="text-small text-muted @4xl:text-right">
                by {personName(published.publishedBy)}, {dateLabel(published.publishedAt)} · in every new plan
              </p>
            </>
          )}
          {review === "dismissed" && <Button onClick={() => publishRule(proposal, owner.id)}>Publish after all</Button>}
        </div>
      </header>

      <div className="grid grid-cols-1 @4xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <section aria-label="Proposed rule" className="border-b border-hairline bg-paper px-5 py-5 @3xl:px-6 @4xl:border-b-0 @4xl:border-r">
          <SkillDocument markdown={published?.markdown ?? proposal.markdown} number={`${proposal.id} · ${review === "published" ? `v${version}` : "draft"}`} titleSize={inMatter ? "body" : "title"} />
        </section>
        <section aria-label="Evidence" className="px-5 py-5 @3xl:px-6">
          <h3 className="section-label mb-3">In the approvers&apos; words</h3>
          <ol className="space-y-4">
            {proposal.evidence.map((s) => (
              <Quote key={`${s.matterId}-${s.at}`} sendBack={s} />
            ))}
          </ol>
        </section>
      </div>

      <footer className="border-t border-hairline px-5 py-3 @3xl:px-6">
        <p className="max-w-[80ch] text-small text-muted">
          {review === "published"
            ? "Every new review plan for a vendor that holds customer data now gets the task, and the review table gets the row. Reviews already run keep the plan they were approved with."
            : review === "dismissed"
              ? "Dismissed. The copilot does not see this rule."
              : "In this starter, publishing switches on a prepared check. In production, CopilotKit Intelligence's Automatic Learning proposes the rule from real threads, and a person approves it before the agent loads it."}
        </p>
      </footer>
    </article>
  );
}

function Quote({ sendBack: s }: { sendBack: SendBack }) {
  const person = getPerson(s.approver);
  return (
    <li className="flex gap-3">
      <Avatar name={person.name} size={28} />
      <div className="min-w-0">
        <p>
          <span className="font-medium">{s.vendor}</span>
          <span className="text-small text-muted">
            {" "}
            · {s.source === "session" ? "today" : dateLabel(s.at)}
            {s.daysLost !== null && ` · ${s.daysLost} days lost`}
          </span>
        </p>
        <blockquote className="mt-0.5 text-ink">&ldquo;{s.comment}&rdquo;</blockquote>
        <p className="mt-0.5 text-small text-muted">
          {person.name}, {person.title}
        </p>
      </div>
    </li>
  );
}

function watchNote(group: ReasonGroup) {
  return group.coveredBy ? `covered by ${group.coveredBy}` : "watching";
}
