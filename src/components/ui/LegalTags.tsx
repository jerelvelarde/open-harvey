// The chips and marks the legal screens share, in black and white: a task's result, a finding's
// risk, the cite chip that opens a passage, the learned tag, the Open Harvey mark (an open ring around
// a petal) and the copilot's own mark. Chips draw by fill, weight and shape (Card.tsx Tag).

"use client";

import { BookMarked, FileText, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { showPassage } from "@/components/cite-focus";
import { findPassage } from "@/lib/contract";
import { getContract } from "@/lib/library";
import { findingTone, type Finding, type FindingStatus, type Risk } from "@/lib/review";
import type { TaskView } from "@/lib/store";
import { Tag, type Tone } from "./Card";

const TONE_TAG = { red: "red", amber: "amber", muted: "neutral", green: "green" } as const;
const RISK_WORD: Record<Risk, string> = { high: "High", medium: "Medium", low: "Low" };

/**
 * The chip for a task's result, in the review table's words: a check that found a deviation names its
 * risk (High a solid ink chip, Medium outlined, Low plain text), a pass reads Pass, the learned request reads Request; a
 * task with no finding reads Done. While the plan runs: Working, Queued. Task 17 waits: After approvals.
 */
export function taskChip(task: TaskView): { label: string; tone: Tone; working?: boolean; attention?: boolean } {
  const finding = task.outcome?.finding;
  if (task.status === "done" && task.outcome?.status === "attention" && finding) {
    return { label: RISK_WORD[finding.risk ?? "low"], tone: TONE_TAG[findingTone(finding)], attention: true };
  }
  if (task.status === "working") return { label: "Working", tone: "neutral", working: true };
  if (task.status === "held") return { label: "After approvals", tone: "neutral" };
  if (task.status === "done" && finding?.status === "pass" && finding.ruleId) return { label: "Pass", tone: "green" };
  if (task.status === "done" && finding?.status === "request") return { label: "Request", tone: "amber" };
  if (task.status === "done") return { label: "Done", tone: "green" };
  if (task.status === "queued") return { label: "Queued", tone: "neutral" };
  return { label: "Proposed", tone: "neutral" };
}

export function TaskStatusTag({ task, className = "" }: { task: TaskView; className?: string }) {
  const chip = taskChip(task);
  const finding = task.outcome?.finding;
  return (
    <Tag
      tone={chip.tone}
      icon={chip.working ? <LoaderCircle aria-hidden className="work-spinner size-3 shrink-0" strokeWidth={2.25} /> : undefined}
      className={className}
      data-status={chip.attention ? "attention" : task.status}
      data-tone={chip.attention && finding ? findingTone(finding) : undefined}
      title={chip.attention ? "Needs a decision" : undefined}
    >
      {chip.label}
    </Tag>
  );
}

/** The loudest finding in a contract section, as a word in its tone, for the contents list. */
export function SectionTag({ findings }: { findings: Pick<Finding, "status" | "risk">[] }) {
  const order = ["red", "amber", "muted"] as const;
  const loud = findings
    .filter((f) => f.status === "deviation" || f.status === "request")
    .sort((a, b) => order.indexOf(findingTone(a) as (typeof order)[number]) - order.indexOf(findingTone(b) as (typeof order)[number]))[0];
  if (!loud) return null;
  const word = loud.status === "request" ? "Request" : RISK_WORD[loud.risk ?? "low"];
  const tone = TONE_TAG[findingTone(loud)];
  return (
    <Tag tone={tone} data-testid="section-tag">
      {word}
    </Tag>
  );
}

/** A finding's result: its risk for a deviation, Pass, Request for a learned rule, Noted for no rule. */
export function ResultTag({ status, risk }: { status: FindingStatus; risk: Risk | null }) {
  if (status === "deviation" && risk) {
    const tone = TONE_TAG[findingTone({ status, risk })];
    return (
      <Tag tone={tone}>
        {RISK_WORD[risk]}
      </Tag>
    );
  }
  if (status === "request") return <Tag tone="amber">Request</Tag>;
  if (status === "info") return <Tag tone="neutral">Noted</Tag>;
  return <Tag tone="green">Pass</Tag>;
}

/** "Learned v1": provenance, a row a published rule added (its rule id sits beside it). The glyph is the playbook's. */
export function LearnedTag({ id, version, className = "" }: { id: string; version: number; className?: string }) {
  return (
    <Tag tone="outline" title={`Added by ${id} v${version}, a rule the General Counsel published in Insights`} className={className} icon={<BookMarked aria-hidden className="size-3 shrink-0" strokeWidth={2} />}>
      Learned v{version}
    </Tag>
  );
}

/**
 * "§8.2": a first click peeks at the passage in a small card (the quoted words highlighted); a second
 * click, or "Open in the contract", opens the full viewer on it.
 */
/** `openable={false}`: the peek only, with no "Open in the contract" (a collection document has no matter to open it in). */
export function CiteChip({ matterId, cite, quote, label, openable = true, className = "" }: { matterId: string; cite: string; quote?: string | null; label?: string; openable?: boolean; className?: string }) {
  const chip = useRef<HTMLButtonElement>(null);
  const [peek, setPeek] = useState<{ top: number; left: number } | null>(null);
  const open = () => {
    setPeek(null);
    showPassage(matterId, cite, quote ?? null, label ?? null);
  };
  useEffect(() => {
    if (!peek) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e instanceof MouseEvent && (chip.current?.contains(e.target as Node) || (e.target as HTMLElement).closest?.("[data-cite-peek]"))) return;
      setPeek(null);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [peek]);
  return (
    <>
      <button
        ref={chip}
        type="button"
        data-testid="cite-chip"
        aria-expanded={Boolean(peek)}
        onClick={() => {
          if (peek) return open();
          const r = chip.current!.getBoundingClientRect();
          const width = 360;
          const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
          const top = r.bottom + 220 > window.innerHeight ? Math.max(56, r.top - 216) : r.bottom + 6;
          setPeek({ top, left });
        }}
        title={`Peek at ${cite}`}
        className={`inline-flex h-5 shrink-0 items-center gap-1 rounded-[5px] border border-hairline bg-surface px-1.5 font-mono text-small text-ink transition-colors duration-150 hover:border-rule hover:bg-stone ${className}`}
      >
        <FileText aria-hidden className="size-3 text-muted" strokeWidth={2} />
        {cite}
      </button>
      {peek && createPortal(<PassagePeek matterId={matterId} cite={cite} quote={quote ?? null} at={peek} onOpen={openable ? open : null} />, document.body)}
    </>
  );
}

function PassagePeek({ matterId, cite, quote, at, onOpen }: { matterId: string; cite: string; quote: string | null; at: { top: number; left: number }; onOpen: (() => void) | null }) {
  const passage = findPassage(getContract(matterId), cite);
  if (!passage) return null;
  const i = quote ? passage.text.indexOf(quote) : -1;
  return (
    <div
      data-cite-peek
      data-testid="cite-peek"
      role="dialog"
      aria-label={`${cite} ${passage.caption}`}
      style={{ top: at.top, left: at.left, width: 360 }}
      className="fixed z-50 rounded-md border border-hairline bg-surface p-3 shadow-raised"
    >
      <p className="text-small text-muted">
        <span className="font-mono text-ink">{cite}</span> · {passage.caption}
      </p>
      <p className="mt-1.5 line-clamp-6 text-ink [text-wrap:pretty]">
        {i >= 0 && quote ? (
          <>
            {passage.text.slice(0, i)}
            <mark className="cite-mark text-ink">{quote}</mark>
            {passage.text.slice(i + quote.length)}
          </>
        ) : (
          passage.text
        )}
      </p>
      {onOpen && (
        <button type="button" onClick={onOpen} className="mt-2 text-small font-medium text-ink underline underline-offset-[3px] hover:text-muted" data-testid="peek-open">
          Open in the contract
        </button>
      )}
    </div>
  );
}

/**
 * The Open Harvey mark: an open ring (a circle with a gap at its upper right) around one seal petal.
 * Original to this demo, drawn in currentColor so it is white on the black sidebar and ink elsewhere.
 */
export function OpenMark({ size = 24 }: { size?: 20 | 24 | 28 }) {
  return (
    <svg width={size} height={size} viewBox="-12 -12 24 24" aria-hidden className="shrink-0" data-testid="open-mark">
      <path d="M4.6-8.75A9.9 9.9 0 1 0 8.75-4.6" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
      <path d="M0-5.6C2.9-3.4 2.9 3.4 0 5.6-2.9 3.4-2.9-3.4 0-5.6Z" fill="currentColor" transform="rotate(45)" />
    </svg>
  );
}

/**
 * The copilot's own mark, in the people's family: an ink circle like an approver's initials, holding
 * one petal of the approval seal. It is the assignee and author wherever the copilot did the work.
 */
export function CopilotGlyph({ size = 20 }: { size?: 20 | 24 }) {
  return (
    <span aria-hidden style={{ width: size, height: size }} className="inline-flex shrink-0 items-center justify-center rounded-full bg-ink text-on-ink" data-testid="copilot-glyph">
      <svg width={size * 0.56} height={size * 0.56} viewBox="-6 -6 12 12" aria-hidden>
        <path d="M0-5.4C3.6-3.2 3.6 3.2 0 5.4-3.6 3.2-3.6-3.2 0-5.4Z" fill="currentColor" transform="rotate(45)" />
      </svg>
    </span>
  );
}

export const COPILOT_NAME = "Copilot";
