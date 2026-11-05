// Concept: one tool call per cell. The collection review table (lib/collection.ts) asks the same
// questions of every document in Vendor contracts 2026. The agent opens it with readCollection (the
// table opens beside the thread) and answers it with fillCollectionCell, one call for each cell, so
// the table fills in front of the person, cell by cell, each with its citation.
//
// The model chooses which cells to fill (one column for a narrow question, all six for a full
// review); the handler works out the answer from the document's terms. Like runPlanTask, a cell
// shows as working for a short beat before its answer lands. Both handlers are plain functions in
// lib/agent-tools.ts, so the tests run exactly what the agent runs.

import { useFrontendTool } from "@copilotkit/react-core/v2";
import { toolHandlers, toolSchemas } from "@/lib/agent-tools";
import { startCell } from "@/lib/store";

/** How long a cell shows "Reading" before its answer. */
const CELL_BEAT_MS = 220;
const beat = () => new Promise((resolve) => setTimeout(resolve, CELL_BEAT_MS));

export function useCollectionTools() {
  useFrontendTool(
    {
      name: "readCollection",
      description:
        "Open a collection of documents and its review table beside the thread. Returns the documents (vendor, agreement, signed or in review, whether the vendor holds customer data) and the table's columns, each a question asked of every document.",
      parameters: toolSchemas.readCollection,
      handler: async (args) => toolHandlers.readCollection(args),
    },
    [],
  );

  useFrontendTool(
    {
      name: "fillCollectionCell",
      description:
        "Answer one cell of the collection's review table: one document, one column. Returns a short answer, the § cite and the document's exact words. Call it once per cell; fill only the columns the question needs.",
      parameters: toolSchemas.fillCollectionCell,
      handler: async (args) => {
        if (startCell(args.docId, args.column)) await beat();
        return toolHandlers.fillCollectionCell(args);
      },
    },
    [],
  );
}
