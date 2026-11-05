// The document's selection: the tracked change or comment in focus (its margin card and its words
// light up together), and the passage to bring into view when the copilot changes something, so the
// person watches the change land. UI state only, never persisted; plain module state with
// useSyncExternalStore, like cite-focus.ts, so a tool handler can move it.

import { useSyncExternalStore } from "react";

export type DocFocus = { active: string | null; flash: { cite: string; n: number } | null };

let focus: DocFocus = { active: null, flash: null };
let count = 0;
const listeners = new Set<() => void>();

function set(next: DocFocus) {
  focus = next;
  listeners.forEach((listener) => listener());
}

/** Focus a change ("rule:PB-LIAB-01", "§2.3:0", "insert:§5.4") or a comment ("C1"); null clears it. */
export const setActive = (active: string | null) => set({ ...focus, active });

/** Scroll a passage into view and flash it; optionally focus a change or comment in it. */
export const flashPassage = (cite: string, active: string | null = focus.active) => set({ active, flash: { cite, n: ++count } });

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useDocFocus = () => useSyncExternalStore(subscribe, () => focus, () => focus);
