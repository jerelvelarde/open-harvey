// Where the person is in the app: which view the left rail has open (the assistant thread, the
// matters, the playbook, Insights), which output the assistant's side panel shows, which tab the
// matter view is on, and whether the right rail is open on a narrow screen. UI state only, never
// persisted: plain module state with useSyncExternalStore, so a cite chip in a chat card can open the
// contract next to the thread.

import { useSyncExternalStore } from "react";

/** The views the sidebar opens. "matters" is a Space (one matter) or, with none open, all of them. */
export type View = "assistant" | "matters" | "playbook" | "agents" | "collections" | "analytics";
/** What opens beside the thread, named and ordered as the matter's own tabs: Review table, Contract, Approvals. Or a collection's review table. */
export type Output = "review" | "contract" | "route" | "collection";
export type MatterTab = "tasks" | "review" | "contract" | "approvals" | "insights";

/** `opening`: the line an agent's Start button left ready for the new thread, offered as its chip. */
export type Shell = { view: View; output: Output | null; tab: MatterTab; railOpen: boolean; opening: string | null };

let shell: Shell = { view: "matters", output: null, tab: "tasks", railOpen: false, opening: null };
const listeners = new Set<() => void>();

function set(patch: Partial<Shell>) {
  const next = { ...shell, ...patch };
  if (next.view === shell.view && next.output === shell.output && next.tab === shell.tab && next.railOpen === shell.railOpen && next.opening === shell.opening) return;
  shell = next;
  listeners.forEach((listener) => listener());
}

export const getShell = () => shell;
export const goTo = (view: View) => set({ view, railOpen: false, ...(view === "assistant" ? {} : { opening: null }) });
export const openOutput = (output: Output) => set({ view: "assistant", output });
export const closeOutput = () => set({ output: null });
export const setMatterTab = (tab: MatterTab) => set({ view: "matters", tab });
/** A newly opened matter starts on its Tasks tab, whichever view is showing. */
export const resetMatterTab = () => set({ tab: "tasks" });
export const toggleRail = () => set({ railOpen: !shell.railOpen });
/** A new thread with an agent's opening line ready (and, for the collection, its table beside it). */
export const startThread = (opening: string | null, output: Output | null = null) => set({ view: "assistant", output, railOpen: false, opening });
export const clearOpening = () => set({ opening: null });

/**
 * Opening a matter normally brings its thread to the front (LegalApp.tsx useFollowTheWork). A Space in
 * the sidebar opens the matter view instead: it says so here first, and the follow reads it once.
 */
let pendingView: View | null = null;
export const openMatterIn = (view: View) => {
  pendingView = view;
};
export const takePendingView = (): View | null => {
  const view = pendingView;
  pendingView = null;
  return view;
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useShell = () => useSyncExternalStore(subscribe, () => shell, () => shell);
