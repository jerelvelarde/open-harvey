// Small presentational pieces shared by the panels and the chat cards: the card frame, tags, the
// verdict tag, and buttons. Colours come from the tokens in app/globals.css.

import { Check, CircleAlert, CircleDashed, Info, StickyNote } from "lucide-react";
import type { ReactNode } from "react";
import type { CheckStatus } from "./seal-state";

/** A white work surface behind a hairline. Used for the chat cards and the error fallback. */
export function Card({
  title,
  meta,
  aside,
  className = "",
  testId,
  children,
}: {
  title: ReactNode;
  meta?: ReactNode;
  aside?: ReactNode;
  className?: string;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <section data-testid={testId} className={`rounded-md border border-hairline bg-surface text-ink ${className}`}>
      <header className="flex items-start justify-between gap-3 border-b border-hairline px-3.5 py-2.5">
        <div className="min-w-0">
          <h3 className="text-body font-semibold">{title}</h3>
          {meta && <p className="mt-0.5 text-small text-muted">{meta}</p>}
        </div>
        {aside}
      </header>
      <div className="px-3.5 py-3">{children}</div>
    </section>
  );
}

/**
 * Chip tones. Black and white: the tone names say what they mean in the code, and each draws by fill,
 * weight and shape, never by hue (DESIGN.md).
 * - red: what a person must act on (High, Sent back, Still deviates, Rejected): a solid ink chip.
 * - amber and plum: what to watch, or whose turn it is (Medium, Request, Your turn, Awaiting decision): an ink outline.
 * - green: settled (Pass, Done, Approved, Published): a stone chip with a check.
 * - neutral: the quiet rest (Low, Queued, Working, After approvals): plain text.
 * - outline: provenance (copilot · drafted, edited by you, Learned v1): a dashed hairline, muted.
 * The cite chip (LegalTags.tsx CiteChip) is the only mono chip.
 */
export type Tone = "neutral" | "outline" | "green" | "red" | "amber" | "plum";

const TONES: Record<Tone, string> = {
  neutral: "px-0 text-ink",
  outline: "border border-dashed border-rule bg-surface px-1.5 text-muted",
  green: "bg-stone px-1.5 text-ink",
  red: "bg-ink px-1.5 text-on-ink",
  amber: "border border-ink bg-surface px-1.5 text-ink",
  plum: "border border-ink bg-surface px-1.5 text-ink",
};

/**
 * A chip: a word, shaped by its tone. A settled chip carries a check; the others carry no mark, so the
 * fill and the outline do the work. `icon` replaces the check (the running spinner). `dot` is ignored:
 * there is no colour to dot.
 */
export function Tag({
  children,
  tone = "neutral",
  icon,
  dot: _dot,
  className = "",
  ...rest
}: { children: ReactNode; tone?: Tone; icon?: ReactNode; dot?: boolean; className?: string } & Omit<React.HTMLAttributes<HTMLSpanElement>, "children" | "className">) {
  const mark = icon ?? (tone === "green" ? <Check aria-hidden className="size-3 shrink-0" strokeWidth={2.5} /> : null);
  return (
    <span {...rest} className={`inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-[5px] text-small font-medium ${TONES[tone]} ${className}`}>
      {mark}
      {children}
    </span>
  );
}

const VERDICT: Record<CheckStatus, { label: string; tone: Tone; Icon: typeof Check }> = {
  pass: { label: "Pass", tone: "green", Icon: Check },
  fail: { label: "Fix", tone: "red", Icon: CircleAlert },
  missing: { label: "Missing", tone: "red", Icon: CircleDashed },
  warn: { label: "Note", tone: "amber", Icon: StickyNote },
  info: { label: "Info", tone: "neutral", Icon: Info },
};

export const verdictLabel = (status: CheckStatus) => VERDICT[status].label;

/** The verdict of one check: an icon and a word, in the check's tone. */
export function VerdictTag({ status, className = "" }: { status: CheckStatus; className?: string }) {
  const { label, tone, Icon } = VERDICT[status];
  return (
    <Tag tone={tone} className={`w-[72px] justify-start ${className}`} icon={<Icon aria-hidden className="size-3 shrink-0" strokeWidth={2.25} />}>
      {label}
    </Tag>
  );
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-ink text-on-ink hover:bg-ink-hover disabled:border disabled:border-hairline disabled:bg-stone disabled:text-muted",
  secondary: "border border-rule bg-surface text-ink hover:bg-stone disabled:text-muted disabled:hover:bg-surface",
  danger: "border border-rule bg-surface text-ink underline decoration-rule underline-offset-[3px] hover:bg-stone disabled:text-muted disabled:no-underline disabled:hover:bg-surface",
  ghost: "text-muted hover:bg-stone hover:text-ink disabled:text-muted disabled:hover:bg-transparent",
};

export function Button({
  children,
  variant = "secondary",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[5px] font-medium transition-colors duration-150 disabled:cursor-not-allowed ${
        size === "sm" ? "h-7 px-2.5 text-small" : "h-8 px-3.5 text-body"
      } ${VARIANTS[variant]} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}
