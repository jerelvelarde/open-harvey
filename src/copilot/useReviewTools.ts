// Concept: frontend tools. The agent calls them; they run here in the browser, call the pure
// functions in lib/review.ts and lib/plan.ts, and read or write the shared store. The model picks
// the inputs; the code does the analysis. The handlers and their parameter schemas live in
// lib/agent-tools.ts as plain functions, so the tests run exactly what the agent runs.
//
// runPlanTask is the checklist: each call ticks one step in the rail's Plan. It marks the task working,
// holds a short beat so a person can watch the row move, then runs it. It refuses before the plan is
// approved, so "nothing runs until Maya clicks" is enforced in code, not only in the prompt.
//
// About the empty deps arrays: each handler reads appStore.getState() when it runs, so nothing from
// render scope can go stale.

import { useFrontendTool } from "@copilotkit/react-core/v2";
import { toolHandlers, toolSchemas } from "@/lib/agent-tools";
import { startTask } from "@/lib/store";

/** How long a task shows "Working" before its result: about half a second a task with the model's own beat. */
const TASK_BEAT_MS = 320;
const beat = () => new Promise((resolve) => setTimeout(resolve, TASK_BEAT_MS));

export function useReviewTools() {
  useFrontendTool(
    {
      name: "readMatter",
      description:
        "Open a matter in the workspace and read what it is: the document, its sections and words, the vendor, the business owner, the annual fee, the term and the total contract value (worked out in code).",
      parameters: toolSchemas.readMatter,
      handler: async (args) => toolHandlers.readMatter(args),
    },
    [],
  );

  useFrontendTool(
    {
      name: "runPlanTask",
      description:
        "Run one task of the approved review plan and tick it in the Plan. Returns what it found (pass or deviation, risk, the cited passage, the one-line finding) and the next taskId (null when the review has run; the last task, sending the redline package to the vendor, waits for every approval). Refuses before the user approves the plan, and runs tasks in plan order only.",
      parameters: toolSchemas.runPlanTask,
      handler: async (args) => {
        if (startTask(args.matterId, args.taskId)) await beat();
        return toolHandlers.runPlanTask(args);
      },
    },
    [],
  );

  useFrontendTool(
    {
      name: "recheckRedline",
      description:
        "Re-check a redline against its playbook rule after the user edits it. Returns whether it still deviates, the rule's detail, who needs a reason (PB-APR-01) and whether one was given.",
      parameters: toolSchemas.recheckRedline,
      handler: async (args) => toolHandlers.recheckRedline(args),
    },
    [],
  );

  useFrontendTool(
    {
      name: "setDeviationReason",
      description: "Record, in the user's words, why Northstar accepts a deviation. The General Counsel reads it (PB-APR-01). Returns what is still to explain.",
      parameters: toolSchemas.setDeviationReason,
      handler: async (args) => toolHandlers.setDeviationReason(args),
    },
    [],
  );

  useFrontendTool(
    {
      name: "updateRedline",
      description:
        "Rewrite a proposed redline. A redline the user wrote is not changed unless userAsked is true; it comes back refused, with the user's text, so you can ask first.",
      parameters: toolSchemas.updateRedline,
      handler: async (args) => toolHandlers.updateRedline(args),
    },
    [],
  );
}
