// The copilot's thread, at the centre of the assistant view: CopilotKit's prebuilt chat (CopilotChat),
// talking to the runtime at /api/copilotkit, dressed in the app's own type and palette
// (app/globals.css, .copilot-surface). Maya's messages are quiet stone bubbles, the copilot's
// replies plain text, its cards inline, the composer centred at the bottom.
//
// Four slots do the work, all on CopilotChat's own API:
// - messageView: CopilotChat's message view with toolCallDisplay "turn": the agent works in the open,
//   then folds its steps into one line that names them once it replies (rows and TurnSummary come
//   from useWorkRows.tsx). MessageView below keeps the turn "working" across the run's follow-ups.
// - messageView.userMessage: a redline edit made in the review table shows as an event row, not a bubble
//   (ChatUserMessage.tsx).
// - input: ChatComposer, CopilotKit's composer with the suggestion chips pinned above it (the chips
//   follow the story: see useSuggestionChips.ts), no attachments menu and no disclaimer line.
// - welcomeScreen: a short intro above that composer, naming the open matter.
// The chat always answers: without a key the scripted mock plays the demo (lib/mock-model.ts). An
// error from a run shows above the chat and clears itself after the next run that succeeds.

"use client";

import {
  CopilotChat,
  CopilotChatInput,
  CopilotChatMessageView,
  CopilotChatView,
  UseAgentUpdate,
  useAgent,
  useSuggestions,
  type CopilotChatInputProps,
  type CopilotChatMessageViewProps,
} from "@copilotkit/react-core/v2";
import { CircleAlert } from "lucide-react";
import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { CURRENT_USER } from "@/lib/company";
import { getMatter, matterTitle } from "@/lib/matters";
import { useAppState } from "@/lib/store";
import { DISCLAIMER } from "@/lib/company";
import { clearOpening } from "@/components/shell-state";
import { COLLECTION_NAME } from "@/lib/collection";
import { OPENING_LINES } from "./chips";
import { useWaitingGate } from "./gate-state";
import { matterThread } from "./thread-segments";
import { ChatUserMessage } from "./ChatUserMessage";
import { useTurnWorking } from "./useTurnWorking";
import { TurnSummary } from "./useWorkRows";

type Props = { model: string; error: string | null; onDismissError: () => void };

// Slot values live at module scope so the chat's memoised messages do not re-render on every keystroke.
const MESSAGE_VIEW_OPTIONS = {
  toolCallDisplay: "turn",
  userMessage: ChatUserMessage,
  workSummary: TurnSummary,
  assistantMessage: { toolbarVisible: false },
} as const;

/**
 * CopilotChat's message view, with two changes. It is told the turn is still working between its
 * follow-up runs (useTurnWorking.ts). And it renders every message instead of virtualizing the list:
 * one review is about 45 messages, past the chat's virtualization threshold, and a virtualized row
 * keeps the height it had before its work rows folded, which leaves blank gaps in the transcript.
 * The `children` render prop is CopilotChatMessageView's own way to render the list yourself.
 */
function MessageView(props: CopilotChatMessageViewProps) {
  const working = useTurnWorking(props.isRunning ?? false);
  const { activeMatterId, activeCollectionId } = useAppState();
  const threadId = activeMatterId ?? activeCollectionId;
  const from = useThreadStart(threadId, props.messages?.length ?? 0);
  // Each matter (and the collection) reads as its own thread: only its messages show (thread-segments.ts).
  const { messages, setAside } = useMemo(() => matterThread(props.messages ?? [], threadId, from), [props.messages, threadId, from]);
  const title = activeMatterId ? matterTitle(getMatter(activeMatterId)) : activeCollectionId ? COLLECTION_NAME : null;
  return (
    <CopilotChatMessageView {...props} {...MESSAGE_VIEW_OPTIONS} messages={messages} isRunning={working}>
      {({ messageElements, interruptElement }) => (
        <div data-testid="copilot-message-list" className="copilotKitMessages">
          {setAside > 0 && title && (
            <div className="mb-2 flex items-center gap-3 text-small text-muted" data-testid="matter-divider">
              <span className="h-px flex-1 bg-hairline" />
              <span>
                <span className="font-medium text-ink">{title}</span> · {activeMatterId ? "this matter's thread" : "this collection's thread"}
              </span>
              <span className="h-px flex-1 bg-hairline" />
            </div>
          )}
          {messageElements}
          {interruptElement}
        </div>
      )}
    </CopilotChatMessageView>
  );
}
const MESSAGE_VIEW = Object.assign(MessageView, CopilotChatMessageView);

/**
 * Where the open thread began in the agent's messages: the count when it opened. A new thread shows
 * only what follows, so a question typed there appears at once (and the chat times its reply). React's
 * "adjust state when a prop changes" pattern: the count is taken in the render the thread changes.
 */
function useThreadStart(threadId: string | null, length: number): number {
  const [start, setStart] = useState({ threadId, from: length });
  if (start.threadId !== threadId) {
    setStart({ threadId, from: length });
    return length;
  }
  return start.from;
}
const NoAddMenu = () => null;

const LABELS = { chatInputPlaceholder: "Ask about this matter…", welcomeMessageText: `Hi ${CURRENT_USER.name.split(" ")[0]}. Which contract are we working on?` };
/** The composer's placeholder names what the thread is about: a matter, the collection, or nothing yet. */
const LABELS_BY_THREAD = {
  matter: LABELS,
  collection: { ...LABELS, chatInputPlaceholder: "Ask about this collection…" },
  none: { ...LABELS, chatInputPlaceholder: "Name a contract…" },
} as const;

