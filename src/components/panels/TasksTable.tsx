// Concept: the agent's plan, made visible as work assigned to a colleague. The plan's tasks as a
// table grouped by phase (Intake, Review, Redlines and routing, Signature), each phase with its
// progress in plain words ("Review · 5 of 13 checked"), and an Approvals phase once the route is
// known: Maya sends it, then each approver decides. Columns: Title · Result · Assignee · Rule · Cite.
// The Result column uses the review table's words (Pass, High, Medium, Low). The copilot is the
// assignee of the work it does, with its own mark; people are the assignees of their decisions, with
// their initials. A small toolbar filters the rows. Every row comes from
// lib/plan.ts and lib/store.ts; the words are taskOutcome's, never the model's.

"use client";

import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Tag, type Tone } from "@/components/ui/Card";
import { CiteChip, CopilotGlyph, LearnedTag, TaskStatusTag, taskChip } from "@/components/ui/LegalTags";
import { CURRENT_USER } from "@/lib/company";
import type { MatterView, TaskView } from "@/lib/store";

type Filter = "all" | "decision" | "done";
type Phase = { id: string; title: string; tasks: TaskView[] };

const PHASE_OF: Record<string, string> = { parties: "intake", redlines: "routing", route: "routing", packet: "signature" };
const PHASES: { id: string; title: string }[] = [
  { id: "intake", title: "Intake" },
  { id: "review", title: "Review" },
  { id: "routing", title: "Redlines and routing" },
  { id: "signature", title: "Signature" },
];

export function phasesOf(plan: TaskView[]): Phase[] {
  return PHASES.map((p) => ({ ...p, tasks: plan.filter((t) => (PHASE_OF[t.id] ?? "review") === p.id) })).filter((p) => p.tasks.length > 0);
}

/** "5 of 13 checked" for the review, "1 of 2 done" for the rest, "done" when every task is, "after approvals" for the send. */
function progressWords(phase: Phase): string {
  const done = phase.tasks.filter((t) => t.status === "done").length;
  if (done === phase.tasks.length && done > 0) return "done";
  if (phase.tasks.every((t) => t.status === "held")) return "after approvals";
  return `${done} of ${phase.tasks.length} ${phase.id === "review" ? "checked" : "done"}`;
}

type PersonRow = { id: string; title: string; detail: string; personId: string; name: string; chip: { label: string; tone: Tone }; rule: string; needsDecision: boolean; done: boolean };

