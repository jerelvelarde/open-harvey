// How the copilot's work reads in the chat: one quiet row per step, present tense while it runs and
// past tense with its result when done, and one summary line for the whole turn. Presentational
// only; copilot/useWorkRows.tsx decides the words, CopilotChat decides when to fold them away.

import { Check, ChevronRight, CircleAlert, LoaderCircle } from "lucide-react";
import { useEffect, useState, type ButtonHTMLAttributes } from "react";

export type WorkState = "running" | "done" | "failed";

export function WorkRow({ state, text, detail }: { state: WorkState; text: string; detail?: string }) {
  return (
    <div data-testid="work-row" data-work-state={state} className="flex min-w-0 items-start gap-2 py-[3px] text-muted">
      <span className="flex h-5 w-3.5 shrink-0 items-center justify-center">
        {state === "running" && <LoaderCircle aria-hidden className="work-spinner size-3.5 text-muted" strokeWidth={2} />}
        {state === "done" && <Check aria-hidden className="size-3.5 text-muted" strokeWidth={2.25} />}
        {state === "failed" && <CircleAlert aria-hidden className="size-3.5 text-ink" strokeWidth={2.25} />}
      </span>
      <span className="min-w-0">
        <span className={state === "running" ? "text-ink" : ""}>{text}</span>
        {detail && <span> · {detail}</span>}
      </span>
    </div>
  );
}

type SummaryProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  isWorking: boolean;
  isOpen: boolean;
  /** The steps the turn took, each named in a few words ("Checked 9 rules"); cards are not steps. */
  steps: string[];
  /** While it works: the step working now ("Security standards and audits · 8 of 17"). */
  live?: string | null;
  elapsedMs?: number;
  workingSince?: number;
};

const seconds = (ms: number) => `${Math.max(1, Math.round(ms / 1000))}s`;

/** "Working: <step> · 8 of 17" (or "Working 3s") while the turn runs, then "Done in 6s · Read Acme Cloud · Ran 16 tasks", which opens the folded rows. */
export function WorkSummary({ isWorking, isOpen, steps, live, elapsedMs, workingSince, className = "", ...props }: SummaryProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isWorking) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isWorking]);
  const liveMs = elapsedMs !== undefined && workingSince !== undefined ? elapsedMs + Math.max(0, now - workingSince) : undefined;
  return (
    <button
      type="button"
      data-testid="copilot-work-summary"
      data-state={isWorking ? "working" : "done"}
      aria-expanded={isOpen}
      {...props}
      className={`inline-flex max-w-full items-start gap-1.5 rounded-sm py-0.5 text-left text-small text-muted transition-colors hover:text-ink ${className}`}
    >
      {isWorking ? (
        <>
          <LoaderCircle aria-hidden className="work-spinner mt-px size-3.5 shrink-0" strokeWidth={2} />
          {live ? (
            <span data-testid="live-step">
              <span className="font-medium text-ink">Working:</span> <span className="text-ink">{live}</span>
            </span>
          ) : (
            <span>
              <span className="font-medium text-ink">Working</span>
              {liveMs !== undefined && ` ${seconds(liveMs)}`}
            </span>
          )}
        </>
      ) : (
        <span className="min-w-0">
          <span className="font-medium">{elapsedMs !== undefined ? `Done in ${seconds(elapsedMs)}` : "Done"}</span>
          {steps.map((step, i) => (
            <span key={i}> · {step}</span>
          ))}
        </span>
      )}
      <ChevronRight aria-hidden className={`mt-px size-3.5 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`} />
    </button>
  );
}
