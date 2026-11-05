// Concept: connect the app and the agent. CopilotKitProvider points the React app at the runtime
// (app/api/copilotkit). Everything rendered inside it can give the agent context, tools and UI:
// CopilotWiring registers all of it. The app itself stays an ordinary React app, in the shell of
// the category: a black labelled sidebar (New thread, Agents, Collections, Analytics, Playbooks,
// Recents, Spaces, and the signed-in user), and a view for each item on the warm off-white. The
// assistant view puts the copilot's thread at the centre, with its plan and work on a right rail; a
// Space is the matter as a workspace, with its tasks assigned to the copilot and to people.

"use client";

import { CopilotKitProvider } from "@copilotkit/react-core/v2";
import { Archive, BookMarked, Bot, ChartNoAxesColumn, ChevronRight, ChevronsUpDown, FolderClosed, Menu, MessageSquareText, PanelRight, SquarePen, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AssistantView } from "@/components/AssistantView";
import { useCiteFocus } from "@/components/cite-focus";
import { MatterView } from "@/components/MatterView";
import { AgentsPanel } from "@/components/panels/AgentsPanel";
import { AnalyticsPanel } from "@/components/panels/AnalyticsPanel";
import { CollectionsPanel } from "@/components/panels/CollectionsPanel";
import { InsightsPanel } from "@/components/panels/InsightsPanel";
import { MatterQueue } from "@/components/panels/MatterQueue";
import { PlaybookPanel } from "@/components/panels/PlaybookPanel";
import { ResetBoundary } from "@/components/ResetBoundary";
import { clearOpening, closeOutput, getShell, goTo, openMatterIn, openOutput, resetMatterTab, setMatterTab, takePendingView, toggleRail, useShell, type View } from "@/components/shell-state";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Card";
import { OpenMark } from "@/components/ui/LegalTags";
import { CopilotWiring } from "@/copilot/CopilotWiring";
import { useDecisionEvents } from "@/copilot/useDecisionEvents";
import { IntelligenceNotice } from "@/components/IntelligenceNotice";
import type { IntelligencePublic } from "@/lib/intelligence";
import { useWaitingGate } from "@/copilot/gate-state";
import { useTellCopilot } from "@/copilot/useTellCopilot";
import { COLLECTION_NAME } from "@/lib/collection";
import { CURRENT_USER, DISCLAIMER } from "@/lib/company";
import type { PastReview } from "@/lib/learning";
import { loadLibrary, type Library } from "@/lib/library";
import { getMatter, matterTitle } from "@/lib/matters";
import { appStore, closeMatter, openMatter, pendingProposals, queueMatterIds, resetDemo, useAppState } from "@/lib/store";

/** `intelligence`: CopilotKit Intelligence, from the server switch (lib/intelligence.ts). Absent or off: none of it runs. */
type Props = { library: Library; history: PastReview[]; chatEnabled: boolean; model: string; intelligence?: IntelligencePublic };

export function LegalApp({ library, history, chatEnabled, model, intelligence }: Props) {
  // The contracts and the playbook, read on the server: the tools and panels read them from here.
  useState(() => loadLibrary({ ...library, history }));
  const [hydrated, setHydrated] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    appStore.hydrate(); // localStorage is browser-only, so load the saved demo after the first render
    if (appStore.getState().activeMatterId) goTo("assistant");
    else if (appStore.getState().activeCollectionId) openOutput("collection");
    setHydrated(true);
  }, []);

  const onError = useCallback(({ error }: { error: Error }) => setChatError(error.message), []);
  // With Intelligence on, the provider records a Trajectory; a capture failure is shown, never swallowed.
  const [captureError, setCaptureError] = useState<string | null>(null);
  const learning = useMemo(
    () =>
      intelligence?.enabled
        ? {
            onError: ({ code }: { code: string }) => {
              console.error(`[intelligence] Trajectory capture failed: ${code}`);
              setCaptureError(`Trajectory capture failed (${code}), so decisions are not reaching Automatic Learning. The demo itself carries on.`);
            },
          }
        : null,
    [intelligence?.enabled],
  );
  const dismissError = useCallback(() => setChatError(null), []);

  return (
    // enableInspector: set to true to watch the AG-UI event stream in a floating panel while you demo.
    <CopilotKitProvider runtimeUrl="/api/copilotkit" onError={onError} enableInspector={false} {...(learning ? { learning } : {})}>
      <CopilotWiring />
      <div className="flex h-dvh overflow-hidden bg-paper text-ink">
        <Sidebar history={history} open={navOpen} onClose={() => setNavOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar onMenu={() => setNavOpen(true)} />
          <IntelligenceNotice intelligence={intelligence} captureError={captureError} onDismissCapture={() => setCaptureError(null)} />
          <div className="relative flex min-h-0 flex-1">
            {hydrated ? (
              <Shell history={history} chatEnabled={chatEnabled} model={model} chatError={chatError} onDismissError={dismissError} decisionEvents={Boolean(intelligence?.enabled)} />
            ) : (
              <div className="flex-1" />
            )}
          </div>
        </div>
      </div>
    </CopilotKitProvider>
  );
}

