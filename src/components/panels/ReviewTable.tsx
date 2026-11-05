// Concept: one shared artifact, two writers. The review table fills as the plan runs: a row per
// finding, with what the vendor wrote (in its own words, in full), the playbook's position, the
// proposed redline, the risk and a cite chip (which carries the passage id). The copilot drafts every redline; Maya can rewrite any of them here. Her edit is shared
// state: the store keeps it (the copilot can never overwrite it), the row re-checks it against the
// rule at once, and the edit is posted to the copilot (copilot/useTellCopilot.ts), which re-checks
// it too and asks for a reason when a deviation stays.

"use client";

import { useRef, useState } from "react";
import { Tag } from "@/components/ui/Card";
import { CiteChip, LearnedTag, ResultTag } from "@/components/ui/LegalTags";
import { plural } from "@/components/ui/format";
import { byRisk, recheckRedline, type Finding } from "@/lib/review";
import { humanRedline, matterCounts, type MatterView, type RedlineEdit } from "@/lib/store";

type Group = { id: string; label: string; rows: Finding[] };

export function ReviewTable({ view, onHumanEdit }: { view: MatterView; onHumanEdit: (edit: RedlineEdit) => void }) {
  const { found, matter } = view;
  const counts = matterCounts(view);
  const devs = found.filter((f) => f.status === "deviation").sort(byRisk);
  const groups: Group[] = [
    { id: "deviations", label: "Deviations", rows: devs },
    { id: "requests", label: "Learned requests", rows: found.filter((f) => f.ruleId && f.status === "request") },
    { id: "passes", label: "Passes the playbook", rows: found.filter((f) => f.ruleId && f.status === "pass") },
    { id: "context", label: "Context, no rule", rows: found.filter((f) => !f.ruleId) },
  ].filter((g) => g.rows.length > 0);
  // Only a row that arrives while the table is on screen settles in; switching tabs never replays it.
  const atMount = useRef(new Set(found.map((f) => f.ruleId ?? f.topic)));
  const learnedRules = view.state?.planRules.length ?? 0;

  return (
    <section aria-label="Review table" className="rounded-md border border-hairline bg-surface" data-testid="review-table">
      <header className="border-b border-hairline px-5 py-3 @3xl:px-6">
        <h2 className="font-semibold text-ink">Review table</h2>
        <p className="mt-0.5 text-small text-muted" data-testid="review-meta">
          Vendor playbook 2026{learnedRules ? ` and ${plural(learnedRules, "learned rule")}` : ""} · {counts.checked} of {counts.checks} {counts.checks === 1 ? "rule" : "rules"} checked
        </p>
      </header>

      {found.length === 0 ? (
        <p className="px-5 py-8 text-muted @3xl:px-6">Nothing reviewed yet. Approve the plan in the copilot and this table fills as it runs.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] table-fixed border-collapse text-left">
            <colgroup>
              <col className="w-[148px]" />
              <col className="w-[196px]" />
              <col className="w-[150px]" />
              <col />
              <col className="w-[84px]" />
              <col className="w-[80px]" />
            </colgroup>
            <thead>
              <tr className="border-b border-hairline text-small text-muted">
                <th scope="col" className="py-2 pl-5 pr-2 font-medium @3xl:pl-6">
                  Topic
                </th>
                <th scope="col" className="px-2 py-2 font-medium">
                  What {matter.vendorTerm} wrote
                </th>
                <th scope="col" className="px-2 py-2 font-medium">
                  Playbook position
                </th>
                <th scope="col" className="px-2 py-2 font-medium">
                  Proposed redline
                </th>
                <th scope="col" className="px-2 py-2 font-medium">
                  Risk
                </th>
                <th scope="col" className="py-2 pl-2 pr-5 font-medium @3xl:pr-6">
                  Cite
                </th>
              </tr>
            </thead>
            {groups.map((group) => (
              <tbody key={group.id} data-group={group.id}>
                <tr className="border-b border-hairline bg-paper">
                  <th colSpan={6} scope="rowgroup" className="py-1.5 pl-5 pr-5 text-left @3xl:pl-6">
                    <span className="section-label">{group.label}</span>
                    <span className="ml-2 text-small tabular-nums text-muted">{group.rows.length}</span>
                  </th>
                </tr>
                {group.rows.map((f) => (
                  <FindingRow key={f.ruleId ?? f.topic} finding={f} view={view} onHumanEdit={onHumanEdit} settle={!atMount.current.has(f.ruleId ?? f.topic)} />
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </section>
  );
}

function FindingRow({ finding: f, view, onHumanEdit, settle }: { finding: Finding; view: MatterView; onHumanEdit: (edit: RedlineEdit) => void; settle: boolean }) {
  return (
    <tr className={`${settle ? "row-settle" : ""} border-b border-hairline align-top last:border-b-0`} data-rule={f.ruleId ?? ""} data-testid="finding-row">
      <td className="py-3 pl-5 pr-2 @3xl:pl-6">
        <p className="font-medium text-ink">{f.topic}</p>
        {f.ruleId && <p className="font-mono text-small text-muted">{f.ruleId}</p>}
        {f.learned && <LearnedTag id={f.learned.id} version={f.learned.version} className="mt-1" />}
      </td>
      <td className="px-2 py-3">
        <p className="text-ink">{f.vendorWrote}</p>
        <p className="mt-1 text-quote text-ink" data-testid="vendor-quote">
          &ldquo;{f.quote}&rdquo;
        </p>
      </td>
      <td className="px-2 py-3 text-ink">{f.position}</td>
      <td className="px-2 py-3">
        <RedlineCell finding={f} view={view} onHumanEdit={onHumanEdit} />
      </td>
      <td className="px-2 py-3">
        <ResultTag status={f.status} risk={f.risk} />
      </td>
      <td className="py-3 pl-2 pr-5 @3xl:pr-6">
        <CiteChip matterId={view.matter.id} cite={f.cite} quote={f.quote} label={f.ruleId ?? f.topic} />
      </td>
    </tr>
  );
}

function RedlineCell({ finding: f, view, onHumanEdit }: { finding: Finding; view: MatterView; onHumanEdit: (edit: RedlineEdit) => void }) {
  const ruleId = f.ruleId;
  const text = ruleId ? view.redlines[ruleId] : undefined;
  if (f.status === "pass" || f.status === "info") return <p className="text-muted">No change</p>;
  if (text === undefined || !ruleId) return <p className="text-muted">Drafted once every check has run</p>;
  return <RedlineEditor key={`${ruleId}:${text}`} ruleId={ruleId} text={text} finding={f} view={view} onHumanEdit={onHumanEdit} />;
}

function RedlineEditor({ ruleId, text, finding, view, onHumanEdit }: { ruleId: string; text: string; finding: Finding; view: MatterView; onHumanEdit: (edit: RedlineEdit) => void }) {
  const [draft, setDraft] = useState(text);
  const by = view.redlinesBy[ruleId];
  const check = finding.status === "request" ? null : recheckRedline(ruleId, text);
  const reason = view.state?.reasons[ruleId];
  const gc = view.review.route.find((s) => s.ruleId === "PB-APR-01");
  const editable = !view.state?.submission;

  const commit = () => {
    if (draft.trim() === text) return setDraft(text);
    const edit = humanRedline(view.matter.id, ruleId, draft);
    if (edit) onHumanEdit(edit);
  };

  return (
    <div>
      <label className="sr-only" htmlFor={`redline-${ruleId}`}>
        {finding.status === "request" ? "Request to the vendor" : "Proposed redline"} for {finding.cite} ({ruleId})
      </label>
      <textarea
        id={`redline-${ruleId}`}
        data-testid={`redline-${ruleId}`}
        value={draft}
        readOnly={!editable}
        rows={2}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            commit();
            e.currentTarget.blur();
          }
          if (e.key === "Escape") setDraft(text);
        }}
        className="block w-full resize-none rounded-[5px] border border-rule bg-surface px-2.5 py-1.5 text-body text-ink outline-none transition-[border-color,box-shadow] duration-150 [field-sizing:content] hover:border-muted/50 focus:border-muted focus:shadow-[0_0_0_3px_rgb(22_20_15/0.06)] read-only:border-hairline read-only:bg-paper"
      />
      <p className="mt-1 flex flex-wrap items-center gap-1.5">
        <Tag tone="outline">{by === "human" ? "edited by you" : "copilot · drafted"}</Tag>
        {check && !check.meets && <Tag tone="red">Still deviates</Tag>}
        {check && check.meets && by === "human" && <Tag tone="green">Meets {ruleId}</Tag>}
      </p>
      {check && !check.meets && reason && (
        <p className="mt-1 text-small text-muted" data-testid={`reason-${ruleId}`}>
          Reason for {gc?.name ?? "the General Counsel"}: <span className="text-ink">&ldquo;{reason}&rdquo;</span>
        </p>
      )}
    </div>
  );
}
