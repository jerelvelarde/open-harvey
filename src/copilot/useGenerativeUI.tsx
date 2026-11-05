// Concept: generative UI. React components the agent renders in the chat by calling them like tools.
//
// useComponent registers a component as a frontend tool: the agent chooses the arguments, the
// component renders them, and there is no backend tool in between. Three cards:
//
// - showFindings: the deviations, highest risk first, by topic and risk, and how many rules pass. A
//   live view of the store: it reads the matter, never the model's words.
// - showRedlines: each redline as a blackline, the vendor's own sentence with the changed words struck
//   through and Northstar's inserted. Live too, so Maya's edit shows here as well.
// - showRecheck: the answer to a human edit. Its arguments are the matter, the rule and the redline
//   as it was; the card re-checks the redline now with lib/review.ts and shows what the rule asks,
//   what her redline says and the route. Computed, not written.
// Beside an open output (the Review table), the first two fold to one line: the table has the detail.
//
// They render from their arguments and app state only, never from the tool call's status, so they
// look the same when the chat re-mounts them. While arguments stream, they show a skeleton with the
// card's own footprint.

import { useComponent } from "@copilotkit/react-core/v2";
import type { z } from "zod";
import type { ReactNode } from "react";
import { Card, Tag } from "@/components/ui/Card";
import { Blackline } from "@/components/ui/Blackline";
import { ResultTag } from "@/components/ui/LegalTags";
import { plural } from "@/components/ui/format";
import { editSummary } from "@/copilot/edit-queue";
import { openOutput, useShell } from "@/components/shell-state";
import { uiToolSchemas } from "@/lib/agent-tools";
import { isMatterId } from "@/lib/matters";
import { WANTS } from "@/lib/plan";
import { byRisk, recheckRedline } from "@/lib/review";
import { matterCounts, matterView, useAppState } from "@/lib/store";

export function useGenerativeUI() {
  useComponent(
    {
      name: "showFindings",
      description: "The findings card for a matter: every deviation with its risk, rule and cited passage, and every pass with its citation. Call it when the plan has run.",
      parameters: uiToolSchemas.showFindings,
      render: FindingsCard,
    },
    [],
  );

  useComponent(
    {
      name: "showRedlines",
      description: "The redline diff card for a matter: for each deviation, what the vendor wrote struck through and Northstar's proposed redline inserted.",
      parameters: uiToolSchemas.showRedlines,
      render: RedlinesCard,
    },
    [],
  );

  useComponent(
    {
      name: "showRecheck",
      description:
        "The re-check card after the user edits a redline: the old and new wording, whether the rule still deviates, the route and who needs a reason. Pass the matter, the rule and the redline as it was before the edit; the card works out the rest.",
      parameters: uiToolSchemas.showRecheck,
      render: RecheckCard,
    },
    [],
  );
}

/** The card's footprint while its arguments stream in. */
export function CardSkeleton({ title, lines = 5 }: { title: string; lines?: number }) {
  return (
    <Card className="my-2" title={title} meta={<span className="inline-block h-3 w-40 rounded-sm bg-stone align-middle" />}>
      <div aria-busy="true" className="space-y-2.5 py-0.5">
        <span className="sr-only">Working it out…</span>
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="flex justify-between gap-6">
            <span className="h-3 rounded-sm bg-stone" style={{ width: `${46 - (i % 3) * 8}%` }} />
            <span className="h-3 w-16 rounded-sm bg-stone" />
          </div>
        ))}
      </div>
    </Card>
  );
}

function Gone({ title }: { title: string }) {
  return (
    <Card className="my-2" title={title}>
      <p className="text-muted">This matter is not in the app any more (the demo was reset).</p>
    </Card>
  );
}

/** Beside an open output the thread is narrow, and the output already shows the detail: a card folds to one line. */
function Folded({ testId, title, onOpen }: { testId: string; title: string; onOpen: () => void }) {
  return (
    <div className="my-2 flex items-center gap-3 rounded-md border border-hairline bg-surface px-3.5 py-2.5" data-testid={testId} data-compact="true">
      <span className="min-w-0 flex-1 font-semibold text-ink">{title}</span>
      <button type="button" onClick={onOpen} className="shrink-0 text-small font-medium text-ink underline underline-offset-[3px] hover:text-muted">
        Open in Review table
      </button>
    </div>
  );
}

