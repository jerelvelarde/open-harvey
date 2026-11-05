// The approval seal: the matter's state drawn as one data graphic, in the manner of a security print.
//
// - One petal per playbook check, in playbook order from the top, clockwise. In black and white,
//   shape is the meaning: a passing check is a filled ink petal; a deviation is a hollow ink petal with
//   a notch cut in its tip; a learned request is a hollow grey petal; a check not run yet is a hairline.
// - The frame is one hairline circle. An approver who approved adds a solid ink ring outside it,
//   innermost first; a send-back adds a broken ink ring. Nobody decided yet: only the hairline.
//
// It is drawn from live state on every render. When a check or a decision changes, that stroke
// inks in once (app/globals.css .seal-ink); the first render never animates, and reduced motion
// shows the final state at once. Screen readers get the same facts as a sentence.

import { useState } from "react";
import type { SealCheck, SealSigner, SignerState } from "./seal-state";

export type { SealCheck, SealSigner, SignerState };

/** Black and white: shape carries every state; ink and grey are the only inks. */
const INK = { green: "#141310", red: "#141310", muted: "#65615A", ink: "#141310" };

function sealLabel(matterNumber: string, checks: readonly SealCheck[], signers: readonly SealSigner[]) {
  const pass = checks.filter((c) => c.status === "pass").length;
  const toFix = checks.filter((c) => c.status === "fail" || c.status === "missing").length;
  const approved = signers.filter((s) => s.state === "approved").length;
  const returned = signers.find((s) => s.state === "sent_back" || s.state === "rejected");
  const people = signers.length
    ? `${approved} of ${signers.length} approvers approved${returned ? `; ${returned.state === "sent_back" ? "sent back" : "rejected"} by ${returned.name}` : ""}`
    : "no approvers yet";
  return `Approval seal for ${matterNumber}: ${pass} of ${checks.length} checks pass${toFix ? `, ${toFix} deviate` : ""}; ${people}.`;
}

// ---------------------------------------------------------------------------------------------
// Which strokes changed since mount, so only those ink in

type Ink = { status: string; count: number; delay: number };

function useInk(entries: readonly (readonly [string, string])[]): Record<string, Ink> {
  const signature = entries.map(([key, status]) => `${key}=${status}`).join("|");
  const [seen, setSeen] = useState(() => ({
    signature,
    map: Object.fromEntries(entries.map(([key, status]) => [key, { status, count: 0, delay: 0 }])) as Record<string, Ink>,
  }));
  if (seen.signature === signature) return seen.map;
  // Adjust state while rendering: the strokes that changed get a new count (a remount, so they ink
  // in) and a delay by their order, so a whole seal filling at once reads as one stroke of the pen.
  const map = { ...seen.map };
  let order = 0;
  for (const [key, status] of entries) {
    const before = map[key];
    if (before && before.status === status) continue;
    map[key] = { status, count: (before?.count ?? 0) + 1, delay: order++ * 45 };
  }
  setSeen({ signature, map });
  return map;
}

// ---------------------------------------------------------------------------------------------

const polar = (r: number, degrees: number) => {
  const a = ((degrees - 90) * Math.PI) / 180;
  return [r * Math.cos(a), r * Math.sin(a)] as const;
};

function arc(r: number, from: number, to: number) {
  const [x0, y0] = polar(r, from);
  const [x1, y1] = polar(r, to);
  return `M${x0.toFixed(3)} ${y0.toFixed(3)}A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x1.toFixed(3)} ${y1.toFixed(3)}`;
}

/** A petal from the centre outwards; `notched` cuts a V into its tip (a deviation). */
function petal(width: number, notched: boolean) {
  const w = width.toFixed(2);
  const tip = notched ? `C${w} -24 ${(width * 0.8).toFixed(2)} -27.6 ${(width * 0.42).toFixed(2)} -30L0 -25.6L${(-width * 0.42).toFixed(2)} -30C${(-width * 0.8).toFixed(2)} -27.6 -${w} -24 -${w} -18` : `C${w} -24 ${(width * 0.6).toFixed(2)} -30 0 -31.5C${(-width * 0.6).toFixed(2)} -30 -${w} -24 -${w} -18`;
  return `M0 -7C${(width * 0.7).toFixed(2)} -9 ${w} -13 ${w} -18${tip}C-${w} -13 ${(-width * 0.7).toFixed(2)} -9 0 -7Z`;
}

