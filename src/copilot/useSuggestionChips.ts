// Concept: suggestions. Chips above the chat input, written the way the presenter would type them,
// that follow the story's state so the next line is one click away (copilot/chips.ts):
// - nothing open: "Review the Acme Cloud MSA and get it ready to sign";
// - the review has run: "Send it for approval";
// - Maya's redline still deviates and has no reason: no chip (the reason is hers to type);
// - sent: where it is; sent back: what the approver asked for;
// - once a person has published PB-SEC-01 in Insights: the next contract, Brightwater Metrics.
//   Before that, it would spoil the beat;
// - the collection's thread, before its table is filled: the security evidence question (step 8);
// - a thread an agent's Start button opened: that agent's opening line.
// The scripted mock understands every chip (lib/demo-script.ts). ChatPanel.tsx draws them pinned
// above the composer.

import { useConfigureSuggestions } from "@copilotkit/react-core/v2";
import { useShell } from "@/components/shell-state";
import { useAppState } from "@/lib/store";
import { chipsFor } from "./chips";

/** A chip reads as a label (no full stop) and sends the whole sentence. */
const chip = (sentence: string) => ({ title: sentence.replace(/\.$/, ""), message: sentence });

export function useSuggestionChips() {
  const chips = chipsFor(useAppState(), useShell().opening);
  useConfigureSuggestions({ available: "always", suggestions: chips.map(chip) }, [chips.join("|")]);
}