function FindingsCard(props: Partial<z.infer<typeof uiToolSchemas.showFindings>>) {
  const state = useAppState();
  const { output } = useShell();
  if (!props.matterId) return <CardSkeleton title="Findings" lines={7} />;
  if (!isMatterId(props.matterId) || !state.matters[props.matterId]) return <Gone title="Findings" />;
  const view = matterView(state, props.matterId);
  const devs = view.found.filter((f) => f.status === "deviation").sort(byRisk);
  const requests = view.found.filter((f) => f.status === "request");
  const counts = matterCounts(view);
  const title = plural(counts.deviations, "deviation");
  if (output) return <Folded testId="findings-card" title={title} onOpen={() => openOutput("review")} />;
  return (
    <Card className="my-2" testId="findings-card" title={title} aside={counts.high ? <Tag tone="red">{counts.high} high</Tag> : undefined}>
      <ul className="divide-y divide-hairline">
        {[...devs, ...requests].map((f) => (
          <li key={f.ruleId} className="flex items-baseline gap-2.5 py-1.5">
            <ResultTag status={f.status} risk={f.risk} />
            <span className="min-w-0 flex-1">{f.topic}</span>
          </li>
        ))}
      </ul>
      {counts.pass > 0 && (
        <button type="button" onClick={() => openOutput("review")} className="mt-1.5 w-full border-t border-hairline pt-2 text-left text-small text-muted hover:text-ink" data-testid="findings-passes">
          {counts.pass} pass, each cited in the Review table
        </button>
      )}
    </Card>
  );
}

function RedlinesCard(props: Partial<z.infer<typeof uiToolSchemas.showRedlines>>) {
  const state = useAppState();
  const { output } = useShell();
  if (!props.matterId) return <CardSkeleton title="Redlines" lines={7} />;
  if (!isMatterId(props.matterId) || !state.matters[props.matterId]) return <Gone title="Redlines" />;
  const view = matterView(state, props.matterId);
  const rows = [...view.found.filter((f) => f.status === "deviation").sort(byRisk), ...view.found.filter((f) => f.status === "request")];
  const counts = matterCounts(view);
  const title = `${plural(counts.deviations, "redline")}${counts.learned ? ` and ${plural(counts.learned, "learned request")}` : ""}`;
  if (output) return <Folded testId="redlines-card" title={title} onOpen={() => openOutput("review")} />;
  return (
    <Card className="my-2" testId="redlines-card" title={title}>
      <ol className="space-y-3">
        {rows.map((f) => {
          const text = view.redlines[f.ruleId!] ?? f.redline ?? "";
          const mine = view.redlinesBy[f.ruleId!] === "human";
          return (
            <li key={f.ruleId}>
              <p className="flex items-baseline gap-2">
                <span className="font-mono text-small text-muted">{f.cite}</span>
                <span className="font-medium text-ink">{f.topic}</span>
                {mine && (
                  <Tag tone="outline" className="ml-auto">
                    edited by you
                  </Tag>
                )}
              </p>
              {f.status === "request" ? <p className="mt-0.5 text-quote text-ink">{text}</p> : <Blackline before={f.clause} after={text} className="mt-0.5" />}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function Line({ label, children, rule }: { label: string; children: ReactNode; rule?: string }) {
  return (
    <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-x-3 py-[3px]">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 text-ink">
        {children}
        {rule && <span className="ml-1.5 font-mono text-small text-muted">{rule}</span>}
      </dd>
    </div>
  );
}

function RecheckCard(props: Partial<z.infer<typeof uiToolSchemas.showRecheck>>) {
  const state = useAppState();
  if (!props.matterId || !props.ruleId || props.before === undefined) return <CardSkeleton title="Re-checked after your edit" lines={3} />;
  if (!isMatterId(props.matterId) || !state.matters[props.matterId]) return <Gone title="Re-checked after your edit" />;
  const view = matterView(state, props.matterId);
  const { ruleId } = props;
  const finding = view.review.findings.find((f) => f.ruleId === ruleId);
  const now = view.redlines[ruleId];
  if (!finding || now === undefined) return <Gone title="Re-checked after your edit" />;
  const check = recheckRedline(ruleId, now);
  const span = editSummary(ruleId, props.before, now);
  return (
    <Card
      className="my-2"
      testId="recheck-card"
      title={
        <>
          Re-checked <span className="font-mono">{finding.cite}</span> after your edit
        </>
      }
      aside={check.meets ? <Tag tone="green">Meets {ruleId}</Tag> : <Tag tone="red">Still deviates</Tag>}
    >
      <dl>
        <Line label="Playbook" rule={ruleId}>
          {WANTS[ruleId] ?? finding.position}
        </Line>
        <Line label="Your redline">{span.after}</Line>
        <Line label="Route">
          {view.review.route.map((s) => s.name.split(" ")[0]).join(" → ")} <span className="text-muted">· unchanged</span>
        </Line>
      </dl>
    </Card>
  );
}