/** The thread at the centre of the assistant view. The model label lives in the right rail's Properties. */
export function ChatPanel({ error, onDismissError }: Props) {
  useClearErrorAfterSuccess(error, onDismissError);
  const { activeMatterId, activeCollectionId } = useAppState();
  const labels = LABELS_BY_THREAD[activeMatterId ? "matter" : activeCollectionId ? "collection" : "none"];
  return (
    <div id="copilot-panel" className="flex h-full min-h-0 flex-col" data-testid="copilot-thread">
      {error && (
        <div role="alert" className="flex items-start gap-2 border-b border-ink bg-stone px-4 py-2.5 text-small text-ink">
          <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" strokeWidth={2.25} />
          <span className="min-w-0 flex-1">
            The copilot hit an error: {error}. Try again; this clears after the next reply.
          </span>
          <button type="button" className="shrink-0 font-medium underline underline-offset-[3px]" onClick={onDismissError}>
            Dismiss
          </button>
        </div>
      )}
      <div className="min-h-0 flex-1">
        <CopilotChat className="h-full" labels={labels} welcomeScreen={ChatWelcome} messageView={MESSAGE_VIEW} input={ChatComposer} />
      </div>
    </div>
  );
}

type WelcomeProps = ComponentProps<typeof CopilotChatView.WelcomeScreen>;

/**
 * The composer, with the suggestion chips pinned right above it (CopilotKit would put them at the end
 * of the transcript). A chip sends its sentence exactly as if it were typed. The chips step aside
 * while the copilot works and while one of its cards waits for a click.
 */
function ChatComposer(props: CopilotChatInputProps) {
  const { suggestions } = useSuggestions();
  const cardWaiting = useWaitingGate() !== null;
  const working = useTurnWorking(props.isRunning ?? false);
  const { agent } = useAgent({ updates: [UseAgentUpdate.OnMessagesChanged] });
  const { activeMatterId, activeCollectionId } = useAppState();
  // In an empty thread (a matter just opened, a page just loaded, an agent just started) only an opening line makes sense.
  const threadId = activeMatterId ?? activeCollectionId;
  const from = useThreadStart(threadId, agent.messages.length);
  const empty = matterThread(agent.messages, threadId, from).messages.length === 0;
  const offered = empty ? suggestions.filter((chip) => OPENING_LINES.includes(chip.message)) : suggestions;
  useEffect(() => {
    if (!empty) clearOpening(); // an agent's opening line is offered once, in the thread it started
  }, [empty]);
  const chips = working || cardWaiting ? [] : offered;
  return (
    <div>
      {chips.length > 0 && (
        <div data-testid="copilot-chips" className="pointer-events-auto mx-auto mb-2 flex max-w-[720px] flex-wrap gap-1.5 px-4">
          {chips.map((chip) => (
            <button
              key={chip.title}
              type="button"
              onClick={() => props.onSubmitMessage?.(chip.message)}
              className="max-w-full rounded-[6px] border border-hairline bg-surface px-2.5 py-1.5 text-left text-small font-medium text-ink transition-colors duration-150 hover:border-rule hover:bg-stone"
            >
              {chip.title}
            </button>
          ))}
        </div>
      )}
      <CopilotChatInput {...props} showDisclaimer={false} addMenuButton={NoAddMenu} />
      <p className="mx-auto max-w-[688px] px-4 pb-2 text-center text-small text-muted" data-testid="disclaimer">
        {DISCLAIMER}
      </p>
    </div>
  );
}

/** Before the first message: the open matter and what the copilot does with it, then the composer (with its chips). */
function ChatWelcome({ input }: WelcomeProps) {
  const state = useAppState();
  const active = state.activeMatterId ? getMatter(state.activeMatterId) : null;
  const collection = state.activeCollectionId !== null;
  return (
    <div data-testid="copilot-welcome-screen" className="flex h-full min-h-0 flex-col">
      <div className="mx-auto flex min-h-0 w-full max-w-[720px] flex-1 flex-col justify-end overflow-y-auto px-4 pb-6 max-sm:justify-start max-sm:pt-8">
        {active ? (
          <p className="font-serif text-title text-ink">{matterTitle(active)}</p>
        ) : collection ? (
          <p className="font-serif text-title text-ink">{COLLECTION_NAME}</p>
        ) : (
          <p className="text-title font-semibold tracking-[-0.01em] text-ink">{LABELS.welcomeMessageText}</p>
        )}
        <p className="mt-2 max-w-[60ch] text-muted">
          {active
            ? "Ask me to review it. I propose a plan from the playbook, run it once you approve it, and cite every finding to its passage."
            : collection
              ? "Ask a question of every contract in it. I answer its review table one cell at a time, each answer quoted and cited. I write only to that table, never to a contract, redline or playbook rule."
              : "Name a contract and I'll propose a review plan from the playbook. Nothing runs until you approve it."}
        </p>
      </div>
      <div className="pb-4">{input}</div>
    </div>
  );
}

/** The error banner goes away by itself once a later run finishes successfully. */
function useClearErrorAfterSuccess(error: string | null, clear: () => void) {
  const { agent } = useAgent({ updates: [UseAgentUpdate.OnRunStatusChanged] });
  useEffect(() => {
    if (!error) return;
    const subscription = agent.subscribe({
      onRunFinishedEvent: ({ outcome }) => {
        if (outcome === "success") clear();
      },
    });
    return () => subscription.unsubscribe();
  }, [agent, error, clear]);
}
