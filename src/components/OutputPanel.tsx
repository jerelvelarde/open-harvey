// An output, opened beside the thread: the review table (editable, shared with the copilot, with the
// redlines in its own column), the contract as a live document (tracked changes and comments, opened
// on a cited passage), or the approvals route. Named and
// ordered as the matter's tabs. The rail's Work section opens these, and so does every cite chip.

"use client";

import { X } from "lucide-react";
import { useCiteFocus } from "@/components/cite-focus";
import { DocumentEditor } from "@/components/panels/DocumentEditor";
import { ReviewTable } from "@/components/panels/ReviewTable";
import { closeOutput, openOutput, type Output } from "@/components/shell-state";
import { RouteList } from "@/components/ui/RouteList";
import type { SignerState } from "@/components/ui/seal-state";
import type { MatterView, RedlineEdit } from "@/lib/store";

const OUTPUTS: { id: Output; label: string }[] = [
  { id: "review", label: "Review table" },
  { id: "contract", label: "Contract" },
  { id: "route", label: "Approvals" },
];

export function OutputPanel({ view, output, onHumanEdit }: { view: MatterView; output: Output; onHumanEdit: (edit: RedlineEdit) => void }) {
  const cite = useCiteFocus();
  return (
    <section aria-label="Work item" className="@container flex min-h-0 min-w-0 flex-1 flex-col bg-paper" data-testid="output-panel">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-hairline bg-paper px-4">
        <div role="tablist" aria-label="Work" className="flex min-w-0 gap-1 overflow-x-auto">
          {OUTPUTS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={output === id}
              onClick={() => openOutput(id)}
              className={`h-8 shrink-0 rounded-md px-3 font-medium transition-colors ${output === id ? "bg-surface text-ink shadow-[0_0_0_1px_var(--color-hairline),inset_0_-2px_0_var(--color-ink)]" : "text-muted hover:bg-stone hover:text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" onClick={closeOutput} aria-label="Close the output" title="Close" className="ml-auto inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-stone hover:text-ink" data-testid="close-output">
          <X aria-hidden className="size-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4" data-testid="output-scroll">
        <div className="h-4" aria-hidden />
        {output === "review" && <ReviewTable view={view} onHumanEdit={onHumanEdit} />}
        {output === "contract" && <DocumentEditor view={view} focus={cite?.matterId === view.matter.id ? cite : null} onHumanEdit={onHumanEdit} />}
        {output === "route" && <RouteOutput view={view} />}
      </div>
    </section>
  );
}

function Sheet({ title, meta, children }: { title: string; meta: string; children: React.ReactNode }) {
  return (
    <article className="rounded-md border border-hairline bg-surface">
      <header className="border-b border-hairline px-5 py-3.5 @3xl:px-6">
        <h2 className="font-semibold text-ink">{title}</h2>
        <p className="mt-0.5 text-small text-muted">{meta}</p>
      </header>
      <div className="px-5 py-4 @3xl:px-6">{children}</div>
    </article>
  );
}

function RouteOutput({ view }: { view: MatterView }) {
  const sub = view.state?.submission;
  const route = sub?.route ?? view.review.route;
  const states: SignerState[] = route.map((_, i) => sub?.decisions[i]?.decision ?? "pending");
  return (
    <Sheet title="Approvals" meta={`Worked out from PB-APR-01–03 · nothing goes to ${view.matter.vendorTerm} until every approver has approved`}>
      <RouteList steps={route} states={sub ? states : undefined} waitingIndex={sub?.status === "pending" ? sub.decisions.length : undefined} comments={route.map((_, i) => sub?.decisions[i]?.comment || null)} times={route.map((_, i) => sub?.decisions[i]?.at ?? null)} />
    </Sheet>
  );
}
