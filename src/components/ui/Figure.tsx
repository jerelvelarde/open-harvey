// A derived figure that shows when it changed: a warm highlight that fades, once per change.
// The first render never flashes, so switching tabs or re-mounting a card stays calm. Reduced
// motion turns the highlight off (app/globals.css).

import { useState } from "react";
import { usd } from "./format";

/**
 * How many times `value` has changed since this component mounted. Uses React's "adjust state while
 * rendering" pattern, so the count is right on the render that shows the new value.
 */
export function useChangeCount(value: unknown): number {
  const [seen, setSeen] = useState({ value, count: 0 });
  if (!Object.is(seen.value, value)) {
    const next = { value, count: seen.count + 1 };
    setSeen(next);
    return next.count;
  }
  return seen.count;
}

export function Figure({ value, format = usd, className = "" }: { value: number; format?: (value: number) => string; className?: string }) {
  const changes = useChangeCount(value);
  // A new key remounts the span, which restarts the highlight from its first frame.
  return (
    <span key={changes} className={`tabular-nums ${changes > 0 ? "figure-flash" : ""} ${className}`}>
      {format(value)}
    </span>
  );
}
