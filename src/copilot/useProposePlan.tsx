// Concept: human in the loop, before anything runs. The agent proposes the plan; only a person's
// click approves it.
//
// useHumanInTheLoop registers a tool whose result is the user's choice. While the card waits (status
// "executing") it gets a respond() function, and Approve plan or Not yet calls it once, through
// lib/gates.ts answerPlan (the same function the tests call). The plan on the card is built in code
// (lib/plan.ts buildPlan) from the playbook and any published rule, so the card never shows a task
// the app would not run. Afterwards it collapses to a one-line receipt rendered from the tool's
// result. While it waits it tells the page (gate-state.ts), so the rail's Plan says so and the matter
// header's button steps back: one primary action on screen at a time. The card is the one place the
// steps are read before the click; the rail shows only that the plan waits.

import { ToolCallStatus, useHumanInTheLoop, type ReactHumanInTheLoop } from "@copilotkit/react-core/v2";
import { CircleCheck, CornerUpLeft } from "lucide-react";
import { useEffect, type ComponentProps } from "react";
import { z } from "zod";
import { Button, Card } from "@/components/ui/Card";
import { LearnedTag } from "@/components/ui/LegalTags";
import { uiToolSchemas } from "@/lib/agent-tools";
import { answerPlan, type PlanAnswer } from "@/lib/gates";
import { isMatterId, matterTitle } from "@/lib/matters";
import { matterView, useAppState } from "@/lib/store";
import { gateClosed, gateOpened } from "./gate-state";
import { CardSkeleton } from "./useGenerativeUI";

type Args = z.infer<typeof uiToolSchemas.proposePlan>;
type Props = ComponentProps<ReactHumanInTheLoop<Args>["render"]>;

export function useProposePlan() {
  useHumanInTheLoop<Args>(
    {
      name: "proposePlan",
      description:
        "Propose the review plan for a matter: the checklist of tasks the app builds from the playbook (and any published rule). The user sees it with Approve plan and Not yet buttons. Nothing runs until they click Approve plan; the result lists the approved taskIds in order.",
      parameters: uiToolSchemas.proposePlan,
      render: PlanCard,
    },
    [],
  );
}

function PlanCard(props: Props) {
  const state = useAppState();
  const matterId = isMatterId(props.args.matterId) ? props.args.matterId : null;
  const waiting = props.status === ToolCallStatus.Executing && matterId ? matterId : null;
  useEffect(() => {
    if (!waiting) return;
    gateOpened({ kind: "plan", matterId: waiting });
    return () => gateClosed({ kind: "plan", matterId: waiting });
  }, [waiting]);

  if (props.status === ToolCallStatus.Complete) return <Receipt result={props.result} />;
  if (props.status === ToolCallStatus.InProgress || !matterId) return <CardSkeleton title="Review plan" lines={6} />;

  const { respond } = props;
  const view = matterView(state, matterId);
  const answer = (click: "approve" | "not yet") => void respond(answerPlan(matterId, click) satisfies PlanAnswer);

  return (
    <Card className="my-2" testId="plan-card" title="Review plan" meta={`${matterTitle(view.matter)} · ${view.plan.length} tasks · nothing runs until you approve it`}>
      <ol className="divide-y divide-hairline">
        {view.plan.map((task) => (
          <li key={task.id} className={`grid grid-cols-[22px_minmax(0,1fr)_auto] items-baseline gap-x-2 py-[5px] ${task.learned ? "bg-paper" : ""}`}>
            <span className="font-mono text-small text-muted">{task.number}</span>
            <span className="min-w-0 text-small text-ink">
              {task.title}
              {task.learned && <LearnedTag id={task.learned.id} version={task.learned.version} className="ml-1.5 align-[1px]" />}
            </span>
            <span className="font-mono text-small text-muted">{task.ruleIds.length === 3 ? "PB-APR-01–03" : task.ruleIds[0] ?? ""}</span>
          </li>
        ))}
      </ol>
      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <Button variant="primary" disabled={view.planApproved} onClick={() => answer("approve")}>
          Approve plan
        </Button>
        <Button onClick={() => answer("not yet")}>Not yet</Button>
      </div>
    </Card>
  );
}

/** After the decision, the card collapses to one line. */
function Receipt({ result }: { result: string }) {
  let outcome: PlanAnswer | null = null;
  try {
    outcome = JSON.parse(result) as PlanAnswer;
  } catch {
    // Not JSON: show it as text below.
  }
  if (outcome?.approved) {
    return (
      <p data-testid="plan-receipt" className="my-2 flex items-start gap-2 rounded-md border border-hairline bg-surface px-3 py-2 text-small text-ink">
        <CircleCheck aria-hidden className="mt-px size-3.5 shrink-0" strokeWidth={2.25} />
        <span>Plan approved · {outcome.tasks.length} tasks</span>
      </p>
    );
  }
  return (
    <p data-testid="plan-receipt" className="my-2 flex items-start gap-2 rounded-md border border-hairline bg-surface px-3 py-2 text-small text-muted">
      <CornerUpLeft aria-hidden className="mt-px size-3.5 shrink-0" strokeWidth={2.25} />
      <span>{outcome ? "Not yet · nothing ran" : result}</span>
    </p>
  );
}
