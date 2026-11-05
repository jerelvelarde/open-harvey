// Fail loud, in the app. With CopilotKit Intelligence switched on, the page asks the server once
// whether the key, the connection and the Learning Space work (/api/intelligence-status) and says so
// in a strip above the content: a wrong key or an unreachable Intelligence in ink, a missing Space as
// a warning (the demo carries on without one), and a quiet line when it is connected. A Trajectory
// capture failure reported by the provider shows here too. With Intelligence off it renders nothing
// and asks nothing.

"use client";

import { CircleAlert, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { IntelligencePublic, IntelligenceStatus } from "@/lib/intelligence";

export function IntelligenceNotice({ intelligence, captureError, onDismissCapture }: { intelligence?: IntelligencePublic; captureError: string | null; onDismissCapture: () => void }) {
  const active = Boolean(intelligence && (intelligence.enabled || intelligence.problem));
  const [status, setStatus] = useState<IntelligenceStatus | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    fetch("/api/intelligence-status", { cache: "no-store" })
      .then((r) => r.json() as Promise<IntelligenceStatus>)
      .then((s) => !cancelled && setStatus(s))
      .catch((e: unknown) => !cancelled && setStatus({ state: "error", message: `Couldn't check CopilotKit Intelligence (${e instanceof Error ? e.message : String(e)}).` }));
    return () => {
      cancelled = true;
    };
  }, [active]);

  if (!active) return null;
  // The server's check names the cause (a wrong key, no network, no Space), so it comes first; a capture
  // failure on its own (the server check passed) shows when there is nothing more specific to say.
  const checked = status && (status.state === "error" || status.state === "warning") ? status : null;
  const problem = checked?.state === "error" ? checked : captureError ? { state: "error" as const, message: captureError } : checked;
  if (problem) {
    return (
      <div role="alert" className={`flex items-start gap-2 border-b px-4 py-2.5 text-small text-ink ${problem.state === "error" ? "border-ink bg-stone" : "border-rule bg-surface"}`} data-testid="intelligence-notice" data-state={problem.state}>
        <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" strokeWidth={2.25} />
        <span className="min-w-0 flex-1">
          <span className="font-semibold">{problem.state === "error" ? "CopilotKit Intelligence isn't working." : "CopilotKit Intelligence:"}</span> {problem.message}
        </span>
        {problem.message === captureError && (
          <button type="button" onClick={onDismissCapture} aria-label="Dismiss" className="shrink-0 text-muted hover:text-ink">
            <X aria-hidden className="size-3.5" />
          </button>
        )}
      </div>
    );
  }
  return (
    <p className="border-b border-hairline px-4 py-1.5 text-small text-muted" data-testid="intelligence-notice" data-state={status?.state ?? "checking"}>
      {status?.state === "connected" ? status.message : "Checking CopilotKit Intelligence…"}
    </p>
  );
}
