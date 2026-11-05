// The contract as a live document, the way a lawyer works in Word (lib/document.ts): the vendor's
// draft with Northstar's tracked changes in it and comments in the margin, each with who made it.
// - Click any text to edit it. Every edit is tracked in Maya's name; an edit to a redlined sentence is
//   the redline itself, so the Review table shows it and the copilot re-checks it, as there.
// - Select words to comment on them. The copilot comments, suggests edits and adds clauses through
//   its own tools (copilot/useDocumentTools.ts); its changes read dotted until Maya accepts them.
// - Accept makes a copilot change Maya's. Reject puts the vendor's words back.
// - Cite chips anywhere in the app still open the document on the passage, the quoted words marked.

"use client";

import { Check, ChevronDown, ChevronUp, CornerDownRight, MessageSquarePlus, RotateCcw, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CiteFocus } from "@/components/cite-focus";
import { clearPassage } from "@/components/cite-focus";
import { flashPassage, setActive, useDocFocus } from "@/components/doc-focus";
import { openOutput } from "@/components/shell-state";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Card";
import { COPILOT_NAME, CopilotGlyph, LearnedTag, SectionTag } from "@/components/ui/LegalTags";
import { timeLabel } from "@/components/ui/format";
import { useAskCopilot } from "@/copilot/useAskCopilot";
import { CURRENT_USER } from "@/lib/company";
import { DOCUMENT_ASKS } from "@/lib/demo-script";
import { anchorQuote, isChanged, markRuns, norm, spanRuns, type Author, type Change, type DocComment, type DocPassage, type Highlight, type Run, type Span } from "@/lib/document";
import { getContract } from "@/lib/library";
import type { Finding } from "@/lib/review";
import {
  acceptChange,
  addComment,
  documentView,
  humanEditSpan,
  rejectChange,
  reopenComment,
  replyToComment,
  resolveComment,
  useAppState,
  type MatterView,
  type RedlineEdit,
} from "@/lib/store";

type Markup = "all" | "clean" | "original";
const MARKUPS: { id: Markup; label: string; title: string }[] = [
  { id: "all", label: "All markup", title: "Every change and comment, with who made it" },
  { id: "clean", label: "No markup", title: "The contract as it would read with every change" },
  { id: "original", label: "Original", title: "The vendor's draft, as it arrived" },
];

const anchor = (cite: string) => `passage-${cite.replace("§", "").replace(".", "-")}`;
const authorName = (by: Author) => (by === "agent" ? COPILOT_NAME : CURRENT_USER.name);
const CITE_MARK = "cite";

type Props = { view: MatterView; focus: CiteFocus | null; inMatter?: boolean; onHumanEdit: (edit: RedlineEdit) => void };

