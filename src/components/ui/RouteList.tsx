// The approval route: who approves, in order, and the rule that put each person on it
// (PB-APR-01/02/03, worked out by lib/review.ts routeApprovals). Once sent, each row is that
// approver's record: the decision, when, and their comment in their own words. It is the decision
// log, so nothing else on screen repeats it.

import type { RouteStep } from "@/lib/review";
import { Avatar } from "./Avatar";
import { Tag, type Tone } from "./Card";
import { timeLabel } from "./format";
import type { SignerState } from "./seal-state";

const STATE_TAG: Record<SignerState, { label: string; tone: Tone }> = {
  pending: { label: "Queued", tone: "neutral" },
  approved: { label: "Approved", tone: "green" },
  // The matter's status chip is the one solid "Sent back"; the approver's own row outlines it (still to act on).
  sent_back: { label: "Sent back", tone: "amber" },
  rejected: { label: "Rejected", tone: "red" },
};

export function RouteList({
  steps,
  states,
  waitingIndex,
  comments,
  times,
  compact = false,
}: {
  steps: RouteStep[];
  /** Each approver's decision, in order. Omitted before sending: nobody has decided yet. */
  states?: SignerState[];
  /** The approver whose turn it is. */
  waitingIndex?: number;
  /** Each approver's comment, in their words, shown in their row (a send-back's reason). */
  comments?: (string | null | undefined)[];
  /** When each approver decided. */
  times?: (string | null | undefined)[];
  compact?: boolean;
}) {
  if (steps.length === 0) return <p className="py-2 text-small text-muted">The route is worked out once the review has run.</p>;
  return (
    <ol className="divide-y divide-hairline" data-testid="route-list">
      {steps.map((step, index) => {
        const state = states?.[index] ?? "pending";
        const tag = index === waitingIndex ? { label: "Awaiting decision", tone: "plum" as const } : STATE_TAG[state];
        const at = times?.[index];
        return (
          <li key={step.personId} className={`flex gap-2.5 ${compact ? "py-1.5" : "py-2"}`} data-testid="route-row">
            <Avatar name={step.name} size={compact ? 24 : 28} tone={state === "approved" ? "green" : "stone"} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0">
                  <span className="font-medium">{step.name}</span>
                  <span className="text-small text-muted">
                    {" "}
                    · <span className="whitespace-nowrap">{step.title}</span>
                  </span>
                </span>
                {states && (
                  <span className="flex shrink-0 items-center gap-2">
                    {at && state !== "pending" && <span className="text-small text-muted">{timeLabel(at)}</span>}
                    <Tag tone={tag.tone}>{tag.label}</Tag>
                  </span>
                )}
              </div>
              <div className="text-small text-muted">
                {step.reason} · <span className="font-mono">{step.ruleId}</span>
              </div>
              {comments?.[index] && (
                <blockquote className="mt-1 text-ink [text-wrap:pretty]" data-testid="route-comment">
                  &ldquo;{comments[index]}&rdquo;
                </blockquote>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
