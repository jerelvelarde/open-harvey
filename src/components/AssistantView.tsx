// The assistant view: the copilot's thread at the centre (copilot/ChatPanel.tsx), its plan and work
// on the right rail (RightRail.tsx). Opening an output (the review table, the contract, the
// approvals) puts it beside the thread in place of the rail, so Maya can edit a redline and watch the
// copilot re-check it in the same glance. In the collection's thread, the collection's review table
// opens there instead, and fills as the agent answers it.

"use client";

import { RightRail } from "@/components/RightRail";
import { OutputPanel } from "@/components/OutputPanel";
import { CollectionOutput } from "@/components/panels/CollectionsPanel";
import { useShell } from "@/components/shell-state";
import { ChatPanel } from "@/copilot/ChatPanel";
import { matterView, useAppState, type RedlineEdit } from "@/lib/store";

type Props = { model: string; error: string | null; onDismissError: () => void; onHumanEdit: (edit: RedlineEdit) => void; hidden: boolean };

export function AssistantView({ model, error, onDismissError, onHumanEdit, hidden }: Props) {
  const { output, railOpen } = useShell();
  const state = useAppState();
  const view = state.activeMatterId ? matterView(state, state.activeMatterId) : null;
  const collection = output === "collection" && state.activeCollectionId !== null;
  const side = collection || (output && output !== "collection" && view);
  return (
    <div className={`min-h-0 min-w-0 flex-1 ${hidden ? "hidden" : "flex"}`} data-testid="assistant-view">
      <section
        aria-label="Assistant"
        className={`copilot-surface flex min-h-0 min-w-0 flex-col bg-surface ${side ? "w-[440px] shrink-0 border-r border-hairline max-lg:hidden" : "flex-1"}`}
        data-testid="thread"
      >
        <ChatPanel model={model} error={error} onDismissError={onDismissError} />
      </section>
      {collection ? <CollectionOutput /> : side && view && output ? <OutputPanel view={view} output={output} onHumanEdit={onHumanEdit} /> : <RightRail view={view} model={model} open={railOpen} />}
    </div>
  );
}
