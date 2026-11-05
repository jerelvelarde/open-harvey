// Concept: governance you can read. How reviews are going before and since Open Harvey went live,
// why reviews come back, and the decision log: every action that waited for a person, with who and
// when. Every figure is lib/analytics.ts, from the imported history and this session's store; the
// page draws them and computes nothing. Black and white: the one chart uses solid ink for before
// go-live and an outline for since.

"use client";

import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { dateLabel, plural, shortDate, timeLabel } from "@/components/ui/format";
import { analytics, rateFigure } from "@/lib/analytics";
import type { PastReview } from "@/lib/learning";
import { useAppState } from "@/lib/store";

const dayName = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });

export function AnalyticsPanel({ history }: { history: PastReview[] }) {
  const state = useAppState();
  const a = analytics(state, history);
  const { before, since } = a;
  const decided = since.firstPass + since.sentBack;

  return (
    <div className="space-y-5" data-testid="analytics">
      <div className="grid gap-5 @4xl:grid-cols-2">
        <Sheet title="Before go-live" meta={`The ${before.reviews} reviews imported on ${dateLabel(a.goLive)}`} testId="before-go-live">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
            <Figure label="Reviews" value={String(before.reviews)} />
            <Figure label="Approved first time" value={rateFigure(before.firstPass, before.reviews)} sub={`${before.firstPass} of ${before.reviews}; ${before.sentBack} sent back`} />
            <Figure label="Median cycle" value={before.medianCycleDays === null ? "—" : `${before.medianCycleDays}`} unit="days" sub="First submission to signature" />
            <Figure label="Days lost to send-backs" value={String(before.daysLost)} unit="days" sub="Send-back to resubmission" />
          </dl>
        </Sheet>
        <Sheet title="Since go-live" meta={`Since ${dayName(a.goLive)}, ${shortDate(a.goLive)}`} testId="since-go-live">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
            <Figure label="Reviews" value={String(since.reviews)} />
            <Figure label="Approved first time" value={rateFigure(since.firstPass, decided)} sub={decided ? `${since.sentBack} sent back` : "Nothing decided yet"} />
          </dl>
          <dl className="mt-5 grid grid-cols-3 gap-x-3 gap-y-3 border-t border-hairline pt-4 @xl:grid-cols-5" data-testid="since-counts">
            <Count label="Tasks run" value={since.tasksRun} />
            <Count label="Redlines" value={since.redlinesDrafted} />
            <Count label="Human edits" value={since.humanEdits} />
            <Count label="Sent to approve" value={since.approvalsRequested} />
            <Count label="Rules learned" value={since.rulesPublished} />
          </dl>
        </Sheet>
      </div>

      <div className="grid gap-5 @4xl:grid-cols-2">
        <Sheet title="Why reviews come back" meta="Send-backs grouped by reason: the signal Playbooks learns from" testId="send-back-reasons">
          <Reasons rows={a.reasons} />
        </Sheet>
        <Sheet title="Suggested next steps" meta="Worked out from where each matter stands" testId="next-steps">
          {a.next.length === 0 ? (
            <p className="text-muted">Nothing waiting.</p>
          ) : (
            <ol className="space-y-2">
              {a.next.map((step, i) => (
                <li key={step} className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-2">
                  <span className="font-mono text-small text-muted">{i + 1}</span>
                  <span className="text-ink">{step}</span>
                </li>
              ))}
            </ol>
          )}
        </Sheet>
      </div>

      <Sheet title="Decision log" meta="Every action that waited for a person. The copilot proposes; people decide." testId="decision-log">
        {a.log.length === 0 ? (
          <p className="text-muted">No decisions yet. The first is Maya approving a review plan.</p>
        ) : (
          <table className="w-full table-fixed border-collapse text-left">
            <colgroup>
              <col className="w-[44px]" />
              <col className="w-[240px]" />
              <col />
              <col className="w-[260px]" />
              <col className="w-[176px]" />
            </colgroup>
            <thead>
              <tr className="border-b border-hairline text-small text-muted">
                <th className="py-2 font-medium">#</th>
                <th className="py-2 font-medium">Who</th>
                <th className="py-2 font-medium">Decision</th>
                <th className="py-2 font-medium">Matter</th>
                <th className="py-2 text-right font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {a.log.map((e, i) => (
                <tr key={i} className="border-b border-hairline align-top last:border-b-0" data-testid="log-entry">
                  <td className="py-2.5 font-mono text-small text-muted">{i + 1}</td>
                  <td className="py-2.5">
                    <span className="flex items-center gap-2">
                      <Avatar name={e.who} size={24} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink">{e.who}</span>
                        <span className="block truncate text-small text-muted">{e.role}</span>
                      </span>
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-ink">{e.action}</td>
                  <td className="py-2.5 pr-4 text-muted">{e.matter ?? "the playbook"}</td>
                  <td className="whitespace-nowrap py-2.5 text-right text-small text-muted">
                    {dateLabel(e.at)} · {timeLabel(e.at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Sheet>
    </div>
  );
}

function Sheet({ title, meta, testId, children }: { title: string; meta: string; testId: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-hairline bg-surface px-5 py-4 @3xl:px-6" data-testid={testId}>
      <header className="mb-4">
        <h2 className="font-semibold text-ink">{title}</h2>
        <p className="text-small text-muted">{meta}</p>
      </header>
      {children}
    </section>
  );
}

/** A big serif numeral with its label above and its basis below. */
function Figure({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-small text-muted">{label}</dt>
      <dd className="mt-1 font-serif text-figure tabular-nums text-ink" data-testid="figure">
        {value}
        {unit && (
          <>
            {" "}
            <span className="font-sans text-body text-muted">{unit}</span>
          </>
        )}
      </dd>
      {sub && <dd className="mt-0.5 text-small text-muted">{sub}</dd>}
    </div>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <dt className="truncate whitespace-nowrap text-small text-muted">{label}</dt>
      <dd className="mt-0.5 font-serif text-title tabular-nums text-ink">{value}</dd>
    </div>
  );
}

/** One row per reason: a solid ink bar for before go-live, an outlined bar for since. */
function Reasons({ rows }: { rows: { key: string; label: string; before: number; since: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.before + r.since));
  return (
    <div>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.key} data-testid="reason-row" data-reason={r.key}>
            <p className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 text-ink">{r.label}</span>
              <span className="shrink-0 text-small text-muted tabular-nums">
                {r.before} before{r.since ? ` · ${r.since} since` : ""}
              </span>
            </p>
            <div className="mt-1 flex h-3 gap-0.5" aria-hidden>
              <span className="rounded-[2px] bg-ink" style={{ width: `${(r.before / max) * 100}%` }} />
              {r.since > 0 && <span className="rounded-[2px] border border-ink bg-surface" style={{ width: `${(r.since / max) * 100}%` }} />}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 flex items-center gap-4 text-small text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-4 rounded-[2px] bg-ink" />
          before go-live
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-4 rounded-[2px] border border-ink bg-surface" />
          since go-live
        </span>
        <span>{plural(rows.reduce((n, r) => n + r.before + r.since, 0), "send-back")} in all</span>
      </p>
    </div>
  );
}
