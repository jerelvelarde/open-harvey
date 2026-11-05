// The opening screen, all of Maya's Spaces: the matter queue. Acme Cloud's MSA, new this morning, sits on top; below it
// are the reviews imported when Open Harvey went live on Monday, as outcomes only (signed when,
// after how many send-backs, by whom). The approvers' words first appear in Insights, which reads
// them when a new send-back arrives.

"use client";

import { ArrowRight } from "lucide-react";
import { Button, Tag, type Tone } from "@/components/ui/Card";
import { daysBetween, dateLabel, personName, shortDate, timeLabel, usd } from "@/components/ui/format";
import { STORY_DATE, getPerson } from "@/lib/company";
import { sendBacksFrom, type PastReview } from "@/lib/learning";
import { getMatter } from "@/lib/matters";
import { matterView, queueMatterIds, useAppState, type MatterStatus, type MatterView } from "@/lib/store";

/** A matter's status as a chip. "New" has none: an untouched matter needs no label. */
export const STATUS_TAG: Record<MatterStatus, { label: string; tone: Tone }> = {
  new: { label: "Not reviewed", tone: "neutral" },
  in_review: { label: "In review", tone: "neutral" },
  needs_reason: { label: "Needs a reason", tone: "plum" },
  ready: { label: "Ready to send", tone: "plum" },
  pending: { label: "With approvers", tone: "neutral" },
  approved: { label: "Approved", tone: "green" },
  sent_back: { label: "Sent back", tone: "red" },
  rejected: { label: "Rejected", tone: "red" },
};

export function MatterQueue({ history, onOpen }: { history: PastReview[]; onOpen: (id: string) => void }) {
  const state = useAppState();
  const open = queueMatterIds(state).map((id) => matterView(state, id));
  const closed = [...history].reverse();
  const sendBacks = sendBacksFrom(history);

  return (
    <article aria-label="Matters" className="rounded-md border border-hairline bg-surface">
      <section aria-label="Open matters" className="px-5 pb-2 pt-4 @3xl:px-6">
        <div className="mb-1 flex items-baseline justify-between gap-3 border-b border-hairline pb-1.5">
          <h2 className="section-label">Open</h2>
          <span className="text-small text-muted">{dateLabel(STORY_DATE)}</span>
        </div>
        <ul className="divide-y divide-hairline">
          {open.map((view) => {
            const { matter } = view;
            const owner = getPerson(matter.businessOwner);
            const status = STATUS_TAG[view.status];
            const note = nextNote(view);
            return (
              <li key={matter.id} className="grid items-center gap-x-6 gap-y-2 py-3.5 @3xl:grid-cols-[minmax(0,1fr)_112px_132px_auto]" data-testid="queue-row">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold text-ink">
                      {matter.vendorShort} · {matter.kind}
                    </span>
                    {view.status !== "new" && <Tag tone={status.tone}>{status.label}</Tag>}
                  </p>
                  <p className="mt-0.5 text-small text-muted">
                    <span className="font-mono text-ink">{matter.matterNumber}</span> · {matter.product} · from {owner.name}, {owner.team} · received{" "}
                    {matter.receivedAt.startsWith(STORY_DATE) ? `today ${timeLabel(matter.receivedAt)}` : dateLabel(matter.receivedAt)}
                  </p>
                </div>
                <div className="@3xl:text-right">
                  <p className="text-small text-muted">Total value</p>
                  <p className="font-semibold tabular-nums">{usd(view.review.totalValue)}</p>
                </div>
                <div className="@3xl:text-right">
                  <p className="text-small text-muted">Pricing holds until</p>
                  <p className="font-medium">
                    {matter.pricingHoldsUntil ? (
                      <>
                        {shortDate(matter.pricingHoldsUntil)} <span className="text-small text-muted">· {daysBetween(STORY_DATE, matter.pricingHoldsUntil)} days</span>
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </p>
                </div>
                <Button variant={view.status === "new" ? "primary" : "secondary"} onClick={() => onOpen(matter.id)}>
                  Open
                  <ArrowRight aria-hidden className="size-3.5" />
                </Button>
                {note && (
                  <p className="text-small text-muted @3xl:col-span-4" data-testid="queue-note">
                    {note}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label="Reviewed before go-live" className="px-5 pb-4 pt-3 @3xl:px-6">
        <div className="mb-1 flex items-baseline justify-between gap-3 border-b border-hairline pb-1.5">
          <h2 className="section-label">Reviewed before go-live</h2>
          <span className="text-small text-muted">imported Monday · {closed.length}</span>
        </div>
        <ul className="divide-y divide-hairline">
          {closed.map((review) => {
            const backs = sendBacks.filter((s) => s.matterId === review.id);
            const value = Math.round((review.annualFee * review.termMonths) / 12);
            const by = [...new Set(backs.map((s) => personName(s.approver)))].join(", ");
            return (
              <li key={review.id} className="grid gap-x-4 gap-y-0.5 py-2.5 @3xl:grid-cols-[minmax(0,1fr)_auto]" data-testid="history-row">
                <p className="min-w-0">
                  <span className="font-medium text-ink">{review.vendor}</span>
                  <span className="text-ink"> · {review.agreement}</span>
                  <span className="text-small text-muted">
                    {" "}
                    · <span className="font-mono">{review.id}</span> · {usd(value)}
                    {review.processesCustomerData && " · holds customer data"}
                  </span>
                </p>
                <p className="text-small text-muted @3xl:text-right" data-testid="history-outcome">
                  Signed {review.signed ? shortDate(review.signed) : "—"}
                  {backs.length > 0 && ` · ${backs.length} send-back${backs.length === 1 ? "" : "s"} · ${by}`}
                </p>
              </li>
            );
          })}
        </ul>
      </section>
    </article>
  );
}

/**
 * What happens next for an open matter, in one quiet line from the data: the story's closing beat.
 * Acme, sent back for the security evidence, can still sign by Friday while its pricing holds;
 * Brightwater asks for that evidence with its first redlines, so Security has it on the first pass.
 */
function nextNote(view: MatterView): string | null {
  const sub = view.state?.submission;
  const holds = view.matter.pricingHoldsUntil ? `Fri ${shortDate(view.matter.pricingHoldsUntil)}` : null;
  const learned = view.found.find((f) => f.learned);
  if (sub?.status === "sent_back") {
    const by = sub.decisions.at(-1);
    return `Resubmit with what ${by ? personName(by.approverId) : "the approver"} asked for.${holds ? ` ${view.matter.vendorTerm} can still sign by ${holds}, while the pricing holds.` : ""}`;
  }
  if (sub?.status === "pending") {
    const next = sub.route[sub.decisions.length];
    return `With ${next?.name ?? "the approvers"}${holds ? ` · pricing holds until ${holds}` : ""}.`;
  }
  if (learned && view.complete) {
    return `The SOC 2 Type II report and pen-test summary are requested with the first redlines (${learned.learned!.id} v${learned.learned!.version}, learned), so Security has them on the first pass.`;
  }
  return null;
}

export const businessOwner = (matterId: string) => getPerson(getMatter(matterId).businessOwner);
