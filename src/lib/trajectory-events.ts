// Concept: tell Automatic Learning what people decided. With CopilotKit Intelligence switched on
// (lib/intelligence.ts), the browser records a Trajectory, and clicks alone cannot say that Jordan sent
// a review back or why. So every gated decision the app already records becomes one developer event
// (copilotkit.emitTrajectoryEvent), built from the same entries as the Analytics decision log, so the
// names, people and wording match what the page shows. Maya's redline edits go with them, before and
// after. Pure: copilot/useDecisionEvents.ts sends the events; with Intelligence off nothing calls this.

import { decisionLog, type DecisionKind } from "./analytics";
import { CURRENT_USER } from "./company";
import { matterView, type AppState } from "./store";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** One developer event: `key` says it once per decision, `name` and `value` go to Intelligence. */
export type TrajectoryDecision = { key: string; name: string; value: { [key: string]: Json } };

const NAMES: Record<DecisionKind, string> = {
  plan_approved: "review.plan_approved",
  sent_for_approval: "review.sent_for_approval",
  approved: "review.approved",
  sent_back: "review.sent_back",
  rejected: "review.rejected",
  rule_published: "playbook.rule_published",
};

/** Every decision in the store, in the decision log's order, then each redline a person rewrote. */
export function trajectoryDecisions(state: AppState): TrajectoryDecision[] {
  const decisions = decisionLog(state).map((e): TrajectoryDecision => {
    const value: { [key: string]: Json } = { who: e.who, role: e.role, action: e.action, at: e.at };
    if (e.matterId) Object.assign(value, { matterId: e.matterId, matter: e.matter });
    if (e.to) value.to = e.to;
    // What Maya told the approvers about the deviations she accepted, in her words.
    if (e.kind === "sent_for_approval" && e.matterId) value.reasons = state.matters[e.matterId]?.submission?.reasons ?? {};
    if (e.comment !== undefined) value.comment = e.comment;
    if (e.ruleId) Object.assign(value, { ruleId: e.ruleId, version: e.version ?? null });
    return { key: e.key, name: NAMES[e.kind], value };
  });

  const edits = Object.entries(state.matters).flatMap(([id, m]) => {
    const view = matterView(state, id);
    return Object.entries(m.redlines)
      .filter(([, r]) => r.by === "human")
      .map(([ruleId, r]): TrajectoryDecision => {
        const finding = view.review.findings.find((f) => f.ruleId === ruleId);
        return {
          key: `${id}:redline:${ruleId}:${r.text}`,
          name: "redline.edited",
          value: { who: CURRENT_USER.name, matterId: id, matter: view.matter.vendorShort, ruleId, cite: finding?.cite ?? null, before: finding?.redline ?? null, after: r.text },
        };
      });
  });

  return [...decisions, ...edits];
}

/** The decisions not yet sent, given the keys already sent. */
export const newDecisions = (state: AppState, sent: ReadonlySet<string>) => trajectoryDecisions(state).filter((d) => !sent.has(d.key));
