// Which suggestion chips to offer, from the app state alone, as a plain function so it is tested on
// its own (demo-script.test.ts checks the mock understands every chip at every step). No CopilotKit
// imports here; useSuggestionChips.ts hands the result to CopilotKit.
//
// Every line the scripted mock understands is always one click away where it makes sense: the next
// step of the story first, then what else the copilot can do from here (the document asks, the
// collection, how reviews are going), at most four at a time. Two holds stay:
// - nothing is offered while the plan runs (the copilot is working);
// - Brightwater and the collection's security question wait until a person has published PB-SEC-01
//   in Insights. Before that, they would spoil the learning beat.

import { COLLECTION_SENTENCE, DEMO_SENTENCES, DOCUMENT_ASKS, REVIEWS_GOING_SENTENCE } from "@/lib/demo-script";
import { getPerson } from "@/lib/company";
import { ACME_ID, BRIGHTWATER_ID } from "@/lib/matters";
import { currentApprover, matterView, type AppState } from "@/lib/store";

export const OPENING = DEMO_SENTENCES[0];
/** Maya's reason for accepting the 6-month cap (step 3), as the README's demo script has it. */
export const REASON = DEMO_SENTENCES[1];
export const SEND = DEMO_SENTENCES[2];
export const BRIGHTWATER = DEMO_SENTENCES[3];

export const REVIEW_LINE: Record<string, string> = { [ACME_ID]: OPENING, [BRIGHTWATER_ID]: BRIGHTWATER };
/** Step 8 (optional): the collection's security column. */
export const COLLECTION = COLLECTION_SENTENCE;
export const REVIEWS_GOING = REVIEWS_GOING_SENTENCE;

/** The most chips shown at once. */
export const MAX_CHIPS = 4;

/** The document asks (lib/demo-script.ts DOCUMENT_ASKS) for Acme that haven't been done yet, in the order they read best. */
function documentChips(state: AppState): string[] {
  const acme = state.matters[ACME_ID];
  const doc = acme?.doc;
  const reviewed = acme ? matterView(state, ACME_ID).complete : false;
  const commented = (doc?.comments ?? []).some((c) => c.by === "agent" && /\(PB-[A-Z]+-\d{2}\)/.test(c.text));
  const clauseAdded = (doc?.inserts ?? []).some((i) => /SOC 2 Type II/.test(i.text));
  const edited = Boolean(doc?.edits["§2.3:0"]);
  return [...(reviewed && !commented ? [DOCUMENT_ASKS.comments] : []), ...(clauseAdded ? [] : [DOCUMENT_ASKS.clause]), ...(edited ? [] : [DOCUMENT_ASKS.edit])];
}

/**
 * `opening` is the line an agent's Start button left ready (AgentsPanel.tsx): it comes first in the
 * new thread until the first message.
 */
export function chipsFor(state: AppState, opening: string | null = null): string[] {
  const lines = [...(opening ? [opening] : []), ...contextual(state)];
  return [...new Set(lines)].slice(0, MAX_CHIPS);
}

function contextual(state: AppState): string[] {
  const learnedSecurity = state.publishedRules.some((r) => r.id === "PB-SEC-01");
  const brightwater = learnedSecurity && !state.matters[BRIGHTWATER_ID] ? [BRIGHTWATER] : [];
  const collection = learnedSecurity && state.collectionCells.length === 0 ? [COLLECTION] : [];

  if (state.activeCollectionId) return state.collectionCells.length ? [REVIEWS_GOING, ...brightwater] : [COLLECTION, REVIEWS_GOING];

  if (!state.activeMatterId) {
    if (!state.matters[ACME_ID]?.planApprovedAt) return [OPENING, DOCUMENT_ASKS.edit, REVIEWS_GOING];
    return [...brightwater, ...collection, ...documentChips(state), REVIEWS_GOING];
  }

  const view = matterView(state, state.activeMatterId);
  const docs = view.matter.id === ACME_ID ? documentChips(state) : [];
  if (!view.planApproved) return [REVIEW_LINE[view.matter.id], ...docs, REVIEWS_GOING];
  if (!view.complete) return []; // the plan is running
  // Maya's 6-month cap still deviates and needs a reason: the demo script's reason, ready to send.
  if (view.missingReasons.length) return [...(view.missingReasons[0].ruleId === "PB-LIAB-01" ? [REASON] : []), ...docs];
  const submission = view.state?.submission;
  if (!submission) return [SEND, ...docs, ...brightwater];
  if (submission.status === "pending") {
    const waiting = currentApprover(submission) ? [`Where is the ${view.matter.vendorShort} review?`] : [];
    return [...waiting, ...docs, REVIEWS_GOING];
  }
  if (submission.status === "sent_back") {
    const by = submission.decisions.at(-1)?.approverId;
    const asked = by ? [`What did ${getPerson(by).name.split(" ")[0]} ask for?`] : [];
    // Jordan's send-back asks for the SOC 2 report: the clause that answers it comes next.
    const answer = docs.includes(DOCUMENT_ASKS.clause) ? [DOCUMENT_ASKS.clause] : [];
    return [...brightwater, ...asked, ...answer, ...collection, ...docs, REVIEWS_GOING];
  }
  return [...brightwater, ...collection, REVIEWS_GOING];
}
