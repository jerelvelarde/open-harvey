// The empty state of a thread: before its first message, the copilot says what it does here.
// - No matter open: a greeting for Maya, what the copilot does, and what is on her desk (each matter
//   with where it stands, a click away). The suggestion chips above the composer hold the lines to try.
// - A matter open: its title and how a review goes. The collection: what its table is for.
// CopilotKit shows its welcome screen only while the whole chat is empty; a new thread opened after
// earlier work is empty too, so ChatPanel.tsx draws this in both places.

"use client";

import { ArrowRight, FileText } from "lucide-react";
import { goTo } from "@/components/shell-state";
import { usd, shortDate, timeLabel } from "@/components/ui/format";
import { CopilotGlyph } from "@/components/ui/LegalTags";
import { COLLECTION_NAME } from "@/lib/collection";
import { CURRENT_USER, getPerson, storyNow } from "@/lib/company";
import { getMatter, matterTitle } from "@/lib/matters";
import { currentApprover, matterView, openMatter, queueMatterIds, useAppState, type MatterView } from "@/lib/store";

/** Where a matter stands, in a few words. */
function deskLine(view: MatterView): string {
  const sub = view.state?.submission;
  switch (view.status) {
    case "new":
      return [`Received ${timeLabel(view.matter.receivedAt)}`, usd(view.review.totalValue), view.matter.pricingHoldsUntil && `pricing holds until ${shortDate(view.matter.pricingHoldsUntil)}`].filter(Boolean).join(" · ");
    case "in_review":
      return "In review";
    case "needs_reason":
      return "Needs your reason for the General Counsel";
    case "ready":
      return "Reviewed · ready to send for approval";
    case "pending":
      return sub && currentApprover(sub) ? `With ${currentApprover(sub)!.name} for approval` : "With the approvers";
    case "sent_back": {
      const by = sub?.decisions.at(-1)?.approverId;
      return by ? `Sent back by ${getPerson(by).name}` : "Sent back";
    }
    case "approved":
      return "Approved by every approver";
    case "rejected":
      return "Rejected";
  }
}

function partOfDay(): string {
  const hour = Number(storyNow().slice(11, 13));
  return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
}

export function ChatGreeting() {
  const state = useAppState();
  const active = state.activeMatterId ? getMatter(state.activeMatterId) : null;

  if (active) {
    return (
      <Frame title={matterTitle(active)} serif>
        Ask me to review it. I propose a plan from the playbook, run it once you approve it, and cite every finding to its passage. I can also work in the
        contract with you: tracked edits, new clauses and comments in the margin.
      </Frame>
    );
  }
  if (state.activeCollectionId) {
    return (
      <Frame title={COLLECTION_NAME} serif>
        Ask a question of every contract in it. I answer its review table one cell at a time, each answer quoted and cited. I write only to that table, never to a contract,
        redline or playbook rule.
      </Frame>
    );
  }

  const desk = queueMatterIds(state).map((id) => matterView(state, id));
  return (
    <div data-testid="chat-greeting">
      <CopilotGlyph size={24} />
      <p className="mt-3 font-serif text-[28px] leading-[34px] tracking-[-0.01em] text-ink">
        Good {partOfDay()}, {CURRENT_USER.name.split(" ")[0]}.
      </p>
      <p className="mt-2 max-w-[62ch] text-muted [text-wrap:pretty]">
        I'm your contract copilot. I review vendor contracts against the Northstar playbook, draft the redlines, work in the contract with you and route it for approval.
        Nothing runs until you approve it. Pick a line below, or name a contract.
      </p>
      {desk.length > 0 && (
        <div className="mt-5">
          <p className="text-small font-medium text-muted">On your desk</p>
          <ul className="mt-1.5 divide-y divide-hairline overflow-hidden rounded-md border border-hairline bg-surface">
            {desk.map((view) => (
              <li key={view.matter.id}>
                <button
                  type="button"
                  onClick={() => {
                    openMatter(view.matter.id);
                    goTo("assistant");
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-stone"
                  data-testid={`desk-${view.matter.id}`}
                >
                  <FileText aria-hidden className="size-4 shrink-0 text-muted" strokeWidth={1.75} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{matterTitle(view.matter)}</span>
                    <span className="block truncate text-small text-muted">{deskLine(view)}</span>
                  </span>
                  <ArrowRight aria-hidden className="size-4 shrink-0 text-muted" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Frame({ title, serif, children }: { title: string; serif?: boolean; children: React.ReactNode }) {
  return (
    <div data-testid="chat-greeting">
      <p className={serif ? "font-serif text-title text-ink" : "text-title font-semibold text-ink"}>{title}</p>
      <p className="mt-2 max-w-[60ch] text-muted [text-wrap:pretty]">{children}</p>
    </div>
  );
}
