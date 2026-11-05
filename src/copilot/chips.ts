// Which suggestion chips to offer, from the app state alone, as a plain function so it is tested on
// its own (demo-script.test.ts checks the mock understands every chip at every step). No CopilotKit
// imports here; useSuggestionChips.ts hands the result to CopilotKit. The chips only offer what the
// copilot could sensibly suggest (review this, send it, where is it), never Maya's own judgment: the
// reason she accepts a deviation is typed by her.

import { COLLECTION_SENTENCE, DEMO_SENTENCES, REVIEWS_GOING_SENTENCE } from "@/lib/demo-script";
import { getPerson } from "@/lib/company";
import { ACME_ID, BRIGHTWATER_ID } from "@/lib/matters";

/** The opening line for each matter: the only chips that make sense in a matter's empty thread. */
import { currentApprover, matterView, type AppState } from "@/lib/store";

export const OPENING = DEMO_SENTENCES[0];
export const SEND = DEMO_SENTENCES[2];
export const BRIGHTWATER = DEMO_SENTENCES[3];

export const REVIEW_LINE: Record<string, string> = { [ACME_ID]: OPENING, [BRIGHTWATER_ID]: BRIGHTWATER };
/** Step 8 (optional): the collection's security column. */
export const COLLECTION = COLLECTION_SENTENCE;
export const REVIEWS_GOING = REVIEWS_GOING_SENTENCE;
/** The lines that open a thread: the only chips an empty thread shows. */
export const OPENING_LINES: string[] = [OPENING, BRIGHTWATER, COLLECTION, REVIEWS_GOING];

/**
 * `opening` is the line an agent's Start button left ready (AgentsPanel.tsx): it is offered in the
 * new thread until the first message.
 */
export function chipsFor(state: AppState, opening: string | null = null): string[] {
  if (opening) return [opening];
  if (state.activeCollectionId) return state.collectionCells.length ? [] : [COLLECTION];
  const learnedSecurity = state.publishedRules.some((r) => r.id === "PB-SEC-01");
  if (learnedSecurity && !state.matters[BRIGHTWATER_ID]) return [BRIGHTWATER];
  if (!state.activeMatterId) return state.matters[ACME_ID]?.planApprovedAt ? [] : [OPENING];

  const view = matterView(state, state.activeMatterId);
  if (!view.planApproved) return [REVIEW_LINE[view.matter.id]];
  if (!view.complete) return [];
  // A reason for accepting a deviation is Maya's judgment: the copilot asks for it, and she types it. No chip.
  if (view.missingReasons.length) return [];
  const submission = view.state?.submission;
  if (!submission) return [SEND];
  if (submission.status === "pending") return currentApprover(submission) ? [`Where is the ${view.matter.vendorShort} review?`] : [];
  if (submission.status === "sent_back") {
    const by = submission.decisions.at(-1)?.approverId;
    return by ? [`What did ${getPerson(by).name.split(" ")[0]} ask for?`] : [];
  }
  return [];
}
