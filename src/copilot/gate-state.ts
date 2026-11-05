// Which gate card the copilot is waiting on, if any: the plan card (useProposePlan.tsx) or the send
// card (useRequestApproval.tsx). The card sets it while it waits for a click; the page reads it, so it
// shows one primary action at a time: while a card waits, the matter header's button steps back and
// says where to click, and the rail's Plan says the plan is waiting for approval.
// Plain module state with useSyncExternalStore; it is UI state only and never persisted.

import { useSyncExternalStore } from "react";

export type Gate = { kind: "plan" | "send"; matterId: string };

let waiting: Gate | null = null;
const listeners = new Set<() => void>();

function set(next: Gate | null) {
  if (next?.kind === waiting?.kind && next?.matterId === waiting?.matterId) return;
  waiting = next;
  listeners.forEach((listener) => listener());
}

export const gateOpened = (gate: Gate) => set(gate);

export function gateClosed(gate: Gate) {
  if (waiting?.kind === gate.kind && waiting.matterId === gate.matterId) set(null);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The gate card waiting for a click, or null. */
export const useWaitingGate = () => useSyncExternalStore(subscribe, () => waiting, () => null);
