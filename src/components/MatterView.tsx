// The matter view: the matter as a workspace. Its header (serif title, one meta line, the seal with
// its counts and the next step), a one-line note when work is ready for someone (on the Tasks tab),
// and pill tabs: Tasks (the plan as a table grouped by phase, assigned to the copilot and to people),
// Review table, Contract, Approvals and Insights. The view follows the work like the assistant does.

"use client";

import { ArrowRight } from "lucide-react";
import { ApprovalsPanel } from "@/components/panels/ApprovalsPanel";
import { ContractViewer } from "@/components/panels/ContractViewer";
import { InsightsPanel } from "@/components/panels/InsightsPanel";
import { MatterHeader } from "@/components/panels/MatterHeader";
import { ReviewTable } from "@/components/panels/ReviewTable";
import { TasksTable } from "@/components/panels/TasksTable";
import { useCiteFocus } from "@/components/cite-focus";
import { setMatterTab, useShell, type MatterTab } from "@/components/shell-state";
import { Button } from "@/components/ui/Card";
import { CopilotGlyph } from "@/components/ui/LegalTags";
import { firstName, personName, timeLabel } from "@/components/ui/format";
import { CURRENT_USER } from "@/lib/company";
import type { PastReview } from "@/lib/learning";
import { currentApprover, matterCounts, matterView, pendingProposals, useAppState, type MatterView as View, type RedlineEdit } from "@/lib/store";

export function MatterView({ history, onHumanEdit }: { history: PastReview[]; onHumanEdit: (edit: RedlineEdit) => void }) {
  const state = useAppState();
  const { tab } = useShell();
  const cite = useCiteFocus();
  const view = matterView(state, state.activeMatterId!);
  const counts = matterCounts(view);
  const pendingApprovals = Object.values(state.matters).filter((m) => m.submission?.status === "pending").length;
  const insights = pendingProposals(state, history);
  const tabs: { id: MatterTab; label: string; count: string | null }[] = [
    { id: "tasks", label: "Tasks", count: view.planApproved ? `${view.doneCount} of ${view.plan.length}` : String(view.plan.length) },
    { id: "review", label: "Review table", count: view.planApproved ? String(counts.toVendor) : null },
    { id: "contract", label: "Contract", count: null },
    { id: "approvals", label: "Approvals", count: pendingApprovals ? String(pendingApprovals) : null },
    { id: "insights", label: "Insights", count: insights ? String(insights) : null },
  ];

  return (
    <div className="mx-auto max-w-[1180px] pb-4" data-testid="matter-view">
      <MatterHeader view={view} />
      {tab === "tasks" && <Notification view={view} />}
      <div
        role="tablist"
        aria-label="Matter"
        className="mt-3 flex gap-1 overflow-x-auto"
        onKeyDown={(e) => {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          const index = tabs.findIndex((t) => t.id === tab);
          const next = tabs[(index + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length].id;
          setMatterTab(next);
          document.getElementById(`tab-${next}`)?.focus();
        }}
      >
        {tabs.map(({ id, label, count }) => (
          <button
            key={id}
            id={`tab-${id}`}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => setMatterTab(id)}
            className={`flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 font-medium transition-colors ${
              tab === id ? "bg-surface text-ink shadow-[0_0_0_1px_var(--color-hairline),inset_0_-2px_0_var(--color-ink)]" : "text-muted hover:bg-stone hover:text-ink"
            }`}
          >
            {label}
            {count && <span className="text-small font-normal tabular-nums text-muted">{count}</span>}
          </button>
        ))}
      </div>
      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="pt-3">
        {tab === "tasks" && <TasksTable view={view} />}
        {tab === "review" && <ReviewTable view={view} onHumanEdit={onHumanEdit} />}
        {tab === "contract" && <ContractViewer view={view} focus={cite?.matterId === view.matter.id ? cite : null} inMatter />}
        {tab === "approvals" && <ApprovalsPanel />}
        {tab === "insights" && <InsightsPanel history={history} inMatter />}
      </div>
    </div>
  );
}

/**
 * When work is ready for someone, the copilot says so, to them, by name, in one line on the Tasks tab
 * (the matter's inbox). A send-back carries the approver's words here; the other tabs say it once
 * in their own place (the status chip, the approver's route row).
 */
function Notification({ view }: { view: View }) {
  const sub = view.state?.submission;
  if (!sub) return null;
  const next = currentApprover(sub);
  const last = sub.decisions.at(-1);
  const maya = firstName(CURRENT_USER.id);
  let line: string;
  let quote: string | null = null;
  if (sub.status === "pending" && next) line = `${next.name.split(" ")[0]}, ${maya} needs your approval on the ${view.matter.vendorShort} review.`;
  else if (sub.status === "sent_back" && last) {
    line = `${maya}, ${personName(last.approverId)} sent the ${view.matter.vendorShort} review back.`;
    quote = last.comment || null;
  } else if (sub.status === "approved") line = `${maya}, every approver approved the ${view.matter.vendorShort} review. The redline package can go to ${view.matter.vendorTerm}.`;
  else return null;
  return (
    <aside aria-label="Notification" className="mt-3 flex items-start gap-3 rounded-md border border-hairline bg-surface px-4 py-2.5 shadow-raised" data-testid="notification">
      <CopilotGlyph size={20} />
      <div className="min-w-0 flex-1">
        <p className="text-ink">
          <span className="font-medium">{line}</span> <span className="text-small text-muted">· {timeLabel(sub.sentAt)}</span>
        </p>
        {quote && <blockquote className="mt-0.5 max-w-[80ch] text-ink">&ldquo;{quote}&rdquo;</blockquote>}
      </div>
      <Button size="sm" onClick={() => setMatterTab("approvals")}>
        Open approvals
        <ArrowRight aria-hidden className="size-3.5" />
      </Button>
    </aside>
  );
}
