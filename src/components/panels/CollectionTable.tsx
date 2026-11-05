// Concept: a review table across a collection. One row per document, one column per question, and
// every answered cell is a short answer, the contract's own words and a § cite that opens the passage.
// The agent fills it one cell per tool call (copilot/useCollectionTools.ts), so a cell is empty,
// being read, or answered; the answers come from lib/collection.ts and the store only records which
// cells are filled. The same table sits beside the collection's thread and on the Collections page.

"use client";

import { LoaderCircle } from "lucide-react";
import { Tag } from "@/components/ui/Card";
import { dateLabel, shortDate } from "@/components/ui/format";
import { CiteChip } from "@/components/ui/LegalTags";
import {
  COLLECTION_DOCS,
  COLUMNS,
  answerCell,
  cellKey,
  securityNote,
  securityStatus,
  type CollectionDoc,
  type ColumnKey,
  type SecurityStatus,
} from "@/lib/collection";
import { getLibrary } from "@/lib/library";
import { useAppState } from "@/lib/store";

/**
 * `wide`: the Collections page, every column, the agreement under each vendor. Beside the thread the
 * table is narrower: once a question has been asked it shows only the columns being answered (a
 * security question fills one), so every row fits beside the chat.
 */
/** The columns a question has asked so far (filled or being read), in table order. */
export function askedColumns(cells: readonly string[], working: string | null) {
  return COLUMNS.filter(
    (c) =>
      cells.some((k) => k.endsWith(`:${c.key}`)) ||
      working?.endsWith(`:${c.key}`),
  );
}

export function CollectionTable({ wide = false }: { wide?: boolean }) {
  const state = useAppState();
  const asked = askedColumns(state.collectionCells, state.collectionWorking);
  const columns = wide || asked.length === 0 ? COLUMNS : asked;
  const hidden = COLUMNS.length - columns.length;
  const nothingAsked = asked.length === 0;
  return (
    <div
      className="overflow-x-auto"
      data-testid="collection-table"
      data-columns={columns.length}
    >
      <table
        className={`w-full table-fixed border-collapse text-left ${wide ? "min-w-[1040px]" : columns.length > 2 ? "min-w-[820px]" : ""}`}
      >
        <colgroup>
          <col className={wide ? "w-[196px]" : "w-[188px]"} />
          {columns.map((c) => (
            <col key={c.key} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b border-hairline text-small text-muted">
            <th className="py-2 pr-3 align-bottom font-medium">Document</th>
            {columns.map((c) => (
              <th
                key={c.key}
                className="py-2 pr-3 align-bottom font-medium"
                title={c.question}
              >
                <span className="block text-ink">{c.label}</span>
                {wide && (
                  <span className="mt-0.5 block font-normal [text-wrap:pretty]">
                    {c.question}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COLLECTION_DOCS.map((doc, row) => (
            <tr
              key={doc.id}
              className="border-b border-hairline align-top last:border-b-0"
              data-testid="collection-row"
              data-doc={doc.id}
            >
              <th
                scope="row"
                className="py-3 pr-3 text-left font-normal"
                title={doc.agreement}
              >
                <span className="block font-medium text-ink">{doc.vendor}</span>
                {wide && (
                  <span className="block text-small text-muted">
                    {doc.agreement}
                  </span>
                )}
                <span className="mt-0.5 block text-small text-muted">
                  {doc.signed
                    ? `Signed ${wide ? dateLabel(doc.signed) : shortDate(doc.signed)}`
                    : "In review"}{" "}
                  ·{" "}
                  {doc.holdsCustomerData ? "customer data" : "no customer data"}
                </span>
              </th>
              {nothingAsked
                ? row === 0 && (
                    <td
                      rowSpan={COLLECTION_DOCS.length}
                      colSpan={columns.length}
                      className="py-3 pr-3 align-top"
                      data-testid="collection-empty"
                    >
                      <p className="text-muted">
                        Nothing asked yet. Ask in a thread and the copilot
                        answers each cell from the contract, with its words and
                        the passage they come from.
                      </p>
                    </td>
                  )
                : columns.map((c) => (
                    <td key={c.key} className="py-3 pr-3">
                      <CellView
                        doc={doc}
                        column={c.key}
                        filled={state.collectionCells.includes(
                          cellKey(doc.id, c.key),
                        )}
                        working={
                          state.collectionWorking === cellKey(doc.id, c.key)
                        }
                        security={
                          c.key === "securityEvidence"
                            ? securityStatus(
                                doc,
                                state,
                                getLibrary().history ?? [],
                              )
                            : null
                        }
                      />
                    </td>
                  ))}
            </tr>
          ))}
        </tbody>
      </table>
      {hidden > 0 && (
        <p
          className="border-t border-hairline py-2 text-small text-muted"
          data-testid="collection-hidden"
        >
          Showing the {columns.map((c) => c.label).join(", ")}{" "}
          {columns.length === 1 ? "question" : "questions"}; the other {hidden}{" "}
          are on the Collections page. Each answer quotes the contract, and its
          § cite shows the passage.
        </p>
      )}
    </div>
  );
}

/**
 * `security`: for the security column, where the evidence stands (lib/collection.ts): received after
 * a send-back (with the date, from the history), requested with the redlines, or still to ask for.
 */
function CellView({
  doc,
  column,
  filled,
  working,
  security,
}: {
  doc: CollectionDoc;
  column: ColumnKey;
  filled: boolean;
  working: boolean;
  security: SecurityStatus | null;
}) {
  if (!filled) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-small text-muted"
        data-testid="collection-cell"
        data-column={column}
        data-state={working ? "working" : "empty"}
      >
        {working ? (
          <>
            <LoaderCircle
              aria-hidden
              className="work-spinner size-3"
              strokeWidth={2.25}
            />
            Reading
          </>
        ) : (
          <span aria-label="Not asked yet">—</span>
        )}
      </span>
    );
  }
  const cell = answerCell(doc.id, column);
  const note = security ? securityNote(security) : null;
  return (
    <div
      className="row-settle min-w-0"
      data-testid="collection-cell"
      data-column={column}
      data-state="filled"
    >
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-medium text-ink" data-testid="cell-answer">
          {cell.answer}
        </span>
        {security?.kind === "missing" && (
          <Tag tone="amber" data-testid="not-on-file">
            Not on file
          </Tag>
        )}
        {note && (
          <span className="text-small text-muted" data-testid="security-note">
            {note}
          </span>
        )}
      </p>
      <p className="mt-1 text-small text-muted [text-wrap:pretty]">
        <span data-testid="cell-quote">
          {cell.quotes.map((q, i) => (
            <span key={i}>
              {i > 0 && " … "}“{q}”
            </span>
          ))}
        </span>{" "}
        <CiteChip
          matterId={doc.id}
          cite={cell.cite}
          quote={cell.quotes[0]}
          openable={false}
          className="align-middle"
        />
      </p>
    </div>
  );
}