function Shell({
  history,
  chatEnabled,
  model,
  chatError,
  onDismissError,
  decisionEvents,
}: {
  history: PastReview[];
  chatEnabled: boolean;
  model: string;
  chatError: string | null;
  onDismissError: () => void;
  decisionEvents: boolean;
}) {
  useDecisionEvents(decisionEvents); // Intelligence on: each new decision goes to the Trajectory
  const { view } = useShell();
  const state = useAppState();
  const tellCopilot = useTellCopilot(chatEnabled);
  useFollowTheWork();

  return (
    <>
      {/* The assistant stays mounted in every view: the thread and its waiting cards live in it. */}
      <ResetBoundary className={`min-h-0 flex-1 ${view === "assistant" ? "flex" : "hidden"}`}>
        <AssistantView model={model} error={chatError} onDismissError={onDismissError} onHumanEdit={tellCopilot} hidden={view !== "assistant"} />
      </ResetBoundary>
      {view !== "assistant" && (
        <ResetBoundary className="min-h-0 flex-1 overflow-y-auto">
          <main className="@container min-h-0 min-w-0 flex-1 overflow-y-auto px-6 pb-10 pt-6" data-testid="workspace">
            {view === "matters" &&
              (state.activeMatterId ? (
                <MatterView history={history} onHumanEdit={tellCopilot} />
              ) : (
                <Page title="Vendor contracts" lede="Reviewed against the Northstar vendor playbook, routed by its rules.">
                  <MatterQueue
                    history={history}
                    onOpen={(id) => {
                      openMatter(id);
                      goTo("assistant");
                    }}
                  />
                </Page>
              ))}
            {view === "playbook" && (
              <Page title="Playbooks" lede="The positions the copilot checks every vendor contract against, and the rules proposed from approvers' send-backs." narrow>
                <div className="space-y-6">
                  <InsightsPanel history={history} />
                  <PlaybookPanel />
                </div>
              </Page>
            )}
            {view === "agents" && (
              <Page title="Agents" lede="The jobs this copilot does, each with what it reads, what waits for a person, and the tools it calls. Start opens a thread with its first line ready.">
                <AgentsPanel history={history} />
              </Page>
            )}
            {view === "collections" && (
              <Page title="Collections" lede="Sets of documents asked the same questions. The copilot answers each cell from the document, with its words and the passage they come from.">
                <CollectionsPanel />
              </Page>
            )}
            {view === "analytics" && (
              <Page title="Analytics" lede="How reviews went before Open Harvey went live on Monday, Nov 2, how they've gone since, and who decided what.">
                <AnalyticsPanel history={history} />
              </Page>
            )}
            <p className="mx-auto mt-10 max-w-[1180px] text-small text-muted" data-testid="disclaimer">
              {DISCLAIMER}
            </p>
          </main>
        </ResetBoundary>
      )}
    </>
  );
}

