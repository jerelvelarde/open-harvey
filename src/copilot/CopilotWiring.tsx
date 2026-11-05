// Everything the app registers with the agent, in one place. Each hook is one concept; open the file
// it comes from to see how it works. Renders nothing.

import { useAppContext } from "./useAppContext";
import { useCollectionTools } from "./useCollectionTools";
import { useDocumentTools } from "./useDocumentTools";
import { useGenerativeUI } from "./useGenerativeUI";
import { useProposePlan } from "./useProposePlan";
import { useRequestApproval } from "./useRequestApproval";
import { useReviewTools } from "./useReviewTools";
import { useSuggestionChips } from "./useSuggestionChips";
import { useWorkRows } from "./useWorkRows";

export function CopilotWiring() {
  useAppContext(); // what the agent knows
  useReviewTools(); // what the agent can do: read a matter, tick a task, re-check a redline
  useCollectionTools(); // ...and answer a collection's review table, one cell per call
  useDocumentTools(); // ...and work in the contract itself: tracked edits, new clauses, margin comments
  useGenerativeUI(); // what the agent can show: findings, redline diffs, the re-check
  useWorkRows(); // how the agent's work reads while it runs
  useProposePlan(); // what only the human can decide: the plan...
  useRequestApproval(); // ...and the send
  useSuggestionChips(); // the presenter's next line, one click away
  return null;
}
