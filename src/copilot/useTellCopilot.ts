// Concept: the agent notices what the human changed.
//
// When Maya commits a redline edit in the review table, we post it to the chat as a user message and
// start a run, so the agent re-checks it without being asked:
//   agent.addMessage({ id, role: "user", content: 'I changed the §8.2 redline (PB-LIAB-01) from "…" to "…".' })
//   copilotkit.runAgent({ agent })
// The message id starts with HUMAN_EDIT_ID_PREFIX, so the chat draws it as a quiet event row ("You
// changed the §8.2 redline · 12 months of fees → 6 months of fees") instead of a bubble the user never
// typed (copilot/ChatUserMessage.tsx).
// (Why not AG-UI shared state? See the README: BuiltInAgent does read `state`, but a state change does
// not start a run, and the agent would write it with untyped JSON patches instead of updateRedline.)
//
// The agent may be busy when the edit lands: mid-reply, or waiting on a card. Then the edit waits in a
// queue (copilot/edit-queue.ts, one entry per redline, latest text wins) and goes out as soon as the
// agent is idle. Nothing is dropped.

import { UseAgentUpdate, useAgent, useCopilotKit } from "@copilotkit/react-core/v2";
import { useCallback, useEffect, useRef } from "react";
import { appStore } from "@/lib/store";
import { HUMAN_EDIT_ID_PREFIX, editMessage, enqueueEdit, isBusy, type Edit } from "./edit-queue";

/** Let React commit the edit (so useAgentContext sends the new redline) and the agent's events settle. */
const SETTLE_MS = 150;
/** While the agent is busy, look again this often. */
const POLL_MS = 400;
/** A tool result with nothing after it means CopilotKit is about to run a follow-up; wait this long for it. */
const FOLLOW_UP_GRACE_MS = 2000;

export function useTellCopilot(enabled: boolean) {
  // Re-render on run status only. The default (every update) would re-render the whole workspace on
  // each streamed token; the flush below reads the agent when it runs instead.
  const { agent } = useAgent({ updates: [UseAgentUpdate.OnRunStatusChanged] });
  const { copilotkit } = useCopilotKit();
  const queue = useRef<Edit[]>([]);
  const sending = useRef(false);
  const lastAgentEvent = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useRef<() => void>(() => {});

  const schedule = useCallback((delay: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => flush.current(), delay);
  }, []);

  useEffect(() => {
    flush.current = async () => {
      timer.current = null;
      if (!enabled || sending.current || queue.current.length === 0) return;
      const followUpPending = Date.now() - lastAgentEvent.current < FOLLOW_UP_GRACE_MS;
      if (isBusy(agent, followUpPending)) return schedule(POLL_MS);

      const message = editMessage(queue.current, appStore.getState().activeMatterId);
      queue.current = [];
      if (!message) return;
      sending.current = true;
      try {
        agent.addMessage({ id: `${HUMAN_EDIT_ID_PREFIX}${crypto.randomUUID()}`, role: "user", content: message });
        await copilotkit.runAgent({ agent }); // a failed run reaches the provider's onError (the chat's error banner)
      } finally {
        sending.current = false;
        if (queue.current.length > 0) schedule(SETTLE_MS);
      }
    };

    // Any agent event (a run starting or ending, a tool result arriving) is a moment to look again.
    const onAgentEvent = () => {
      lastAgentEvent.current = Date.now();
      if (queue.current.length > 0) schedule(SETTLE_MS);
    };
    const subscription = agent.subscribe({
      onRunInitialized: onAgentEvent,
      onRunFinalized: onAgentEvent,
      onRunFailed: onAgentEvent,
      onMessagesChanged: onAgentEvent,
    });
    if (queue.current.length > 0) schedule(SETTLE_MS);
    return () => subscription.unsubscribe();
  }, [agent, copilotkit, enabled, schedule]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return useCallback(
    (edit: Edit) => {
      if (!enabled) return; // No chat to tell. The redline is in the agent's context either way.
      queue.current = enqueueEdit(queue.current, edit);
      schedule(SETTLE_MS);
    },
    [enabled, schedule],
  );
}
