// Concept: human in the loop, before anything leaves. The agent can ask to send; only a person's
// click sends.
//
// useHumanInTheLoop registers a tool whose result is the user's choice. While the card waits it gets
// a respond() function, and Send for approval or Keep editing calls it once, through lib/gates.ts
// answerSend (the same function the tests call; it refuses while an accepted deviation has no
// reason). The card shows who it goes to and why (PB-APR-01/02/03) and the reasons Maya gave.
// Sending for approval sends nothing to the vendor: the approvers approve Northstar's position first.
// Afterwards it collapses to a one-line receipt rendered from the tool's result.

import { ToolCallStatus, useHumanInTheLoop, type ReactHumanInTheLoop } from "@copilotkit/react-core/v2";
import { CircleCheck, CornerUpLeft } from "lucide-react";
import { useEffect, type ComponentProps } from "react";
import { z } from "zod";
import { Button, Card, Tag } from "@/components/ui/Card";
import { RouteList } from "@/components/ui/RouteList";
import { plural, usd } from "@/components/ui/format";
import { uiToolSchemas } from "@/lib/agent-tools";
import { answerSend, type SendAnswer } from "@/lib/gates";
import { isMatterId } from "@/lib/matters";
import { matterCounts, matterView, useAppState } from "@/lib/store";
import { gateClosed, gateOpened } from "./gate-state";
import { CardSkeleton } from "./useGenerativeUI";

type Args = z.infer<typeof uiToolSchemas.requestApproval>;
type Props = ComponentProps<ReactHumanInTheLoop<Args>["render"]>;

export const joinNames = (names: string[]) => (names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

export function useRequestApproval() {
  useHumanInTheLoop<Args>(
    {
      name: "requestApproval",
      description:
        "Ask the user to send the review for approval. Shows the route (who approves, in order, and why), the redlines and the reasons, with Send for approval and Keep editing buttons. Nothing is sent unless the user clicks Send for approval. Call it only when the user asks to send.",
      parameters: uiToolSchemas.requestApproval,
      render: SendCard,
    },
    [],
  );
}

function SendCard(props: Props) {
  const state = useAppState();
  const matterId = isMatterId(props.args.matterId) ? props.args.matterId : null;
  const waiting = props.status === ToolCallStatus.Executing && matterId ? matterId : null;
  useEffect(() => {
    if (!waiting) return;
    gateOpened({ kind: "send", matterId: waiting });
    return () => gateClosed({ kind: "send", matterId: waiting });
  }, [waiting]);

  if (props.status === ToolCallStatus.Complete) return <Receipt result={props.result} />;
  if (props.status === ToolCallStatus.InProgress || !matterId) return <CardSkeleton title="Send for approval?" lines={4} />;

  const { respond } = props;
  const view = matterView(state, matterId);
  const route = view.review.route;
  const counts = matterCounts(view);
  const answer = (click: "send" | "keep editing") => void respond(answerSend(matterId, click) satisfies SendAnswer);
  const ready = view.status === "ready";
  const alreadySent = Boolean(view.state?.submission);
  const vendor = view.matter.vendorTerm;

  return (
    <Card
      className="my-2"
      testId="send-card"
      title={`Send the ${vendor} review to ${joinNames(route.map((s) => s.name))} for approval?`}
      meta={`${plural(counts.toVendor, counts.learned ? "item" : "redline")} · ${usd(view.review.totalValue)} · nothing goes to ${vendor} until every approver has approved`}
      aside={ready ? undefined : <Tag tone="plum">{alreadySent ? "Sent" : `${view.missingReasons.length} to explain`}</Tag>}
    >
      <h4 className="section-label mb-1 border-b border-hairline pb-1">Goes to, in order</h4>
      <RouteList steps={route} compact />
      {view.accepted.length > 0 && (
        <>
          <h4 className="section-label mb-1 mt-3 border-b border-hairline pb-1">Your reason for {route[0]?.name ?? "the General Counsel"}</h4>
          <ul className="space-y-1.5">
            {view.accepted.map((f) => (
              <li key={f.ruleId} className="text-small">
                <span className="font-mono text-muted">
                  {f.cite} {f.ruleId}
                </span>{" "}
                <span className="text-ink">{view.state?.reasons[f.ruleId!] ? <>&ldquo;{view.state.reasons[f.ruleId!]}&rdquo;</> : "No reason yet"}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="mt-3.5 flex gap-2">
        <Button variant="primary" disabled={!ready} onClick={() => answer("send")}>
          Send for approval
        </Button>
        <Button onClick={() => answer("keep editing")}>Keep editing</Button>
      </div>
    </Card>
  );
}

/** After the decision, the card collapses to one line. */
function Receipt({ result }: { result: string }) {
  let outcome: SendAnswer | null = null;
  try {
    outcome = JSON.parse(result) as SendAnswer;
  } catch {
    // Not JSON: show it as text below.
  }
  if (outcome?.sent) {
    const names = outcome.to.map((a) => a.replace(/\s*\(.*\)$/, ""));
    return (
      <p data-testid="send-receipt" className="my-2 flex items-start gap-2 rounded-md border border-hairline bg-surface px-3 py-2 text-small text-ink">
        <CircleCheck aria-hidden className="mt-px size-3.5 shrink-0" strokeWidth={2.25} />
        <span>Sent for approval to {joinNames(names)}</span>
      </p>
    );
  }
  return (
    <p data-testid="send-receipt" className="my-2 flex items-start gap-2 rounded-md border border-hairline bg-surface px-3 py-2 text-small text-muted">
      <CornerUpLeft aria-hidden className="mt-px size-3.5 shrink-0" strokeWidth={2.25} />
      <span>{outcome && !outcome.sent && /keep editing/i.test(outcome.reason) ? "Kept editing · nothing was sent" : `Not sent · ${outcome && !outcome.sent ? outcome.reason : result}`}</span>
    </p>
  );
}
