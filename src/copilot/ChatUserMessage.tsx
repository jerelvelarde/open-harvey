// Concept: the agent notices what the human changed, as the chat shows it.
//
// useTellCopilot.ts posts each committed redline edit as a user message, so the agent re-checks it
// without being asked. Maya never typed that message, so a speech bubble would be wrong. This
// replaces CopilotChat's user message (the `userMessage` slot of its message view) for those
// messages only: they render as a quiet event row, "You changed the §8.2 redline · 12 months of fees
// → 6 months of fees, with a $1,000,000 cap for data-protection breaches", and once the agent's recheckRedline call for that turn has its result, "Saw
// your edit · re-checked". Everything a person typed renders as CopilotChat's own user message.

import { CopilotChatUserMessage, UseAgentUpdate, useAgent, type CopilotChatUserMessageProps } from "@copilotkit/react-core/v2";
import { ArrowRight, Check, LoaderCircle, PenLine } from "lucide-react";
import { HUMAN_EDIT_ID_PREFIX, editSummary, readEditMessage, type EditLine } from "./edit-queue";

const NoToolbar = () => null;

const textOf = (content: CopilotChatUserMessageProps["message"]["content"]) =>
  typeof content === "string" ? content : content.map((part) => (part.type === "text" ? part.text : "")).join("");

function UserMessage(props: CopilotChatUserMessageProps) {
  const edits = props.message.id.startsWith(HUMAN_EDIT_ID_PREFIX) ? readEditMessage(textOf(props.message.content)) : null;
  if (edits) return <HumanEditRow messageId={props.message.id} edits={edits} />;
  return <CopilotChatUserMessage {...props} toolbar={NoToolbar} />;
}

/** The slot value: our component, carrying CopilotChatUserMessage's parts (Container, Toolbar...) as the slot type asks. */
export const ChatUserMessage = Object.assign(UserMessage, CopilotChatUserMessage);

function Line({ edit }: { edit: EditLine }) {
  const span = editSummary(edit.ruleId, edit.before, edit.after);
  return (
    <span>
      You changed the <span className="font-mono">{edit.cite}</span> redline ·{" "}
      <span className="whitespace-nowrap font-medium text-ink">
        {span.before}
        <ArrowRight aria-label="to" className="mx-1 inline size-3 align-[-1px]" strokeWidth={2} />
      </span>
      <span className="font-medium text-ink">{span.after}</span>
    </span>
  );
}

function HumanEditRow({ messageId, edits }: { messageId: string; edits: EditLine[] }) {
  // Read the turn this edit started: did the agent's recheckRedline call come back yet?
  const { agent } = useAgent({ updates: [UseAgentUpdate.OnMessagesChanged, UseAgentUpdate.OnRunStatusChanged] });
  const start = agent.messages.findIndex((m) => m.id === messageId);
  const turn = [];
  for (const message of start >= 0 ? agent.messages.slice(start + 1) : []) {
    if (message.role === "user") break;
    turn.push(message);
  }
  const checkIds = new Set(
    turn.flatMap((m) => (m.role === "assistant" ? (m.toolCalls ?? []).filter((call) => call.function.name === "recheckRedline").map((call) => call.id) : [])),
  );
  const rechecked = turn.some((m) => m.role === "tool" && checkIds.has(m.toolCallId));

  return (
    <div data-testid="human-edit-row" className="my-3 flex gap-2.5 border-y border-hairline py-2 text-small text-muted">
      <PenLine aria-hidden className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
      <div className="min-w-0 space-y-0.5">
        {edits.map((edit, i) => (
          <p key={i}>
            <Line edit={edit} />
          </p>
        ))}
        <p className="flex items-center gap-1">
          {rechecked ? (
            <>
              <Check aria-hidden className="size-3 text-ink" strokeWidth={2.5} />
              Saw your edit · re-checked
            </>
          ) : agent.isRunning ? (
            <>
              <LoaderCircle aria-hidden className="work-spinner size-3" strokeWidth={2.25} />
              Sent to the copilot · re-checking
            </>
          ) : (
            "Sent to the copilot"
          )}
        </p>
      </div>
    </div>
  );
}
