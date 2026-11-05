// The Collections page and the collection's output beside its thread: the same review table
// (CollectionTable.tsx) in two places. On the page, "Ask in a thread" opens the collection's thread
// with the table beside it and the question ready; beside the thread, the table fills as the agent
// answers it.

"use client";

import { MessageSquareText, X } from "lucide-react";
import { closeOutput, startThread } from "@/components/shell-state";
import { Button } from "@/components/ui/Card";
import { COLLECTION_DOCS, COLLECTION_NAME, COLUMNS } from "@/lib/collection";
import { openCollection, useAppState } from "@/lib/store";
import { CollectionTable, askedColumns } from "./CollectionTable";

const CELLS = COLLECTION_DOCS.length * COLUMNS.length;

/** Open the collection's thread, its table beside it and, while nothing is filled, the question ready. */
export function openCollectionThread() {
  openCollection();
  startThread(null, "collection");
}

function meta(filled: number) {
  const signed = COLLECTION_DOCS.filter((d) => d.signed).length;
  return `${COLLECTION_DOCS.length} documents (${signed} signed, ${COLLECTION_DOCS.length - signed} in review) · ${COLUMNS.length} questions · ${filled ? `${filled} of ${CELLS} cells answered` : "nothing asked yet"}`;
}

export function CollectionsPanel() {
  const { collectionCells } = useAppState();
  return (
    <section className="rounded-md border border-hairline bg-surface" data-testid="collection" data-collection="vendor-contracts-2026">
      <header className="flex flex-wrap items-start gap-x-6 gap-y-3 border-b border-hairline px-5 py-4 @3xl:px-6">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-ink">{COLLECTION_NAME}</h2>
          <p className="text-small text-muted" data-testid="collection-meta">
            {meta(collectionCells.length)}
          </p>
        </div>
        <Button variant="primary" onClick={openCollectionThread} data-testid="collection-ask">
          <MessageSquareText aria-hidden className="size-4" strokeWidth={2} />
          Ask in a thread
        </Button>
      </header>
      <div className="px-5 py-2 @3xl:px-6">
        <CollectionTable wide />
      </div>
    </section>
  );
}

/** Beside the collection's thread: the table the agent is filling, counted by the questions on screen. */
export function CollectionOutput() {
  const { collectionCells, collectionWorking } = useAppState();
  const asked = askedColumns(collectionCells, collectionWorking);
  const answered = collectionCells.filter((k) => asked.some((c) => k.endsWith(`:${c.key}`))).length;
  return (
    <section aria-label="Review table" className="@container flex min-h-0 min-w-0 flex-1 flex-col bg-paper" data-testid="output-panel" data-output="collection">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-hairline bg-paper px-4">
        <p className="min-w-0 truncate">
          <span className="font-semibold text-ink">{COLLECTION_NAME}</span>
          <span className="text-small text-muted" data-testid="collection-count">
            {" "}
            · {asked.length ? `${asked.map((c) => c.label).join(", ")} · ${answered} of ${asked.length * COLLECTION_DOCS.length} answered` : "review table · nothing asked yet"}
          </span>
        </p>
        <button type="button" onClick={closeOutput} aria-label="Close the review table" title="Close" className="ml-auto inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-stone hover:text-ink" data-testid="close-output">
          <X aria-hidden className="size-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4" data-testid="output-scroll">
        <div className="mt-4 rounded-md border border-hairline bg-surface px-4 py-1">
          <CollectionTable />
        </div>
      </div>
    </section>
  );
}
