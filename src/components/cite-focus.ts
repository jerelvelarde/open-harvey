// "Show me the passage": a cite chip anywhere (the plan, the review table, a chat card) asks the
// workspace to open the Contract tab on that passage and highlight the words it quotes. Plain module
// state with useSyncExternalStore; UI state only, never persisted. Each request gets a new number,
// so clicking the same chip twice scrolls to it again.

import { useSyncExternalStore } from "react";

export type CiteFocus = { matterId: string; passageId: string; quote: string | null; label: string | null; n: number };

let focus: CiteFocus | null = null;
let count = 0;
const listeners = new Set<() => void>();

export function showPassage(matterId: string, passageId: string, quote: string | null = null, label: string | null = null) {
  focus = { matterId, passageId, quote, label, n: ++count };
  listeners.forEach((listener) => listener());
}

export function clearPassage() {
  focus = null;
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useCiteFocus = () => useSyncExternalStore(subscribe, () => focus, () => null);