export function ApprovalSeal({
  matterNumber,
  checks,
  signers,
  size = 56,
  label,
  className = "",
}: {
  matterNumber: string;
  checks: readonly SealCheck[];
  signers: readonly SealSigner[];
  size?: number;
  /** Overrides the generated description, e.g. for the empty seal before a request exists. */
  label?: string;
  className?: string;
}) {
  const ink = useInk([...checks.map((c) => [`p:${c.id}`, c.status] as const), ...signers.map((s, i) => [`r:${i}`, s.state] as const)]);
  const n = Math.max(checks.length, 1);
  const width = Math.min(7.5, Math.max(3.2, 14 * Math.sin(Math.PI / n) * 1.25));
  const decided = signers.map((s, i) => ({ ...s, i })).filter((s) => s.state !== "pending");
  const allApproved = signers.length > 0 && signers.every((s) => s.state === "approved");

  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" role="img" aria-label={label ?? sealLabel(matterNumber, checks, signers)} className={`block shrink-0 ${className}`}>
      {/* The frame: one hairline */}
      <circle r={36} fill="none" stroke={INK.muted} strokeOpacity={0.45} strokeWidth={1.2} />

      {/* A ring for each approver who has decided, innermost first */}
      {decided.map((signer, k) => {
        const r = 40 + k * 4.2;
        const { count, delay } = ink[`r:${signer.i}`] ?? { count: 0, delay: 0 };
        const inked = count > 0 ? "seal-ink" : "";
        const style = { "--ink-delay": `${delay}ms` } as React.CSSProperties;
        if (signer.state === "approved") {
          return <circle key={`r${signer.i}-${count}`} r={r} fill="none" stroke={INK.green} strokeWidth={2.6} pathLength={1} transform="rotate(-90)" className={inked} style={style} />;
        }
        const pieces = signer.state === "sent_back" ? 3 : 6;
        const span = 360 / pieces;
        return (
          <g key={`r${signer.i}-${count}`} fill="none" stroke={INK.ink} strokeWidth={2.6}>
            {Array.from({ length: pieces }, (_, j) => (
              <path key={j} d={arc(r, j * span + span * 0.16, (j + 1) * span - span * 0.16)} pathLength={1} className={inked} style={style} />
            ))}
          </g>
        );
      })}

      {/* One petal per check: filled = pass, hollow and notched = deviation, hollow = request, hairline = not run */}
      {checks.map((check, i) => {
        const { count, delay } = ink[`p:${check.id}`] ?? { count: 0, delay: 0 };
        const inked = count > 0 ? "seal-ink" : "";
        const style = { "--ink-delay": `${delay}ms` } as React.CSSProperties;
        const pass = check.status === "pass";
        const deviates = check.status === "fail" || check.status === "missing";
        const request = check.status === "warn";
        const color = pass ? INK.green : deviates ? INK.red : INK.muted;
        return (
          <g key={`${check.id}-${count}`} transform={`rotate(${(i * 360) / n})`} data-petal={pass ? "pass" : deviates ? "deviate" : request ? "request" : "not-run"}>
            <path
              d={petal(width, deviates)}
              fill={pass ? INK.green : "#FFFFFF"}
              stroke={color}
              strokeOpacity={pass || deviates || request ? 1 : 0.4}
              strokeWidth={pass ? 1.2 : deviates || request ? 2.2 : 1.2}
              strokeLinejoin="round"
              pathLength={1}
              className={inked}
              style={style}
            />
          </g>
        );
      })}

      {/* The boss: filled ink once every approver has approved */}
      <circle r={4.6} fill="#FFFFFF" stroke={INK.ink} strokeOpacity={0.55} strokeWidth={1.2} />
      <circle r={2} fill={allApproved ? INK.green : INK.muted} />
    </svg>
  );
}

// ---------------------------------------------------------------------------------------------
// The seal with its counts beside it

export type SealCounts = { checks: number; checked: number; pass: number; deviations: number; learned: number };

/**
 * The seal's counts in plain words: "5 pass · 7 deviate", and once it is sent "· 1 of 3 approved".
 * The send-back itself is the matter's status chip, so it is not repeated here.
 */
export function sealParts(counts: SealCounts, signers: readonly SealSigner[], sent: boolean): string[] {
  if (counts.checked === 0) return [`${counts.checks} checks, not run yet`];
  const approved = signers.filter((x) => x.state === "approved").length;
  return [`${counts.pass} pass`, `${counts.deviations} deviate`, counts.learned ? `${counts.learned} learned` : null, sent && signers.length ? `${approved} of ${signers.length} approved` : null].filter(
    (part): part is string => Boolean(part),
  );
}

export const sealLine = (counts: SealCounts, signers: readonly SealSigner[], sent: boolean) => sealParts(counts, signers, sent).join(" · ");

/** The one seal, at a readable size, with its plain counts beside it. */
export function SealWithKey({ matterNumber, checks, signers, counts, sent }: { matterNumber: string; checks: readonly SealCheck[]; signers: readonly SealSigner[]; counts: SealCounts; sent: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <p className="text-right text-small text-ink" data-testid="seal-key">
        {/* The checks on one line; once it is sent, the approvals on their own line under them. */}
        <span className="block whitespace-nowrap">{sealParts(counts, signers, false).join(" · ")}</span>
        {sent && signers.length > 0 && (
          <span className="block whitespace-nowrap" data-testid="seal-approvals">
            {`${signers.filter((x) => x.state === "approved").length} of ${signers.length} approved`}
          </span>
        )}
      </p>
      <ApprovalSeal matterNumber={matterNumber} checks={checks} signers={signers} size={56} />
    </div>
  );
}
