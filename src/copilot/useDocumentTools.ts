// Concept: the agent works in the document natively. These frontend tools let it read the contract as
// it reads now, suggest edits as tracked changes in its own name, add clauses and comment in the
// margin, with the same handlers the tests run (lib/agent-tools.ts). Each one opens the document
// beside the thread and brings the passage into view, so the person watches the change land.
//
// The people stay in control: Maya accepts or rejects every change; text and comments she wrote are
// refused unless she asked (lib/store.ts). As in useReviewTools.ts, each handler reads the store
// when it runs, so the empty deps arrays are safe.

import { useFrontendTool } from "@copilotkit/react-core/v2";
import { flashPassage } from "@/components/doc-focus";
import { openOutput } from "@/components/shell-state";
import { toolHandlers, toolSchemas } from "@/lib/agent-tools";

/** Open the document beside the thread, then bring a passage into view with its change or comment in focus. */
function show(cite: string | undefined, active: string | null = null) {
  openOutput("contract");
  if (cite) requestAnimationFrame(() => flashPassage(cite, active));
}

type Ok = { ok?: boolean; cite?: string; changeId?: string; commentId?: string };

export function useDocumentTools() {
  useFrontendTool(
    {
      name: "readDocument",
      description:
        "Open the contract as a live document beside the thread and read it as it reads now: every passage (with its cite, e.g. §2.3), the tracked changes (who made each, the rule behind a redline, the playbook position, the vendor's quoted words) and the comments.",
      parameters: toolSchemas.readDocument,
      handler: async (args) => {
        const result = toolHandlers.readDocument(args);
        show(undefined);
        return result;
      },
    },
    [],
  );

  useFrontendTool(
    {
      name: "suggestEdit",
      description:
        "Change exact words in one passage, as a tracked change in your name that the user accepts or rejects. `find` must be words the passage holds now (readDocument), within one sentence. Text the user wrote comes back refused, with their text, unless userAsked is true.",
      parameters: toolSchemas.suggestEdit,
      handler: async (args) => {
        const result = toolHandlers.suggestEdit(args) as Ok;
        show(args.cite, result.ok ? (result.changeId ?? null) : null);
        return result;
      },
    },
    [],
  );

  useFrontendTool(
    {
      name: "insertClause",
      description: "Add a clause at the end of a section, as a tracked insertion in your name. It gets the next free number (e.g. §5.4), so no existing cite moves.",
      parameters: toolSchemas.insertClause,
      handler: async (args) => {
        const result = toolHandlers.insertClause(args) as Ok;
        show(result.ok ? result.cite : undefined, result.ok ? (result.changeId ?? null) : null);
        return result;
      },
    },
    [],
  );

  useFrontendTool(
    {
      name: "addComment",
      description: "Comment in the margin on exact words of a passage. The quote must be words the passage holds, as it reads now or as the vendor wrote it.",
      parameters: toolSchemas.addComment,
      handler: async (args) => {
        const result = toolHandlers.addComment(args) as Ok;
        show(args.cite, result.ok ? (result.commentId ?? null) : null);
        return result;
      },
    },
    [],
  );

  useFrontendTool(
    {
      name: "replyToComment",
      description: "Reply to a comment in the margin.",
      parameters: toolSchemas.replyToComment,
      handler: async (args) => {
        const result = toolHandlers.replyToComment(args);
        show(undefined);
        return result;
      },
    },
    [],
  );

  useFrontendTool(
    {
      name: "resolveComment",
      description: "Resolve a comment: your own, or one the user wrote only when they asked (userAsked: true). A comment the user wrote comes back refused otherwise.",
      parameters: toolSchemas.resolveComment,
      handler: async (args) => toolHandlers.resolveComment(args),
    },
    [],
  );
}
