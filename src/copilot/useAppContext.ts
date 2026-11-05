// Concept: app context. The agent knows who the user is, which matters exist, the matter open in the
// workspace (its plan, findings, redlines, reasons and approvals) and the rules a person published.
//
// useAgentContext sends each value with every run. When the app state changes, the next run sees the
// new value: nothing to sync by hand. The entries are built in lib/app-context.ts, which fences text
// people typed as quoted data. Static knowledge (the written playbook) lives in the agent's
// instructions on the server instead: see lib/agent-instructions.ts.

import { useAgentContext } from "@copilotkit/react-core/v2";
import { appContext } from "@/lib/app-context";
import { getLibrary } from "@/lib/library";
import { useAppState } from "@/lib/store";

export function useAppContext() {
  const context = appContext(useAppState(), getLibrary().history ?? []);
  useAgentContext(context.user);
  useAgentContext(context.matters);
  useAgentContext(context.activeMatter);
  useAgentContext(context.learnedRules);
  useAgentContext(context.analytics);
  useAgentContext(context.collections);
}
