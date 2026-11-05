// The playbook the copilot works from: every written rule, as the server read it from
// src/data/playbook.md, and the rules a person published from approvers' send-backs (Insights).
// Read-only: the playbook changes when a person publishes a rule, never when the copilot decides.

"use client";

import { BookMarked } from "lucide-react";
import { Tag } from "@/components/ui/Card";
import { dateLabel, personName } from "@/components/ui/format";
import { getLibrary } from "@/lib/library";
import { useAppState } from "@/lib/store";

export function PlaybookPanel() {
  const { playbook } = getLibrary();
  const { publishedRules } = useAppState();
  const rules = Object.values(playbook);
  return (
    <article aria-label="Playbook" className="rounded-md border border-hairline bg-surface" data-testid="playbook">
      <header className="border-b border-hairline px-5 py-4 @3xl:px-6">
        <h2 className="font-serif text-body font-semibold text-ink">Vendor contract playbook</h2>
        <p className="mt-0.5 text-muted">
          {rules.length} written rules{publishedRules.length ? ` · ${publishedRules.length} learned from send-backs` : ""}. The copilot checks every vendor contract against these.
        </p>
      </header>
      {publishedRules.length > 0 && (
        <section aria-label="Learned rules" className="border-b border-hairline bg-paper px-5 py-3 @3xl:px-6">
          <h2 className="section-label mb-1">Learned rules</h2>
          <ul className="divide-y divide-hairline">
            {publishedRules.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
                <BookMarked aria-hidden className="size-3.5 self-center text-muted" strokeWidth={2} />
                <span className="font-mono text-small text-ink">{`${r.id} v${r.version}`}</span>
                <span className="font-medium text-ink">{r.title}</span>
                <span className="text-small text-muted">published {dateLabel(r.publishedAt)} by {personName(r.publishedBy)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <ul className="divide-y divide-hairline px-5 @3xl:px-6">
        {rules.map((rule) => (
          <li key={rule.id} className="grid gap-x-4 gap-y-0.5 py-3 @3xl:grid-cols-[120px_minmax(0,1fr)]">
            <span className="font-mono text-small text-muted">{rule.id}</span>
            <p className="min-w-0">
              <span className="font-medium text-ink">{rule.title}.</span> <span className="text-ink">{rule.text}</span>
              {rule.id.startsWith("PB-APR") && (
                <Tag tone="outline" className="ml-2 align-middle">
                  routing
                </Tag>
              )}
            </p>
          </li>
        ))}
      </ul>
    </article>
  );
}