export function DocumentEditor({ view, focus, inMatter = false, onHumanEdit }: Props) {
  const matterId = view.matter.id;
  const state = useAppState();
  const doc = useMemo(() => documentView(state, matterId), [state, matterId]);
  const contract = getContract(matterId);
  const { active, flash } = useDocFocus();
  const [markup, setMarkup] = useState<Markup>("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [composer, setComposer] = useState<{ cite: string; quote: string } | null>(null);
  const [selection, setSelection] = useState<{ cite: string; quote: string; x: number; y: number } | null>(null);
  const articleRef = useRef<HTMLElement>(null);

  const openComments = doc.comments.filter((c) => !c.resolved);
  const changeIndex = doc.changes.findIndex((c) => c.id === active);

  // A cite chip: bring the passage's section in under the banner, every time a chip is clicked.
  useEffect(() => {
    if (!focus) return;
    const frame = requestAnimationFrame(() => {
      const passage = document.getElementById(anchor(focus.passageId));
      (passage?.closest("section[data-section]") ?? passage)?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [focus]);

  // The copilot changed something: bring it into view (doc-focus.ts flashPassage).
  useEffect(() => {
    if (!flash) return;
    const frame = requestAnimationFrame(() => document.getElementById(anchor(flash.cite))?.scrollIntoView({ block: "center", behavior: "smooth" }));
    return () => cancelAnimationFrame(frame);
  }, [flash]);

  const goToChange = (step: 1 | -1) => {
    if (doc.changes.length === 0) return;
    const next = doc.changes[(changeIndex + step + doc.changes.length) % doc.changes.length] ?? doc.changes[0];
    flashPassage(next.cite, next.id);
  };

  /** Words selected inside one passage offer a comment on them. */
  const onMouseUp = () => {
    const sel = window.getSelection();
    const box = articleRef.current?.getBoundingClientRect();
    if (!sel || sel.isCollapsed || !box) return setSelection(null);
    const passageOf = (node: Node | null) => (node instanceof Element ? node : node?.parentElement)?.closest<HTMLElement>("[data-passage]") ?? null;
    const from = passageOf(sel.anchorNode);
    const quote = norm(sel.toString());
    if (!from || from !== passageOf(sel.focusNode) || !quote) return setSelection(null);
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setSelection({ cite: from.dataset.passage!, quote, x: rect.left - box.left + rect.width / 2, y: rect.top - box.top });
  };

  const startComment = (cite: string, quote: string) => {
    setComposer({ cite, quote });
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  const sectionFindings = (n: number) => view.found.filter((f) => f.cite.startsWith(`§${n}.`));
  const margin = markup === "all";

  return (
    <div className="grid grid-cols-1 gap-4 @6xl:grid-cols-[220px_minmax(0,1fr)]" data-testid="document-editor">
      <nav aria-label="Sections" className="hidden @6xl:block">
        <ol className="sticky top-3 space-y-0.5 text-small">
          {doc.sections.map((section) => (
            <li key={section.number}>
              <a
                href={`#${anchor(section.passages[0]?.cite ?? "")}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(anchor(section.passages[0].cite))?.scrollIntoView({ block: "start", behavior: "smooth" });
                }}
                className="grid grid-cols-[20px_minmax(0,1fr)_64px] items-start gap-x-2 rounded-sm px-2 py-1 text-muted no-underline transition-colors hover:bg-stone hover:text-ink"
              >
                <span className="font-mono">{section.number}</span>
                <span className="[text-wrap:pretty]">{section.title}</span>
                <span className="flex justify-end">
                  <SectionTag findings={sectionFindings(section.number)} />
                </span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <article ref={articleRef} aria-label={contract.title} className="relative min-w-0 rounded-md border border-hairline bg-surface" onMouseUp={onMouseUp}>
        <div className="sticky top-0 z-20">
          <Toolbar
            markup={markup}
            onMarkup={setMarkup}
            changes={doc.changes.length}
            comments={openComments.length}
            position={changeIndex >= 0 ? changeIndex + 1 : null}
            onPrev={() => goToChange(-1)}
            onNext={() => goToChange(1)}
            canComment={Boolean(selection)}
            onComment={() => selection && startComment(selection.cite, selection.quote)}
            redlined={doc.changes.some((c) => c.kind === "replace")}
          />
          {focus && (
            <div className="flex items-center gap-3 border-b border-hairline bg-stone px-5 py-2 text-small @3xl:px-8" data-testid="cite-banner">
              <span className="min-w-0 flex-1">
                Showing <span className="font-mono text-ink">{focus.passageId}</span>
                {focus.label && (
                  <>
                    {" "}
                    · cited by <span className={focus.label.startsWith("PB-") ? "font-mono text-ink" : "text-ink"}>{focus.label}</span>
                  </>
                )}
              </span>
              <button type="button" className="inline-flex items-center gap-1 font-medium text-muted hover:text-ink" onClick={() => clearPassage()}>
                <X aria-hidden className="size-3.5" />
                Clear mark
              </button>
            </div>
          )}
        </div>

        <header className="border-b border-hairline px-5 py-5 @3xl:px-10">
          <h2 className={`font-serif text-ink ${inMatter ? "text-body font-semibold" : "text-title"}`}>{contract.title}</h2>
          <p className="mt-1 text-small text-muted">
            {contract.subtitle} · {contract.sections.length} sections · {contract.words.toLocaleString("en-US")} words
          </p>
        </header>

        <div className="px-5 py-6 @3xl:px-10" data-testid="document-body">
          {doc.sections.map((section) => (
            <section key={section.number} data-section={section.number} aria-label={`${section.number}. ${section.title}`} className="mb-7 scroll-mt-28 last:mb-0">
              <h3 className="mb-2 font-semibold text-ink">
                {section.number}. {section.title}
              </h3>
              <div className="space-y-1">
                {section.passages.map((passage) => (
                  <PassageRow
                    key={passage.cite}
                    matterId={matterId}
                    passage={passage}
                    markup={markup}
                    margin={margin}
                    active={active}
                    flashN={flash?.cite === passage.cite ? flash.n : null}
                    focus={focus?.passageId === passage.cite ? focus : null}
                    comments={doc.comments.filter((c) => c.cite === passage.cite)}
                    changes={doc.changes.filter((c) => c.cite === passage.cite)}
                    requests={doc.requests.filter((f) => f.cite === passage.cite)}
                    editing={editing}
                    onEdit={setEditing}
                    composer={composer?.cite === passage.cite ? composer.quote : null}
                    onCloseComposer={() => setComposer(null)}
                    onHumanEdit={onHumanEdit}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        {selection && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => startComment(selection.cite, selection.quote)}
            style={{ left: selection.x, top: selection.y }}
            className="absolute z-20 inline-flex -translate-x-1/2 -translate-y-[calc(100%+6px)] items-center gap-1.5 rounded-md bg-ink px-2.5 py-1.5 text-small font-medium text-on-ink shadow-raised"
            data-testid="comment-on-selection"
          >
            <MessageSquarePlus aria-hidden className="size-3.5" />
            Comment
          </button>
        )}
      </article>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// The toolbar: track changes (always on), the markup view, the changes, and asks for the copilot

function Toolbar(props: {
  markup: Markup;
  onMarkup: (m: Markup) => void;
  changes: number;
  comments: number;
  position: number | null;
  onPrev: () => void;
  onNext: () => void;
  canComment: boolean;
  onComment: () => void;
  redlined: boolean;
}) {
  const { markup, onMarkup, changes, comments, position, onPrev, onNext, canComment, onComment, redlined } = props;
  return (
    <div className="flex min-h-[49px] flex-wrap items-center gap-x-3 gap-y-2 rounded-t-md border-b border-hairline bg-surface px-4 py-2" data-testid="document-toolbar">
      <span className="inline-flex items-center gap-1.5 text-small font-medium text-ink" title="Every edit is tracked, with who made it. Dotted: the copilot's suggestion. Solid: yours.">
        <span aria-hidden className="size-2 rounded-full bg-ink" />
        Track changes
      </span>
      <div role="radiogroup" aria-label="Markup" className="flex rounded-md bg-stone p-0.5">
        {MARKUPS.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={markup === m.id}
            title={m.title}
            onClick={() => onMarkup(m.id)}
            className={`h-7 rounded-[5px] px-2.5 text-small font-medium transition-colors ${markup === m.id ? "bg-surface text-ink shadow-[0_0_0_1px_var(--color-hairline)]" : "text-muted hover:text-ink"}`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <span className="inline-flex items-center gap-1 text-small text-muted" data-testid="document-counts">
        <span>
          {position ? `${position} of ` : ""}
          {changes} {changes === 1 ? "change" : "changes"} · {comments} {comments === 1 ? "comment" : "comments"}
        </span>
        <IconButton label="Previous change" onClick={onPrev} disabled={changes === 0}>
          <ChevronUp aria-hidden className="size-4" />
        </IconButton>
        <IconButton label="Next change" onClick={onNext} disabled={changes === 0}>
          <ChevronDown aria-hidden className="size-4" />
        </IconButton>
      </span>
      <div className="ml-auto flex items-center gap-2">
        <Button size="sm" onMouseDown={(e) => e.preventDefault()} onClick={onComment} disabled={!canComment} title={canComment ? "Comment on the selected words" : "Select words in the contract to comment on them"}>
          <MessageSquarePlus aria-hidden className="size-3.5" />
          Comment
        </Button>
        <AskMenu redlined={redlined} />
      </div>
    </div>
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className="inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-stone hover:text-ink disabled:opacity-40">
      {children}
    </button>
  );
}

/** What the copilot can do in the document, as the lines it understands (the mock plays each one). */
function AskMenu({ redlined }: { redlined: boolean }) {
  const { ask, busy } = useAskCopilot();
  const [open, setOpen] = useState(false);
  const asks = [
    ...(redlined ? [{ line: DOCUMENT_ASKS.comments, label: "Comment on each redline with its rule" }] : []),
    { line: DOCUMENT_ASKS.clause, label: "Add the SOC 2 report clause" },
    { line: DOCUMENT_ASKS.edit, label: "Edit §2.3: credits aren't the only remedy" },
  ];
  return (
    <div className="relative">
      <Button size="sm" variant="primary" disabled={busy} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" data-testid="ask-copilot-menu">
        <Sparkles aria-hidden className="size-3.5" />
        Ask the copilot
      </Button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-[300px] rounded-md border border-hairline bg-surface p-1 shadow-raised">
          {asks.map((a) => (
            <button
              key={a.line}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                openOutput("contract");
                void ask(a.line);
              }}
              className="block w-full rounded-[5px] px-2.5 py-2 text-left hover:bg-stone"
            >
              <span className="block text-small font-medium text-ink">{a.label}</span>
              <span className="mt-0.5 block text-small text-muted">“{a.line}”</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// One passage: its words on the left, its changes and comments in the margin on the right

type RowProps = {
  matterId: string;
  passage: DocPassage;
  markup: Markup;
  margin: boolean;
  active: string | null;
  flashN: number | null;
  focus: CiteFocus | null;
  comments: DocComment[];
  changes: Change[];
  requests: Finding[];
  editing: string | null;
  onEdit: (key: string | null) => void;
  composer: string | null;
  onCloseComposer: () => void;
  onHumanEdit: (edit: RedlineEdit) => void;
};

function PassageRow(props: RowProps) {
  const { matterId, passage, markup, margin, active, flashN, focus, comments, changes, requests, editing, onEdit, composer, onCloseComposer, onHumanEdit } = props;
  const [flashing, setFlashing] = useState(false);
  useEffect(() => {
    if (flashN === null) return;
    setFlashing(true);
    const timer = setTimeout(() => setFlashing(false), 1400);
    return () => {
      clearTimeout(timer);
      setFlashing(false);
    };
  }, [flashN]);

  const runs = useMemo(() => spanRuns(passage.spans), [passage.spans]);
  const anchors = useMemo(() => new Map(comments.map((c) => [c.id, c.quote ? anchorQuote(runs, c.quote, c.on ?? "current") : null])), [comments, runs]);
  const marked = useMemo(() => {
    const highlights: Highlight[] = [];
    if (margin) for (const c of comments) if (!c.resolved && anchors.get(c.id)) highlights.push({ id: c.id, ...anchors.get(c.id)! });
    const cite = focus?.quote ? anchorQuote(runs, focus.quote, "original") : null;
    if (cite) highlights.push({ id: CITE_MARK, ...cite });
    return markRuns(runs, highlights);
  }, [runs, comments, anchors, focus, margin]);

  const changed = passage.spans.some(isChanged);
  const editSpan = passage.spans.find((s) => s.key === editing) ?? null;
  const resolved = comments.filter((c) => c.resolved);
  const [showResolved, setShowResolved] = useState(false);

  /** A click on the words: focus a comment or change it is on, or edit the text there. Between lines, the nearest word counts. */
  const onClickText = (e: React.MouseEvent) => {
    if (window.getSelection()?.isCollapsed === false) return; // selecting words to comment on
    let el = (e.target as Element).closest?.("[data-run]") ?? null;
    if (!el) {
      const doc = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node } | null };
      const node = doc.caretPositionFromPoint?.(e.clientX, e.clientY)?.offsetNode ?? document.caretRangeFromPoint?.(e.clientX, e.clientY)?.startContainer ?? null;
      el = (node instanceof Element ? node : node?.parentElement)?.closest("[data-run]") ?? null;
    }
    const run = el ? marked[Number(el.getAttribute("data-run"))] : null;
    const comment = run?.marks.find((m) => m !== CITE_MARK);
    if (comment) return setActive(comment);
    if (run?.change && markup === "all") return setActive(run.change);
    if (markup !== "original") onEdit(run?.span ?? passage.spans[0].key);
  };

  return (
    <div
      id={anchor(passage.cite)}
      data-focused={focus ? "true" : undefined}
      className={`grid scroll-mt-28 grid-cols-1 gap-x-6 gap-y-2 rounded-md transition-colors duration-500 ${margin ? "@2xl:grid-cols-[minmax(0,1fr)_248px]" : ""} ${focus || flashing ? "bg-stone" : ""}`}
    >
      <div
        data-passage={passage.cite}
        className={`relative self-start py-2 pl-4 pr-2 ${changed && markup !== "original" ? "before:absolute before:bottom-2 before:left-0 before:top-2 before:w-[2px] before:rounded-full before:bg-ink" : ""}`}
      >
        {editSpan ? (
          <SpanEditor
            passage={passage}
            span={editSpan}
            onDone={(text) => {
              if (text !== null) {
                const edit = humanEditSpan(matterId, editSpan.key, text);
                if (edit) onHumanEdit(edit);
              }
              onEdit(null);
            }}
          />
        ) : (
          <p className="cursor-text text-ink [text-wrap:pretty]" data-testid="passage-text" onClick={onClickText}>
            <span className="mr-1.5 select-none font-mono text-small text-muted">{passage.cite.slice(1)}</span>
            {passage.inserted && markup !== "original" ? (
              <ins className={insClass(passage.inserted.by, markup)}>{passage.caption}.</ins>
            ) : (
              <span className="font-semibold">{passage.caption}.</span>
            )}{" "}
            {passage.inserted && markup === "original" ? <span className="text-small text-muted">(not in the vendor's draft)</span> : <Words runs={marked} markup={markup} active={active} passage={passage} />}
          </p>
        )}
      </div>

      {margin && (
        <aside aria-label={`Margin, ${passage.cite}`} className="space-y-2 pb-1 @2xl:pt-2">
          {changes.map((c) => (
            <ChangeCard key={c.id} matterId={matterId} change={c} active={active === c.id} onHumanEdit={onHumanEdit} />
          ))}
          {requests.map((f) => (
            <RequestCard key={f.ruleId} finding={f} />
          ))}
          {comments
            .filter((c) => !c.resolved)
            .map((c) => (
              <CommentCard key={c.id} matterId={matterId} comment={c} anchored={!c.quote || Boolean(anchors.get(c.id))} active={active === c.id} />
            ))}
          {composer !== null && <Composer matterId={matterId} cite={passage.cite} quote={composer} onClose={onCloseComposer} />}
          {resolved.length > 0 && (
            <div>
              <button type="button" onClick={() => setShowResolved((s) => !s)} className="text-small text-muted hover:text-ink">
                {showResolved ? "Hide" : "Show"} {resolved.length} resolved
              </button>
              {showResolved && (
                <div className="mt-2 space-y-2">
                  {resolved.map((c) => (
                    <CommentCard key={c.id} matterId={matterId} comment={c} anchored active={false} />
                  ))}
                </div>
              )}
            </div>
          )}
        </aside>
      )}
    </div>
  );
}

const insClass = (by: Author | null, markup: Markup) =>
  markup === "clean" ? "no-underline" : `font-medium no-underline [text-decoration-line:underline] decoration-1 underline-offset-[3px] ${by === "agent" ? "decoration-dotted decoration-ink" : "decoration-ink"}`;
const delClass = (by: Author | null) => `text-muted ${by === "agent" ? "decoration-dotted" : ""} decoration-muted`;

/** The words, drawn for the markup view: struck and inserted words carry their author's line (dotted for the copilot). */
function Words({ runs, markup, active, passage }: { runs: Run[]; markup: Markup; active: string | null; passage: DocPassage }) {
  const authors = new Map(passage.spans.map((s) => [s.key, s.by] as const));
  return (
    <>
      {runs.map((run, i) => {
        if (markup === "original" && run.kind === "ins") return null;
        if (markup === "clean" && run.kind === "del") return null;
        const by = authors.get(run.span) ?? null;
        const comment = run.marks.find((m) => m !== CITE_MARK) ?? null;
        const isActive = (run.change && run.change === active) || (comment && comment === active);
        let node: React.ReactNode = run.text;
        if (markup === "all" && run.kind === "del")
          node = (
            <del className={delClass(by)} title={`${authorName(by ?? "agent")} · deleted`}>
              {run.text}
            </del>
          );
        if (markup === "all" && run.kind === "ins")
          node = (
            <ins className={insClass(by, markup)} title={`${authorName(by ?? "agent")} · inserted`}>
              {run.text}
            </ins>
          );
        if (run.marks.includes(CITE_MARK)) node = <mark className="cite-mark text-ink" data-testid="cite-mark">{node}</mark>;
        if (comment) node = <mark className={`rounded-xs text-ink ${isActive ? "bg-stone-deep" : "bg-highlight/60"}`} data-comment={comment}>{node}</mark>;
        return (
          <span key={i} data-run={i} className={isActive && !comment ? "rounded-xs bg-stone" : undefined} data-change={run.change ?? undefined}>
            {node}
          </span>
        );
      })}
    </>
  );
}

/** Edit one span in place: the sentence(s) between redlines, a redlined sentence, or an added clause. */
function SpanEditor({ passage, span, onDone }: { passage: DocPassage; span: Span; onDone: (text: string | null) => void }) {
  const [text, setText] = useState(span.text);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);
  const others = passage.spans.filter((s) => s.key !== span.key);
  return (
    <div data-testid="span-editor">
      <p className="mb-1.5 text-small text-muted">
        <span className="font-mono">{passage.cite}</span> {passage.caption}
        {span.kind === "clause" ? ` · the ${span.ruleId} redline, shared with the Review table` : others.length ? " · the text around the redline" : ""}
      </p>
      <textarea
        ref={ref}
        value={text}
        aria-label={`Edit ${passage.cite}`}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onDone(text);
          }
          if (e.key === "Escape") onDone(null);
        }}
        rows={2}
        className="w-full resize-none rounded-md border border-ink bg-surface px-3 py-2 text-ink outline-none [text-wrap:pretty]"
      />
      <div className="mt-1.5 flex items-center gap-2">
        <Button size="sm" variant="primary" onClick={() => onDone(text)}>
          Save
        </Button>
        <Button size="sm" onClick={() => onDone(null)}>
          Cancel
        </Button>
        <span className="text-small text-muted">Tracked as your change · Enter to save · Esc to cancel</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// The margin

function Who({ by, at }: { by: Author; at?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {by === "agent" ? <CopilotGlyph size={20} /> : <Avatar name={CURRENT_USER.name} size={24} />}
      <span className="truncate text-small font-semibold text-ink">{authorName(by)}</span>
      {at && <span className="shrink-0 text-small text-muted">{timeLabel(at)}</span>}
    </span>
  );
}

function Card({ active, children, onClick, testId }: { active: boolean; children: React.ReactNode; onClick?: () => void; testId: string }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-md border bg-surface px-3 py-2.5 text-small transition-shadow ${active ? "border-ink shadow-raised" : "border-hairline"} ${onClick ? "cursor-pointer" : ""}`}
      data-testid={testId}
    >
      {children}
    </div>
  );
}

const VERB: Record<Change["kind"], string> = { replace: "Redline", edit: "Edited", insert: "Added" };

function ChangeCard({ matterId, change: c, active, onHumanEdit }: { matterId: string; change: Change; active: boolean; onHumanEdit: (edit: RedlineEdit) => void }) {
  const mine = c.by === "human";
  return (
    <Card active={active} onClick={() => setActive(c.id)} testId="change-card">
      <div className="flex items-center justify-between gap-2">
        <Who by={c.by} />
        <span className="shrink-0 text-small text-muted">{VERB[c.kind]}</span>
      </div>
      {c.finding ? (
        <p className="mt-1.5 text-muted">
          <span className="font-mono text-ink">{c.ruleId}</span> · {c.finding.topic}. Playbook: {c.finding.position}.
        </p>
      ) : (
        <p className="mt-1.5 text-muted">{c.kind === "insert" ? `A new clause, ${c.cite}.` : `${c.cite}, outside the playbook's rules.`}</p>
      )}
      <div className="mt-2 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        {mine ? (
          <span className="mr-auto inline-flex items-center gap-1 text-muted">
            <Check aria-hidden className="size-3.5" />
            Yours
          </span>
        ) : (
          <Button size="sm" variant="primary" onClick={() => acceptChange(matterId, c.id)} title="Keep this change, as yours" data-testid="accept-change">
            <Check aria-hidden className="size-3.5" />
            Accept
          </Button>
        )}
        <Button
          size="sm"
          onClick={() => {
            const edit = rejectChange(matterId, c.id);
            if (edit) onHumanEdit(edit);
            setActive(null);
          }}
          title={c.kind === "insert" ? "Take this clause out" : "Put the vendor's words back"}
          data-testid="reject-change"
        >
          <X aria-hidden className="size-3.5" />
          Reject
        </Button>
      </div>
    </Card>
  );
}

/** A learned rule's request: no sentence to replace, so it reads as the copilot's note on the vendor's words. */
function RequestCard({ finding: f }: { finding: Finding }) {
  return (
    <Card active={false} testId="request-card">
      <div className="flex items-center justify-between gap-2">
        <Who by="agent" />
        {f.learned && <LearnedTag id={f.learned.id} version={f.learned.version} />}
      </div>
      <p className="mt-1.5 text-ink">{f.redline}</p>
      <p className="mt-1 text-muted">
        <span className="font-mono">{f.ruleId}</span> · goes out with the redlines
      </p>
    </Card>
  );
}

function CommentCard({ matterId, comment: c, anchored, active }: { matterId: string; comment: DocComment; anchored: boolean; active: boolean }) {
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState("");
  const send = () => {
    if (!reply.trim()) return;
    replyToComment(matterId, c.id, reply, "human");
    setReply("");
    setReplying(false);
  };
  return (
    <Card active={active} onClick={() => setActive(c.id)} testId="comment-card">
      <div className="flex items-center justify-between gap-2">
        <Who by={c.by} at={c.at} />
        <span className="shrink-0 font-mono text-small text-muted">{c.id}</span>
      </div>
      {c.quote && <p className={`mt-1.5 line-clamp-2 border-l-2 border-rule pl-2 text-muted ${anchored ? "" : "line-through"}`}>“{c.quote}”</p>}
      {!anchored && <p className="mt-1 text-muted">The words it was on have changed.</p>}
      <p className="mt-1.5 text-ink [text-wrap:pretty]">{c.text}</p>
      {c.replies.map((r, i) => (
        <div key={i} className="mt-2 flex gap-1.5">
          <CornerDownRight aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted" />
          <div className="min-w-0">
            <Who by={r.by} />
            <p className="mt-0.5 text-ink">{r.text}</p>
          </div>
        </div>
      ))}
      <div className="mt-2 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        {c.resolved ? (
          <Button size="sm" onClick={() => reopenComment(matterId, c.id)}>
            <RotateCcw aria-hidden className="size-3.5" />
            Reopen
          </Button>
        ) : replying ? (
          <div className="w-full">
            <textarea
              autoFocus
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
                if (e.key === "Escape") setReplying(false);
              }}
              rows={2}
              placeholder="Reply…"
              aria-label={`Reply to ${c.id}`}
              className="w-full resize-none rounded-md border border-hairline px-2 py-1.5 text-small text-ink outline-none focus:border-ink"
            />
            <div className="mt-1 flex gap-1.5">
              <Button size="sm" variant="primary" onClick={send} disabled={!reply.trim()}>
                Reply
              </Button>
              <Button size="sm" onClick={() => setReplying(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Button size="sm" onClick={() => setReplying(true)}>
              Reply
            </Button>
            <Button size="sm" onClick={() => resolveComment(matterId, c.id, "human")} data-testid="resolve-comment">
              <Check aria-hidden className="size-3.5" />
              Resolve
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

function Composer({ matterId, cite, quote, onClose }: { matterId: string; cite: string; quote: string; onClose: () => void }) {
  const [text, setText] = useState("");
  const save = () => {
    if (!text.trim()) return;
    const result = addComment(matterId, cite, quote, text, "human");
    if (result.ok) setActive(result.commentId);
    onClose();
  };
  return (
    <Card active testId="comment-composer">
      <Who by="human" />
      {quote && <p className="mt-1.5 line-clamp-2 border-l-2 border-rule pl-2 text-muted">“{quote}”</p>}
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            save();
          }
          if (e.key === "Escape") onClose();
        }}
        rows={3}
        placeholder="Comment…"
        aria-label={`Comment on ${cite}`}
        className="mt-2 w-full resize-none rounded-md border border-hairline px-2 py-1.5 text-small text-ink outline-none focus:border-ink"
      />
      <div className="mt-1 flex gap-1.5">
        <Button size="sm" variant="primary" onClick={save} disabled={!text.trim()} data-testid="save-comment">
          Comment
        </Button>
        <Button size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