/** A content page: a large serif title, a line under it, then its sheets. */
function Page({ title, lede, narrow = false, children }: { title: string; lede?: string; narrow?: boolean; children: ReactNode }) {
  return (
    <div className={`mx-auto ${narrow ? "max-w-[960px]" : "max-w-[1180px]"}`}>
      <header className="mb-5">
        <h1 className="font-serif text-display tracking-[-0.01em] text-ink" data-testid="page-title">
          {title}
        </h1>
        {lede && <p className="mt-1 text-muted">{lede}</p>}
      </header>
      {children}
    </div>
  );
}

/**
 * The app follows the work: opening a matter shows its assistant thread (or its matter view, when a
 * Space in the sidebar opened it); a plan or send card waiting
 * for a click brings the thread to the front; a cite chip opens the contract beside the thread (or
 * on the matter's Contract tab, from the matter view).
 */
function useFollowTheWork() {
  const state = useAppState();
  const cite = useCiteFocus();
  const gate = useWaitingGate();
  const seen = useRef({ active: state.activeMatterId, collection: state.activeCollectionId, cite: cite?.n ?? 0, gate: gate ? `${gate.kind}:${gate.matterId}` : null });
  useEffect(() => {
    const before = seen.current;
    const gateKey = gate ? `${gate.kind}:${gate.matterId}` : null;
    if (state.activeMatterId && state.activeMatterId !== before.active) {
      goTo(takePendingView() ?? "assistant");
      closeOutput();
      resetMatterTab();
      clearOpening();
    }
    // The collection's thread opened (readCollection, or Ask in a thread): its review table goes beside it.
    if (state.activeCollectionId && state.activeCollectionId !== before.collection) openOutput("collection");
    if (gateKey && gateKey !== before.gate) {
      goTo("assistant");
      closeOutput();
    }
    if (cite && cite.n !== before.cite) {
      if (getShell().view === "matters") setMatterTab("contract");
      else openOutput("contract");
    }
    seen.current = { active: state.activeMatterId, collection: state.activeCollectionId, cite: cite?.n ?? 0, gate: gateKey };
  }, [state.activeMatterId, state.activeCollectionId, cite, gate]);
}

/** The content area's slim bar: on a phone, the menu; the breadcrumb (Spaces › the open matter); the rail toggle. */
function TopBar({ onMenu }: { onMenu: () => void }) {
  const state = useAppState();
  const { view } = useShell();
  const active = state.activeMatterId ? getMatter(state.activeMatterId) : null;
  const inCollection = view === "assistant" && state.activeCollectionId !== null;
  const inSpaces = !inCollection && (view === "matters" || view === "assistant");
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-hairline bg-paper px-4">
      <button type="button" className="inline-flex size-8 items-center justify-center rounded-md text-ink hover:bg-stone md:hidden" aria-label="Menu" onClick={onMenu} data-testid="menu-button">
        <Menu aria-hidden className="size-4" />
      </button>
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-muted">
        {inSpaces ? (
          <>
            <button
              type="button"
              className="rounded-sm font-medium transition-colors hover:text-ink"
              onClick={() => {
                closeMatter();
                goTo("matters");
              }}
            >
              Spaces
            </button>
            {active && (
              <>
                <ChevronRight aria-hidden className="size-3.5 shrink-0" />
                <button type="button" className="truncate text-ink transition-colors hover:underline" onClick={() => setMatterTab(getShell().tab)} data-testid="breadcrumb-matter">
                  {matterTitle(active)}
                </button>
              </>
            )}
          </>
        ) : inCollection ? (
          <>
            <button type="button" className="rounded-sm font-medium transition-colors hover:text-ink" onClick={() => goTo("collections")}>
              Collections
            </button>
            <ChevronRight aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate text-ink" data-testid="breadcrumb-collection">
              {COLLECTION_NAME}
            </span>
          </>
        ) : (
          <span className="font-medium text-ink">{VIEW_NAMES[view]}</span>
        )}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        {view === "assistant" && (
          <Button variant="ghost" size="sm" className="lg:hidden" aria-label="Plan and work" onClick={toggleRail}>
            <PanelRight aria-hidden className="size-4" />
          </Button>
        )}
      </div>
    </header>
  );
}

