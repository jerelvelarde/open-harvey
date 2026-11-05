// A button on the page that says something to the copilot, as if typed in the chat: the matter
// header's "Review with the copilot" sends the same sentence as the opening chip. It posts a user
// message and starts a run, the way useTellCopilot.ts does for a human edit, so the agent's answer
// lands in the chat like any other.

import { UseAgentUpdate, useAgent, useCopilotKit } from "@copilotkit/react-core/v2";
import { useCallback } from "react";

export function useAskCopilot() {
  const { agent } = useAgent({ updates: [UseAgentUpdate.OnRunStatusChanged] });
  const { copilotkit } = useCopilotKit();
  const ask = useCallback(
    async (text: string) => {
      if (agent.isRunning) return;
      agent.addMessage({ id: crypto.randomUUID(), role: "user", content: text });
      await copilotkit.runAgent({ agent }); // a failed run reaches the provider's onError (the chat's error banner)
    },
    [agent, copilotkit],
  );
  return { ask, busy: agent.isRunning };
}