export function TasksTable({ view }: { view: MatterView }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [mine, setMine] = useState(false);
  const sub = view.state?.submission;
  const route = sub?.route ?? view.review.route;
  const routed = view.plan.find((t) => t.id === "route")?.status === "done";

  // The people's tasks: Maya sends it, then each approver decides, in route order.
  const people: PersonRow[] = routed
    ? [
        {
          id: "send",
          title: "Send for approval",
          detail: sub ? "sent" : view.missingReasons.length ? "needs Maya's reason first (PB-APR-01)" : "nothing leaves until Maya clicks",
          personId: CURRENT_USER.id,
          name: CURRENT_USER.name,
          chip: sub ? { label: "Done", tone: "green" } : view.missingReasons.length ? { label: "Needs your reason", tone: "plum" } : { label: "Your turn", tone: "plum" },
          rule: "PB-APR-01",
          needsDecision: !sub,
          done: Boolean(sub),
        },
        ...route.map((step, i): PersonRow => {
          const decision = sub?.decisions[i]?.decision;
          const turn = sub?.status === "pending" && sub.decisions.length === i;
          const chip: { label: string; tone: Tone } =
            decision === "approved"
              ? { label: "Done", tone: "green" }
              : decision === "sent_back"
                ? { label: "Sent back", tone: "amber" }
                : decision === "rejected"
                  ? { label: "Rejected", tone: "red" }
                  : turn
                    ? { label: "Awaiting decision", tone: "plum" }
                    : { label: "Queued", tone: "neutral" };
          return { id: `approve-${step.personId}`, title: `${step.title} approval`, detail: step.reason, personId: step.personId, name: step.name, chip, rule: step.ruleId, needsDecision: turn || decision === "sent_back", done: decision === "approved" };
        }),
      ]
    : [];

  const keepTask = (t: TaskView) => {
    if (mine) return false; // the copilot does these
    if (filter === "decision") return Boolean(taskChip(t).attention);
    if (filter === "done") return t.status === "done";
    return true;
  };
  const keepPerson = (p: PersonRow) => (mine ? p.personId === CURRENT_USER.id : true) && (filter === "decision" ? p.needsDecision : filter === "done" ? p.done : true);
  const phases = phasesOf(view.plan);
  const shownPeople = people.filter(keepPerson);
  const empty = phases.every((p) => p.tasks.filter(keepTask).length === 0) && shownPeople.length === 0;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2" role="toolbar" aria-label="Filter tasks" data-testid="tasks-toolbar">
        <div className="inline-flex rounded-md bg-stone p-0.5" role="radiogroup" aria-label="Show">
          {(
            [
              ["all", "All tasks"],
              ["decision", "Needs a decision"],
              ["done", "Done"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={filter === id}
              onClick={() => setFilter(id)}
              className={`h-7 rounded-[5px] px-2.5 text-small font-medium transition-colors ${filter === id ? "bg-surface text-ink shadow-[0_1px_2px_rgb(22_20_15/0.06)]" : "text-muted hover:text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-pressed={mine}
          onClick={() => setMine((v) => !v)}
          className={`h-8 rounded-md border px-2.5 text-small font-medium transition-colors ${mine ? "border-ink bg-surface text-ink" : "border-hairline bg-surface text-muted hover:text-ink"}`}
          data-testid="mine-filter"
        >
          Mine
        </button>
      </div>
      <section aria-label="Tasks" className="overflow-x-auto rounded-md border border-hairline bg-surface" data-testid="tasks-table">
        <table className="w-full min-w-[820px] table-fixed border-collapse text-left">
          <colgroup>
            <col />
            <col className="w-[156px]" />
            <col className="w-[196px]" />
            <col className="w-[140px]" />
            <col className="w-[84px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-hairline bg-paper text-small text-muted">
              <th scope="col" className="py-2.5 pl-5 pr-2 font-medium">Title</th>
              <th scope="col" className="px-2 py-2.5 font-medium">Result</th>
              <th scope="col" className="px-2 py-2.5 font-medium">Assignee</th>
              <th scope="col" className="px-2 py-2.5 font-medium">Rule</th>
              <th scope="col" className="py-2.5 pl-2 pr-5 font-medium">Cite</th>
            </tr>
          </thead>
          {phases.map((phase) => {
            const rows = phase.tasks.filter(keepTask);
            if (rows.length === 0) return null;
            return (
              <PhaseGroup key={phase.id} id={phase.id} title={phase.title} progress={progressWords(phase)}>
                {rows.map((task) => (
                  <TaskRow key={task.id} task={task} matterId={view.matter.id} />
                ))}
              </PhaseGroup>
            );
          })}
          {shownPeople.length > 0 && (
            <PhaseGroup id="approvals" title="Approvals" progress={sub ? `${sub.decisions.filter((d) => d.decision === "approved").length} of ${route.length} approved` : "starts when Maya sends it"}>
              {shownPeople.map((p) => (
                <tr key={p.id} className="border-b border-hairline last:border-b-0 hover:bg-paper" data-testid="approval-task">
                  <td className="py-2.5 pl-10 pr-2">
                    <span className="text-ink">{p.title}</span>
                    <span className="block text-small text-muted">{p.detail}</span>
                  </td>
                  <td className="px-2 py-2.5 align-top">
                    <Tag tone={p.chip.tone}>{p.chip.label}</Tag>
                  </td>
                  <td className="px-2 py-2.5 align-top">
                    <span className="flex items-center gap-2">
                      <Avatar name={p.name} size={24} />
                      <span className="truncate text-ink">{p.name}</span>
                    </span>
                  </td>
                  <td className="px-2 py-2.5 align-top font-mono text-small text-muted">{p.rule}</td>
                  <td className="py-2.5 pl-2 pr-5" />
                </tr>
              ))}
            </PhaseGroup>
          )}
          {empty && (
            <tbody>
              <tr>
                <td colSpan={5} className="px-5 py-6 text-muted">
                  {mine ? "Nothing is yours yet: the copilot runs the checks, and you send it once they are done." : "No tasks match this filter."}
                </td>
              </tr>
            </tbody>
          )}
        </table>
      </section>
    </div>
  );
}

function PhaseGroup({ id, title, progress, children }: { id: string; title: string; progress: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <tbody data-phase={id}>
      <tr className="border-b border-hairline bg-stone/50">
        <th colSpan={5} scope="rowgroup" className="py-2 pl-3 pr-5 text-left font-normal">
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="inline-flex items-center gap-2" data-testid="phase-progress">
            <ChevronDown aria-hidden className={`size-3.5 text-muted transition-transform duration-200 ${open ? "" : "-rotate-90"}`} />
            <span className="font-semibold text-ink">{title}</span>
            <span className="text-muted">· {progress}</span>
          </button>
        </th>
      </tr>
      {open && children}
    </tbody>
  );
}

function TaskRow({ task, matterId }: { task: TaskView; matterId: string }) {
  const outcome = task.outcome;
  return (
    <tr data-task={task.id} data-status={task.status === "done" && outcome?.status === "attention" ? "attention" : task.status} className={`border-b border-hairline last:border-b-0 hover:bg-paper ${task.learned ? "bg-paper" : ""}`}>
      <td className="py-2.5 pl-10 pr-2">
        <span className="text-ink">
          {task.title}
          {task.learned && <LearnedTag id={task.learned.id} version={task.learned.version} className="ml-1.5 align-[1px]" />}
        </span>
        {outcome && <span className="block text-small text-muted">{outcome.line}</span>}
      </td>
      <td className="px-2 py-2.5 align-top">
        <TaskStatusTag task={task} />
      </td>
      <td className="px-2 py-2.5 align-top">
        <span className="flex items-center gap-2">
          <CopilotGlyph />
          <span className="truncate text-ink">Copilot</span>
        </span>
      </td>
      <td className="px-2 py-2.5 align-top text-small text-muted">{task.ruleIds.length === 3 ? <span className="font-mono">PB-APR-01–03</span> : task.ruleIds.length ? <span className="font-mono">{task.ruleIds.join(" ")}</span> : "—"}</td>
      <td className="py-2.5 pl-2 pr-5 align-top">{outcome?.cite && <CiteChip matterId={matterId} cite={outcome.cite} quote={outcome.finding?.quote} label={outcome.finding?.ruleId ?? task.title} />}</td>
    </tr>
  );
}
