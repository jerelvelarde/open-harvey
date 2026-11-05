// The Agents page: the four jobs the copilot really does (lib/agents.ts), each with what it reads,
// what waits for a person, and the tools it calls. Start opens a new thread with the agent's opening
// line ready as a chip (or, for the collection, its thread with the review table beside it). Nothing
// here runs anything by itself: the line still waits for a click.

"use client";

import { Archive, FilePen, FileText, RotateCcw } from "lucide-react";
import { startThread } from "@/components/shell-state";
import { Button } from "@/components/ui/Card";
import { COLLECTION, REVIEWS_GOING, chipsFor } from "@/copilot/chips";
import { AGENTS, agentToday, type AgentId } from "@/lib/agents";
import { DOCUMENT_ASKS } from "@/lib/demo-script";
import { ACME_ID } from "@/lib/matters";
import type { PastReview } from "@/lib/learning";
import { appStore, closeMatter, useAppState, type AppState } from "@/lib/store";
import { openCollectionThread } from "./CollectionsPanel";

const ICONS: Record<AgentId, typeof FileText> = { "contract-review": FileText, "document-drafting": FilePen, "collection-review": Archive, "send-back-analysis": RotateCcw };

/** The line each agent opens with, from where the story stands. */
function openingLine(id: AgentId, state: AppState): string | null {
  if (id === "collection-review") return state.collectionCells.length ? null : COLLECTION;
  if (id === "send-back-analysis") return REVIEWS_GOING;
  if (id === "document-drafting") return state.matters[ACME_ID]?.planApprovedAt ? DOCUMENT_ASKS.comments : DOCUMENT_ASKS.edit;
  return chipsFor({ ...state, activeMatterId: null, activeCollectionId: null })[0] ?? null;
}

function start(id: AgentId) {
  if (id === "collection-review") return openCollectionThread();
  const line = openingLine(id, appStore.getState());
  closeMatter();
  startThread(line);
}

export function AgentsPanel({ history }: { history: PastReview[] }) {
  const state = useAppState();
  return (
    <div className="grid gap-5 @4xl:grid-cols-2" data-testid="agents">
      {AGENTS.map((agent) => {
        const Icon = ICONS[agent.id];
        const line = openingLine(agent.id, state);
        return (
          <article key={agent.id} className="flex min-w-0 flex-col rounded-md border border-hairline bg-surface px-5 py-4" data-testid="agent-card" data-agent={agent.id}>
            <header className="flex items-start gap-3">
              <span aria-hidden className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-stone text-ink">
                <Icon className="size-4" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <h2 className="font-semibold text-ink">{agent.name}</h2>
                <p className="text-small text-muted" data-testid="agent-today">
                  {agentToday(agent.id, state, history)}
                </p>
              </div>
            </header>
            <p className="mt-3 text-ink [text-wrap:pretty]">{agent.does}</p>
            <dl className="mt-4 space-y-3 border-t border-hairline pt-3">
              <div>
                <dt className="text-small font-medium text-muted">Reads</dt>
                <dd className="mt-0.5 text-ink">{agent.reads}</dd>
              </div>
              <div>
                <dt className="text-small font-medium text-muted">Waits for a person</dt>
                <dd className="mt-0.5">
                  <ul className="space-y-1">
                    {agent.gates.map((g) => (
                      <li key={g} className="text-ink">
                        {g}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div>
                <dt className="text-small font-medium text-muted">Tools it calls</dt>
                <dd className="mt-1" data-testid="agent-tools">
                  {agent.tools.length ? (
                    // The global .font-mono rule keeps an id on one line; a list of tool names wraps.
                    <p className="font-mono text-small leading-relaxed text-ink" style={{ whiteSpace: "normal" }}>
                      {agent.tools.join(", ")}
                    </p>
                  ) : (
                    <span className="text-ink">None: it answers from the app context (useAgentContext).</span>
                  )}
                </dd>
              </div>
            </dl>
            <footer className="mt-auto pt-4">
              <div className="flex items-end gap-3 border-t border-hairline pt-3">
                <p className="min-w-0 flex-1 text-small text-muted" data-testid="agent-opening">
                  {line ? (
                    <>
                      Opens with <span className="text-ink">“{line}”</span>
                    </>
                  ) : agent.id === "collection-review" ? (
                    "Opens the collection's thread"
                  ) : (
                    "Opens a new thread"
                  )}
                </p>
                <Button variant="primary" size="sm" onClick={() => start(agent.id)} data-testid={`agent-start-${agent.id}`}>
                  Start
                </Button>
              </div>
            </footer>
          </article>
        );
      })}
    </div>
  );
}
