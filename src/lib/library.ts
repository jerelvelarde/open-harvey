// The documents the app works from, read on the server (lib/server-data.ts) and handed to the
// client once: the contracts' text and the written playbook. The tool handlers and the panels read
// them from here. The deal terms are JSON and are imported directly (lib/matters.ts).

import type { Contract } from "./contract";
import type { PastReview } from "./learning";
import type { PlaybookRule } from "./playbook";

/** The documents, the playbook, and the reviews imported at go-live (for Analytics and the copilot's context). */
export type Library = { contracts: Record<string, Contract>; playbook: Record<string, PlaybookRule>; history?: PastReview[] };

let library: Library = { contracts: {}, playbook: {} };

export function loadLibrary(next: Library) {
  library = next;
}

export const getLibrary = () => library;

export function getContract(matterId: string): Contract {
  const contract = library.contracts[matterId];
  if (!contract) throw new Error(`The contract for ${matterId} is not loaded.`);
  return contract;
}
