// Concept: suggestions. Chips above the chat input, written the way the presenter would type them,
// that follow the story's state so every line the scripted mock understands is one click away where
// it makes sense (copilot/chips.ts): the next step first (review, the reason, send, where it is, what
// the approver asked for, the next contract), then what else the copilot can do from here (the
// document asks, the collection, how reviews are going), at most four. Nothing while the plan runs;
// Brightwater and the collection's question wait until PB-SEC-01 is published. A thread an agent's
// Start button opened offers that agent's line first. The mock understands every chip
// (demo-script.test.ts checks it at every step). ChatPanel.tsx draws them pinned above the composer.

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
