// The matter header, compressed so the tab's content starts high on the screen: the serif title, one
// meta line with what the contract is, what it is worth and how long the price holds, the vendor and
// the business owner, then the seal with its counts and the next step. The status chip shows only
// when the next step does not already say it. Every count comes from lib/store.ts matterCounts, the
// same function the tabs, the table and the chat cards use.

"use client";

import { ArrowRight, Clock, Send } from "lucide-react";
import type { ReactNode } from "react";
import { SealWithKey } from "@/components/ui/ApprovalSeal";
import { Button, Tag } from "@/components/ui/Card";
import { Figure } from "@/components/ui/Figure";
import { daysBetween, personName, shortDate } from "@/components/ui/format";
import { sealFor } from "@/components/ui/seal-state";
import { useWaitingGate } from "@/copilot/gate-state";
import { useAskCopilot } from "@/copilot/useAskCopilot";
import { REVIEW_LINE } from "@/copilot/chips";
import { STORY_DATE, getPerson } from "@/lib/company";
import { currentApprover, matterCounts, sendForApproval, type MatterStatus, type MatterView } from "@/lib/store";
import { STATUS_TAG } from "./MatterQueue";

/** Statuses the next step does not already say, so the header carries them as a chip. */
const CHIP_STATUSES: MatterStatus[] = ["sent_back", "rejected", "approved"];

export function MatterHeader({ view }: { view: MatterView }) {
  const { matter, review } = view;
  const owner = getPerson(matter.businessOwner);
  const status = STATUS_TAG[view.status];
  const { checks, signers } = sealFor(view);
  const months = matter.terms.initialTermMonths.value;

  return (
    <section aria-label="Matter" className="rounded-md border border-hairline bg-surface" data-testid="matter-header">
      <div className="grid items-center gap-x-6 gap-y-1 px-5 py-3.5 @3xl:grid-cols-[minmax(0,1fr)_auto] @3xl:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="font-serif text-display tracking-[-0.01em] text-ink [text-wrap:balance]">
            {matter.vendorShort} · {matter.kind}
          </h1>
          {CHIP_STATUSES.includes(view.status) && (
            <Tag tone={status.tone} data-testid="matter-status">
              {status.label}
            </Tag>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 @3xl:row-span-2">
          <SealWithKey matterNumber={matter.matterNumber} checks={checks} signers={signers} counts={matterCounts(view)} sent={Boolean(view.state?.submission)} />
          <div className="min-w-[180px] border-l border-hairline pl-6 @max-3xl:border-0 @max-3xl:pl-0" data-testid="next-step">
            <p className="text-small text-muted">Next step</p>
            <div className="mt-0.5">
              <NextStep view={view} />
            </div>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-muted" data-testid="type-line">
            Vendor contract · <span className="font-mono text-small text-ink">{matter.matterNumber}</span> ·{" "}
            <span data-testid="total-value">
              <Figure value={review.totalValue} className="font-medium text-ink" /> over {months} months
            </span>
            {matter.pricingHoldsUntil && (
              <>
                {" "}
                · pricing holds to {shortDate(matter.pricingHoldsUntil)} <span className="whitespace-nowrap">({daysBetween(STORY_DATE, matter.pricingHoldsUntil)} days)</span>
              </>
            )}
          </p>
          <p className="text-small text-muted">
            {matter.vendor} · {matter.product} · for {owner.name}, {owner.team}
          </p>
        </div>
      </div>
    </section>
  );
}

/** A state that waits on someone: a quiet line (and an optional detail line), never a disabled button. */
function Waiting({ children, sub, icon }: { children: ReactNode; sub?: string; icon?: ReactNode }) {
  return (
    <div>
      <p className="flex items-start gap-1.5 font-medium text-ink" data-testid="next-step-line">
        {icon}
        <span>{children}</span>
      </p>
      {sub && <p className="ml-5 text-small text-muted">{sub}</p>}
    </div>
  );
}

const ToCopilot = () => <ArrowRight aria-label="in the copilot" className="mt-[3px] size-3.5 shrink-0 text-muted" strokeWidth={2.25} />;

/** One primary action on screen at a time: only an actionable state gets a button. */
function NextStep({ view }: { view: MatterView }) {
  const gate = useWaitingGate();
  const { ask, busy } = useAskCopilot();
  const waiting = gate?.matterId === view.matter.id ? gate.kind : null;
  const submission = view.state?.submission;

  if (waiting === "plan") return <Waiting icon={<ToCopilot />}>Approve the plan in the copilot</Waiting>;
  if (waiting === "send") return <Waiting icon={<ToCopilot />}>Send it, or keep editing, in the copilot</Waiting>;

  if (view.status === "new") {
    return (
      <Button variant="primary" size="sm" disabled={busy} onClick={() => ask(REVIEW_LINE[view.matter.id])}>
        Review with the copilot
      </Button>
    );
  }

  if (submission) {
    const next = currentApprover(submission);
    const last = submission.decisions.at(-1);
    if (submission.status === "sent_back" && last) return <Waiting>Resubmit to {personName(last.approverId)}</Waiting>;
    if (submission.status === "pending" && next) return <Waiting icon={<Clock aria-hidden className="mt-[3px] size-3.5 shrink-0 text-muted" strokeWidth={2.25} />}>With {next.name}</Waiting>;
    if (submission.status === "approved") return <Waiting>Send the redline package to {view.matter.vendorTerm}</Waiting>;
    return <Waiting>Rejected by {last ? personName(last.approverId) : "an approver"}</Waiting>;
  }

  if (view.status === "in_review") return <Waiting>The plan is running</Waiting>;
  if (view.status === "needs_reason") return <Waiting icon={<ToCopilot />}>{`Give the copilot your reason for ${view.missingReasons.map((f) => f.cite).join(", ")}`}</Waiting>;
  return (
    <div>
      <Button variant="primary" size="sm" onClick={() => sendForApproval(view.matter.id, "header")}>
        <Send aria-hidden className="size-3.5" />
        Send for approval
      </Button>
      <p className="mt-0.5 text-small text-muted">to {view.review.route.map((s) => s.name.split(" ")[0]).join(", ")}</p>
    </div>
  );
}