const VIEW_NAMES: Record<View, string> = { assistant: "New thread", matters: "Spaces", playbook: "Playbooks", agents: "Agents", collections: "Collections", analytics: "Analytics" };

const NAV: { id: string; view: View; label: string; Icon: typeof Bot }[] = [
  { id: "new-thread", view: "assistant", label: "New thread", Icon: SquarePen },
  { id: "agents", view: "agents", label: "Agents", Icon: Bot },
  { id: "collections", view: "collections", label: "Collections", Icon: Archive },
  { id: "analytics", view: "analytics", label: "Analytics", Icon: ChartNoAxesColumn },
  { id: "playbooks", view: "playbook", label: "Playbooks", Icon: BookMarked },
];

/**
 * The black labelled sidebar. It folds to its icons while an output is open beside the thread, so the
 * review table gets the width; on a phone it is a drawer behind the menu button.
 */
function Sidebar({ history, open, onClose }: { history: PastReview[]; open: boolean; onClose: () => void }) {
  const { view, output } = useShell();
  const state = useAppState();
  const compact = view === "assistant" && output !== null && !open;
  const insights = pendingProposals(state, history);
  const recents = Object.entries(state.matters)
    .sort(([, a], [, b]) => (a.openedAt < b.openedAt ? 1 : -1))
    .map(([id]) => getMatter(id));
  const spaces = queueMatterIds(state).map((id) => getMatter(id));
  const active = state.activeMatterId;
  const go = (fn: () => void) => () => {
    fn();
    onClose();
  };

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-ink/40 md:hidden" onClick={onClose} aria-hidden />}
      <nav
        aria-label="Open Harvey"
        data-testid="sidebar"
        data-compact={compact ? "true" : undefined}
        className={`z-50 flex shrink-0 flex-col bg-night text-on-ink ${compact ? "w-14" : "w-60"} ${open ? "fixed inset-y-0 left-0" : "max-md:hidden"}`}
      >
        <div className={`flex h-14 shrink-0 items-center gap-2.5 ${compact ? "justify-center px-0" : "px-4"}`}>
          <OpenMark size={24} />
          {!compact && <span className="whitespace-nowrap text-body font-semibold tracking-[-0.01em]">Open Harvey</span>}
          {open && (
            <button type="button" className="ml-auto inline-flex size-8 items-center justify-center rounded-md text-night-muted hover:bg-night-raised hover:text-on-ink" aria-label="Close menu" onClick={onClose}>
              <X aria-hidden className="size-4" />
            </button>
          )}
        </div>

        <ul className={`space-y-0.5 ${compact ? "px-2" : "px-2.5"}`}>
          {NAV.map(({ id, view: target, label, Icon }) => {
            // The collection's thread belongs to Collections, not to New thread.
            const inCollection = view === "assistant" && state.activeCollectionId !== null;
            const current = target === "assistant" ? view === "assistant" && !active && !inCollection : target === "collections" ? view === "collections" || inCollection : view === target;
            return (
              <li key={id}>
                <NavItem
                  label={label}
                  compact={compact}
                  current={current}
                  testId={`nav-${id}`}
                  icon={<Icon aria-hidden className="size-[17px] shrink-0" strokeWidth={1.75} />}
                  badge={
                    id === "playbooks" && insights > 0 ? (
                      <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-on-ink px-1 text-small font-semibold leading-none text-ink" data-testid="insights-badge">
                        {insights}
                      </span>
                    ) : null
                  }
                  onClick={go(() => {
                    if (target === "assistant") closeMatter();
                    goTo(target);
                  })}
                />
              </li>
            );
          })}
        </ul>

        {!compact && (
          <div className="mt-5 min-h-0 flex-1 space-y-5 overflow-y-auto px-2.5">
            <Group label="Recents">
              {recents.length === 0 ? (
                <p className="px-2.5 py-1 text-small text-night-muted">No threads yet</p>
              ) : (
                recents.map((m) => (
                  <NavItem
                    key={m.id}
                    label={`${m.vendorShort} review`}
                    current={view === "assistant" && active === m.id}
                    testId={`recent-${m.id}`}
                    icon={<MessageSquareText aria-hidden className="size-[17px] shrink-0" strokeWidth={1.75} />}
                    onClick={go(() => {
                      openMatter(m.id);
                      goTo("assistant");
                    })}
                  />
                ))
              )}
            </Group>
            <Group label="Spaces">
              {spaces.map((m) => (
                <NavItem
                  key={m.id}
                  label={m.vendorShort}
                  current={view === "matters" && active === m.id}
                  testId={`space-${m.id}`}
                  icon={<FolderClosed aria-hidden className="size-[17px] shrink-0" strokeWidth={1.75} />}
                  onClick={go(() => {
                    if (active !== m.id) openMatterIn("matters");
                    openMatter(m.id);
                    goTo("matters");
                  })}
                />
              ))}
              <NavItem
                label="All spaces"
                current={view === "matters" && !active}
                testId="space-all"
                icon={<span aria-hidden className="mx-[2px] size-[13px] shrink-0 rounded-[3px] border border-night-muted" />}
                onClick={go(() => {
                  closeMatter();
                  goTo("matters");
                })}
              />
            </Group>
          </div>
        )}
        {compact && (
          <div className="mt-4 flex-1 space-y-0.5 border-t border-night-line px-2 pt-4">
            {spaces.map((m) => (
              <NavItem
                key={m.id}
                label={m.vendorShort}
                compact
                current={false}
                testId={`space-${m.id}`}
                icon={<FolderClosed aria-hidden className="size-[17px] shrink-0" strokeWidth={1.75} />}
                onClick={() => {
                  if (active !== m.id) openMatterIn("matters");
                  openMatter(m.id);
                  goTo("matters");
                }}
              />
            ))}
          </div>
        )}

        <UserMenu compact={compact} />
      </nav>
    </>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="px-2.5 pb-1 text-small text-night-muted">{label}</h2>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

function NavItem({ label, icon, current, compact = false, testId, badge, onClick }: { label: string; icon: ReactNode; current: boolean; compact?: boolean; testId: string; badge?: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={compact ? label : undefined}
      aria-label={compact ? label : undefined}
      aria-current={current ? "page" : undefined}
      data-testid={testId}
      className={`relative flex h-8 w-full items-center gap-2.5 rounded-md text-left transition-colors duration-150 ${compact ? "justify-center px-0" : "px-2.5"} ${
        current ? "bg-night-raised text-on-ink" : "text-night-muted hover:bg-night-raised hover:text-on-ink"
      }`}
    >
      {icon}
      {!compact && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {badge && <span className={compact ? "absolute -right-0.5 -top-0.5" : ""}>{badge}</span>}
    </button>
  );
}

/** Maya at the foot of the sidebar; her menu holds Reset demo, out of the way of the story. */
function UserMenu({ compact }: { compact: boolean }) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e instanceof MouseEvent && menu.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div ref={menu} className={`relative border-t border-night-line ${compact ? "p-2" : "p-2.5"}`}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-2.5 rounded-md py-1.5 text-left hover:bg-night-raised ${compact ? "justify-center px-0" : "px-2"}`}
        data-testid="user-menu"
        title={compact ? CURRENT_USER.name : undefined}
      >
        <Avatar name={CURRENT_USER.name} size={28} tone="paper" />
        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-on-ink">{CURRENT_USER.name}</span>
              <span className="block truncate text-small text-night-muted">{CURRENT_USER.title}</span>
            </span>
            <ChevronsUpDown aria-hidden className="size-3.5 shrink-0 text-night-muted" />
          </>
        )}
      </button>
      {open && (
        <div role="menu" className="absolute bottom-full left-2.5 z-50 mb-1 w-52 rounded-md border border-hairline bg-surface p-1 text-ink shadow-raised">
          <button
            type="button"
            role="menuitem"
            className="w-full rounded-sm px-2.5 py-1.5 text-left hover:bg-stone"
            onClick={() => {
              if (window.confirm("Reset the demo? This clears the reviews, approvals and published rules.")) resetDemo();
            }}
          >
            Reset demo
          </button>
        </div>
      )}
    </div>
  );
}
