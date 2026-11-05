// Concept: decisions as Trajectory events. With CopilotKit Intelligence switched on, the provider
// records a Trajectory of what Maya does on the page (the `learning` prop in LegalApp.tsx). Clicks
// cannot say that Jordan sent a review back, or why, so each gated decision the store records goes
// to the Trajectory as a developer event, built by lib/trajectory-events.ts from the same entries as
// the Analytics decision log:
//   copilotkit.emitTrajectoryEvent("review.sent_back", { who: "Jordan Blake", comment: "…", … })
// Decisions already in the store when the page opens (a reload) are not sent again. With
// Intelligence off this hook does nothing: no subscription, no events, no network.

import { useCopilotKit } from "@copilotkit/react-core/v2";
import { useEffect } from "react";
import { appStore } from "@/lib/store";
import { newDecisions, trajectoryDecisions } from "@/lib/trajectory-events";

export function useDecisionEvents(enabled: boolean) {
  const { copilotkit } = useCopilotKit();
  useEffect(() => {
    if (!enabled) return;
    const sent = new Set(trajectoryDecisions(appStore.getState()).map((d) => d.key));
    const unsubscribe = appStore.subscribe(() => {
      for (const decision of newDecisions(appStore.getState(), sent)) {
        sent.add(decision.key);
        copilotkit.emitTrajectoryEvent(decision.name, decision.value);
      }
    });
    return () => {
      unsubscribe();
    };
  }, [enabled, copilotkit]);
}
