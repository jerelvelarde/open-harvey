// Concept: an agent is a job, its inputs, its gates and its tools. The Agents page lists the three
// jobs this copilot really does, each described from what it calls: every tool named here is a tool
// the agent is given (agents.test.ts checks them against lib/agent-tools.ts), and every "today" line
// is counted from the store, never estimated.

import { analytics } from "./analytics";
import { COLLECTION_DOCS, COLLECTION_NAME, COLUMNS } from "./collection";
import type { PastReview } from "./learning";
import { MATTERS } from "./matters";
import type { AppState } from "./store";

export type AgentId = "contract-review" | "document-drafting" | "collection-review" | "send-back-analysis";

export type AgentCard = {
  id: AgentId;
  name: string;
  does: string;
  reads: string;
  /** What waits for a person. */
  gates: string[];
  /** The tools it calls, by the names the model sees. Empty when it works from the app context alone. */
  tools: string[];
};

export const AGENTS: AgentCard[] = [
  {
    id: "contract-review",
    name: "Vendor contract review",
    does: "Takes a vendor contract from arrival to ready to sign: a plan from the playbook, one task per topic, a redline for each deviation, and the approvers worked out from the routing rules.",
    reads: "The contract and its deal terms, the Northstar vendor playbook, and the rules Rachel Adler has published.",
    gates: ["Maya approves the plan before any task runs.", "Maya sends it for approval; nothing goes to the vendor until every approver has approved.", "A redline Maya wrote is never overwritten without her say-so."],
    tools: ["readMatter", "proposePlan", "runPlanTask", "showFindings", "showRedlines", "recheckRedline", "showRecheck", "setDeviationReason", "updateRedline", "requestApproval"],
  },
  {
    id: "document-drafting",
    name: "Document drafting",
    does: "Works in the contract itself, the way a colleague does in Word: suggests edits as tracked changes in its own name, adds clauses, and comments in the margin on the exact words, replying and resolving as the review goes.",
    reads: "The contract as it reads now, with every tracked change and comment, and who made each one.",
    gates: ["Maya accepts or rejects every tracked change; none counts as agreed until she does.", "Text and comments Maya wrote are never changed or resolved without her say-so."],
    tools: ["readDocument", "suggestEdit", "insertClause", "addComment", "replyToComment", "resolveComment"],
  },
  {
    id: "collection-review",
    name: "Collection review",
    does: "Asks every contract in a collection the same questions and fills its review table one cell at a time, each answer quoted from the contract and cited to its passage.",
    reads: `${COLLECTION_NAME}: ${COLLECTION_DOCS.length} contracts and the ${COLUMNS.length} questions of its review table.`,
    gates: ["Nothing to approve: it writes only its own review table, never a contract, redline or playbook rule."],
    tools: ["readCollection", "fillCollectionCell"],
  },
  {
    id: "send-back-analysis",
    name: "Send-back analysis",
    does: "Groups why approvers send reviews back, proposes a playbook rule when one reason keeps returning, and answers how reviews are going.",
    reads: "The six reviews imported at go-live, this session's send-backs and the decision log, through tested functions sent as context.",
    gates: ["Rachel Adler, General Counsel, publishes or dismisses each proposed rule. Nothing joins the playbook until she does."],
    tools: [],
  },
];

/** What each agent has done in this session, counted from the store. */
export function agentToday(id: AgentId, state: AppState, history: readonly PastReview[]): string {
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  switch (id) {
    case "contract-review": {
      const run = MATTERS.filter((m) => state.matters[m.id]?.planApprovedAt).length;
      return run ? `Today: ${plural(run, "review")} run, ${plural(analytics(state, history).since.tasksRun, "task")}` : "Today: nothing run yet";
    }
    case "document-drafting": {
      const docs = Object.values(state.matters).map((m) => m.doc);
      const changes = docs.reduce((n, d) => n + Object.values(d?.edits ?? {}).filter((e) => e.by === "agent").length + (d?.inserts ?? []).filter((i) => i.by === "agent").length, 0);
      const comments = docs.reduce((n, d) => n + (d?.comments ?? []).filter((c) => c.by === "agent").length, 0);
      return changes || comments ? `Today: ${plural(changes, "change")} suggested, ${plural(comments, "comment")}` : "Today: nothing drafted yet";
    }
    case "collection-review": {
      const cells = state.collectionCells.length;
      const asked = COLUMNS.filter((c) => state.collectionCells.some((k) => k.endsWith(`:${c.key}`)));
      return cells ? `Today: ${plural(cells, "answer")} (${asked.map((c) => c.label).join(", ")})` : "Today: nothing asked yet";
    }
    case "send-back-analysis": {
      const a = analytics(state, history);
      const backs = a.reasons.reduce((n, r) => n + r.since, 0);
      return backs || a.since.rulesPublished ? `Today: ${plural(backs, "send-back")} read, ${plural(a.since.rulesPublished, "rule")} published` : `Today: no send-backs yet; ${plural(a.before.sentBack, "imported send-back")} read`;
    }
  }
}
