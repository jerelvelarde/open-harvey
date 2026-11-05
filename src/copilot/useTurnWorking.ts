// Whether the copilot is still working on the turn. agent.isRunning is false for a moment between
// the run's follow-ups: while a frontend tool runs in the browser (a checklist task holds a short
// beat so a person can see it work), and while its result goes back to the model. A plan of 17 tasks
// is about 20 runs, so the chat would flicker between "Working" and "Worked for" and the chips would
// blink. This reads the turn instead: running, or a tool call still executing, or a result just in
// and its follow-up about to start. A gate card waiting for a click is not work: the turn waits for
// the person, so the chat folds and the chips stay hidden by the card itself.

import { UseAgentUpdate, useAgent } from "@copilotkit/react-core/v2";
import { useEffect, useRef, useState } from "react";
import { isBusy } from "./edit-queue";
import { useWaitingGate } from "./gate-state";

/** A tool result with nothing after it means CopilotKit is about to run a follow-up; wait this long for it. */
const FOLLOW_UP_GRACE_MS = 1500;

export function useTurnWorking(isRunning: boolean): boolean {
  const { agent } = useAgent({ updates: [UseAgentUpdate.OnMessagesChanged, UseAgentUpdate.OnRunStatusChanged] });
  const gate = useWaitingGate();
  const lastChange = useRef(0);
  const [, tick] = useState(0);
  const messages = agent.messages.length;

  useEffect(() => {
    lastChange.current = Date.now();
    // Look again once the grace is over, so a turn that ended on a tool result does not read as working forever.
    const timer = setTimeout(() => tick((n) => n + 1), FOLLOW_UP_GRACE_MS + 50);
    return () => clearTimeout(timer);
  }, [messages, isRunning]);

  if (isRunning) return true;
  if (gate) return false;
  return isBusy(agent, Date.now() - lastChange.current < FOLLOW_UP_GRACE_MS);
}
