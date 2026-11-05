// The right rail of the assistant view: the plan as a live checklist, and the work it has made. The
// rail scrolls as a whole; nothing in it is cut by an inner scroller.
// - Plan: "waiting for approval" while the plan card waits (the card is the one place its steps are
//   read), then "7 of 17" as it runs. Shown: the running step, every step that found a deviation
//   (with its risk, never struck through), the learned step, the next three queued, and task 17 held
//   for the approvers, each risk chip in one right-hand column. The rest fold into "9 queued" and "10 done".
// - Work: the review table, the contract and the approvals, each once it exists.
// - One closing line: what the review is checked against, and the model.
// Every count is lib/store.ts matterCounts or the plan itself, the same numbers as everywhere else.

"use client";

import { BookMarked, ChevronDown, CircleCheck, CircleDashed, Clock, FileText, LoaderCircle, Route, Table2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { openOutput, toggleRail, type Output } from "@/components/shell-state";
import { Tag } from "@/components/ui/Card";
import { LearnedTag, taskChip } from "@/components/ui/LegalTags";
import { plural } from "@/components/ui/format";
import { useWaitingGate } from "@/copilot/gate-state";
import { getContract } from "@/lib/library";
import { CHECK_RULE_IDS } from "@/lib/playbook";
import { matterCounts, useAppState, type MatterView, type TaskView } from "@/lib/store";

/** Learned steps already introduced, per matter, so the highlight plays once. */
const introduced = new Set<string>();

/** How many queued steps show ahead of the running one; the rest fold into "N queued". */
const AHEAD = 3;

export function RightRail({ view, model, open }: { view: MatterView | null; model: string; open: boolean }) {
  const gate = useWaitingGate();
  const waitingPlan = Boolean(view && gate?.kind === "plan" && gate.matterId === view.matter.id);
  const progress = !view ? "no matter open" : view.planApproved ? `${view.doneCount} of ${view.plan.length} done` : waitingPlan ? "waiting for approval" : "not started";
  return (
    <aside
      aria-label="This review"
      data-testid="right-rail"
      className={`flex w-80 shrink-0 flex-col overflow-y-auto border-l border-hairline bg-paper max-lg:fixed max-lg:bottom-0 max-lg:right-0 max-lg:top-12 max-lg:z-30 ${open ? "" : "max-lg:hidden"}`}
    >
      {open && (
        <div className="flex justify-end px-4 pt-3 lg:hidden">
          <button type="button" className="text-small font-medium text-muted hover:text-ink" onClick={toggleRail}>
            Close
          </button>
        </div>
      )}
      <Section title="Plan" aside={progress} testId="rail-plan">
        {view?.planApproved ? <Plan view={view} /> : null}
      </Section>
      {view && (
        <Section title="Work" testId="rail-work">
          <Work view={view} />
        </Section>
      )}
      <About view={view} model={model} />
    </aside>
  );
}

function Section({ title, aside, testId, children }: { title: string; aside?: string; testId: string; children: ReactNode }) {
  return (
    <section className="border-b border-hairline px-4 py-3" data-testid={testId}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold text-ink" data-testid={`${testId}-title`}>
          {title}
        </h2>
        {aside && (
          <span className="text-small text-muted tabular-nums" data-testid={`${testId}-progress`}>
            {aside}
          </span>
        )}
      </div>
      {children && <div className="mt-2">{children}</div>}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Plan

function Plan({ view }: { view: MatterView }) {
  const attention = view.plan.filter((t) => t.outcome?.status === "attention").length;
  const doneAtMount = useRef(new Set(view.plan.filter((t) => t.status === "done").map((t) => t.id)));
  const [showDone, setShowDone] = useState(false);
  const [showQueued, setShowQueued] = useState(false);

  // What stays in view: the work that needs a person or is happening now, and what is next.
  const firstQueued = view.plan.findIndex((t) => t.status === "queued");
  const ahead = new Set(firstQueued === -1 ? [] : view.plan.slice(firstQueued).filter((t) => t.status === "queued").slice(0, AHEAD).map((t) => t.id));
  const shown = (t: TaskView) => t.status === "working" || t.status === "held" || t.outcome?.status === "attention" || Boolean(t.learned) || ahead.has(t.id);
  const listed = view.plan.filter(shown);
  const done = view.plan.filter((t) => !shown(t) && t.status === "done");
  const queued = view.plan.filter((t) => !shown(t) && t.status === "queued");

  // A plan with a learned step: highlight it once, when it first shows (the epilogue).
  const learned = view.plan.find((t) => t.learned);
  const learnedKey = learned ? `${view.matter.id}:${learned.id}` : null;
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (!learnedKey || introduced.has(learnedKey)) return;
    const timer = setTimeout(() => {
      introduced.add(learnedKey); // marked when it lands, so a cancelled effect (React strict mode) still lands once
      setFlash(true);
    }, 120);
    return () => clearTimeout(timer);
  }, [learnedKey]);

  return (
    <div data-testid="plan-steps">
      {attention > 0 && (
        <p className="mb-1.5 text-small text-muted" data-testid="plan-status">
          {plural(attention, "step needs", "steps need")} a decision
        </p>
      )}
      <ol className="space-y-0.5">
        {listed.map((task) => (
          <Step key={task.id} task={task} settle={!doneAtMount.current.has(task.id)} flash={flash && Boolean(task.learned)} />
        ))}
      </ol>
      {queued.length > 0 && <Fold label={`${queued.length} queued`} open={showQueued} onToggle={() => setShowQueued((v) => !v)} tasks={queued} testId="queued-group" />}
      {done.length > 0 && <Fold label={`${done.length} done`} open={showDone} onToggle={() => setShowDone((v) => !v)} tasks={done} testId="done-group" settle={(id) => !doneAtMount.current.has(id)} />}
    </div>
  );
}

function Fold({ label, open, onToggle, tasks, testId, settle }: { label: string; open: boolean; onToggle: () => void; tasks: TaskView[]; testId: string; settle?: (id: string) => boolean }) {
  return (
    <div className="mt-1 border-t border-hairline pt-1">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-2 py-[3px] text-left text-small font-medium text-muted hover:text-ink" data-testid={testId}>
        <ChevronDown aria-hidden className={`size-3.5 transition-transform duration-200 ${open ? "" : "-rotate-90"}`} />
        {label}
      </button>
      <ol className="space-y-0.5" hidden={!open}>
        {tasks.map((task) => (
          <Step key={task.id} task={task} settle={settle?.(task.id) ?? false} flash={false} />
        ))}
      </ol>
    </div>
  );
}

function Step({ task, settle, flash }: { task: TaskView; settle: boolean; flash: boolean }) {
  const chip = taskChip(task);
  const done = task.status === "done";
  const struck = done && !chip.attention && !task.learned; // a row with a risk tag, or the learned row, is never struck through
  const marker =
    task.status === "working" ? (
      <LoaderCircle aria-hidden className="work-spinner size-3.5 text-ink" strokeWidth={2.25} />
    ) : task.learned ? (
      <BookMarked aria-hidden className={`size-3.5 ${done ? "text-muted" : "text-ink"}`} strokeWidth={2} />
    ) : task.status === "held" ? (
      <Clock aria-hidden className="size-3.5 text-muted" strokeWidth={2} />
    ) : done ? (
      <CircleCheck aria-hidden className="size-3.5 text-muted" strokeWidth={2} />
    ) : (
      <CircleDashed aria-hidden className="size-3.5 text-muted" strokeWidth={2} />
    );
  return (
    <li data-step={task.id} data-status={chip.attention ? "attention" : task.status} className="grid grid-cols-[14px_minmax(0,1fr)_auto] items-start gap-x-2 py-[2px]">
      <span className="flex h-[21px] items-center">{marker}</span>
      <span className="min-w-0">
        <span className={`block ${struck ? `text-muted line-through decoration-rule ${settle ? "strike-in" : ""}` : task.status === "held" ? "text-muted" : "text-ink"}`}>
          <span className={flash ? "figure-flash" : ""} data-testid={task.learned ? "learned-step" : undefined}>
            {task.title}
          </span>
        </span>
        {task.learned && <LearnedTag id={task.learned.id} version={task.learned.version} className="mt-0.5" />}
      </span>
      <span className="flex min-w-[52px] justify-end pt-px">
        {chip.attention && (
          <Tag tone={chip.tone} data-tone={chip.tone}>
            {chip.label}
          </Tag>
        )}
      </span>
    </li>
  );
}

// ---------------------------------------------------------------------------------------------
// Work: each object once it exists

function Row({ Icon, label, meta, onClick, testId }: { Icon: typeof Table2; label: string; meta: string; onClick: () => void; testId?: string }) {
  return (
    <li>
      <button type="button" onClick={onClick} data-testid={testId} className="flex w-full items-baseline gap-2.5 rounded-sm py-[5px] text-left transition-colors hover:bg-stone/60">
        <Icon aria-hidden className="size-4 shrink-0 self-center text-ink" strokeWidth={1.75} />
        <span className="shrink-0 font-medium text-ink">{label}</span>
        <span className="ml-auto min-w-0 truncate text-right text-small text-muted">{meta}</span>
      </button>
    </li>
  );
}

function Work({ view }: { view: MatterView }) {
  const counts = matterCounts(view);
  const contract = getContract(view.matter.id);
  const routed = view.plan.find((t) => t.id === "route")?.status === "done";
  const sub = view.state?.submission;
  const rows: { id: Output; label: string; meta: string; Icon: typeof Table2 }[] = [
    ...(view.planApproved
      ? [
          {
            id: "review" as const,
            label: "Review table",
            meta: `${plural(counts.deviations, "deviation")}${counts.learned ? ` · ${counts.learned} learned` : ""} · ${counts.pass} pass`,
            Icon: Table2,
          },
        ]
      : []),
    { id: "contract", label: "Contract", meta: `${contract.sections.length} sections · ${contract.words.toLocaleString("en-US")} words`, Icon: FileText },
    ...(routed
      ? [
          {
            id: "route" as const,
            label: "Approvals",
            meta: sub ? `${sub.decisions.filter((d) => d.decision === "approved").length} of ${sub.route.length} approved` : view.review.route.map((s) => s.name.split(" ")[0]).join(" → "),
            Icon: Route,
          },
        ]
      : []),
  ];
  return (
    <ul data-testid="rail-work-rows">
      {rows.map(({ id, ...row }) => (
        <Row key={id} {...row} testId={`work-${id}`} onClick={() => openOutput(id)} />
      ))}
    </ul>
  );
}

/** One line, not a properties table: what the review is checked against, and the model. */
function About({ view, model }: { view: MatterView | null; model: string }) {
  const state = useAppState();
  const learned = view?.planApproved ? view.state!.planRules.length : state.publishedRules.length;
  return (
    <p className="px-4 py-3 text-small text-muted" data-testid="rail-about">
      Checked against the vendor playbook ({CHECK_RULE_IDS.length} rules){learned ? ` and ${plural(learned, "learned rule")}` : ""} · model:{" "}
      <span data-testid="model-label">{model.replace(/^[^/]+\//, "")}</span>
    </p>
  );
}
