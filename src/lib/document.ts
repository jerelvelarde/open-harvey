// Concept: the contract as a live document, the way a lawyer works in Word. The vendor's draft, with
// Northstar's tracked changes in it and comments in the margin. Every change has an author (Maya or
// the copilot) and can be accepted or rejected; every comment is anchored to the exact words it is on.
//
// Nothing is stored twice. Each passage is split into spans:
// - the sentences a playbook redline replaces: their text IS the redline in the store, the same one
//   the Review table edits, so the table, the redline cards and the document never disagree;
// - the text around them: free edits, kept in the matter's document state (store.ts DocState).
// The tracked changes are worked out by comparing each span with the vendor's words
// (lib/blackline.ts). Clauses the copilot or Maya add are insertions, numbered after the section's
// last passage, so every existing cite (§8.2) stays where it is.
// Pure: tested in document.test.ts.

import { blackline } from "./blackline";
import type { Contract } from "./contract";
import type { Finding } from "./review";

export type Author = "human" | "agent";
export type DocEdit = { text: string; by: Author };
export type DocInsert = { cite: string; section: number; caption: string; text: string; by: Author; at: string };
export type DocReply = { by: Author; text: string; at: string };
/** `on`: which text the quote was found in when the comment was made (null: not found, the comment sits on the passage). */
export type DocComment = { id: string; cite: string; quote: string; on: Coordinate | null; text: string; by: Author; at: string; replies: DocReply[]; resolved: boolean };
export type DocState = { edits: Record<string, DocEdit>; inserts: DocInsert[]; comments: DocComment[] };

export const emptyDoc = (): DocState => ({ edits: {}, inserts: [], comments: [] });

/** "current": the text as it reads with the changes. "original": the vendor's words. */
export type Coordinate = "current" | "original";

/** A sentence a playbook redline replaces: the finding's clause, and the redline's text once drafted. */
export type ClauseRedline = { ruleId: string; clause: string; text: string | null; by: Author | null; finding: Finding };

export type Span =
  | { kind: "text"; key: string; cite: string; base: string; text: string; by: Author | null }
  | { kind: "clause"; key: string; cite: string; ruleId: string; base: string; text: string; by: Author | null; finding: Finding }
  | { kind: "insert"; key: string; cite: string; base: string; text: string; by: Author; insert: DocInsert };

export const norm = (text: string) => text.trim().replace(/\s+/g, " ");
export const isChanged = (span: Span) => span.text !== span.base;

/**
 * Split a passage into spans: the clauses its redlines replace, and the text around them. A text
 * span's key is "<cite>:<n>" (its place among the passage's text spans), a clause's is "rule:<ruleId>":
 * both stay the same whether or not anything has been drafted or edited yet.
 */
export function passageSpans(passage: { id: string; text: string }, clauses: readonly ClauseRedline[], edits: Readonly<Record<string, DocEdit>>): Span[] {
  const placed = clauses
    .map((c) => ({ c, at: c.clause.trim() ? passage.text.indexOf(c.clause) : -1 }))
    .filter((p) => p.at >= 0)
    .sort((a, b) => a.at - b.at);
  const spans: Span[] = [];
  let pos = 0;
  let n = 0;
  const pushText = (raw: string) => {
    const base = norm(raw);
    if (!base) return;
    const key = `${passage.id}:${n++}`;
    const edit = edits[key];
    spans.push({ kind: "text", key, cite: passage.id, base, text: edit ? norm(edit.text) : base, by: edit?.by ?? null });
  };
  for (const { c, at } of placed) {
    if (at < pos) continue; // overlaps the clause before it: the first one wins
    pushText(passage.text.slice(pos, at));
    const base = norm(c.clause);
    const drafted = c.text !== null;
    spans.push({ kind: "clause", key: `rule:${c.ruleId}`, cite: passage.id, ruleId: c.ruleId, base, text: drafted ? norm(c.text!) : base, by: drafted ? c.by : null, finding: c.finding });
    pos = at + c.clause.length;
  }
  pushText(passage.text.slice(pos));
  return spans;
}

export const insertSpan = (insert: DocInsert): Span => ({ kind: "insert", key: `insert:${insert.cite}`, cite: insert.cite, base: "", text: norm(insert.text), by: insert.by, insert });

// ---------------------------------------------------------------------------------------------
// Runs: the words of a passage in reading order, as the document draws them

export type RunKind = "same" | "del" | "ins";
/** `span`: the span the words belong to. `change`: set on struck and inserted words. `marks`: the highlights over them. */
export type Run = { kind: RunKind; text: string; span: string; change: string | null; marks: string[] };

type Part = { kind: RunKind; text: string };

/**
 * One span as words, each word as its parts. A word the blackline matched despite moved punctuation
 * ("Services" and "Services,") keeps what they share and marks only the difference, the way Word
 * shows an inserted comma, so the vendor's words and the current words both read exactly.
 */
function spanWords(span: Span): Part[][] {
  if (!isChanged(span)) return span.base.split(" ").map((w) => [{ kind: "same", text: w }]);
  if (!span.base) return span.text.split(" ").filter(Boolean).map((w) => [{ kind: "ins", text: w }]);
  return blackline(span.base, span.text).flatMap((piece): Part[][] => {
    const words = piece.text.split(" ").filter(Boolean);
    if (piece.kind !== "same" || !piece.before) return words.map((w) => [{ kind: piece.kind, text: w }]);
    const was = piece.before.split(" ");
    return words.map((w, i) => {
      const v = was[i] ?? w;
      if (v === w) return [{ kind: "same", text: w }];
      let k = 0;
      while (k < v.length && k < w.length && v[k] === w[k]) k++;
      return [{ kind: "same" as const, text: w.slice(0, k) }, { kind: "del" as const, text: v.slice(k) }, { kind: "ins" as const, text: w.slice(k) }].filter((p) => p.text);
    });
  });
}

/** Each word keeps the space after it, so the vendor's text and the current text both read with single spaces. */
export function spanRuns(spans: readonly Span[]): Run[] {
  const runs: Run[] = [];
  const words = spans.flatMap((span) => spanWords(span).map((parts) => ({ span, parts })));
  words.forEach(({ span, parts: word }, wi) => {
    const changed = isChanged(span);
    // The space after a word belongs to the readings the word is in: a whole struck or inserted word
    // takes it; a word that is partly shared ("Services" + ",") leaves it to both.
    const mixed = word.length > 1 && word.at(-1)!.kind !== "same";
    const parts: Part[] = wi < words.length - 1 ? (mixed ? [...word, { kind: "same", text: " " }] : word.map((p, pi) => (pi === word.length - 1 ? { ...p, text: `${p.text} ` } : p))) : word;
    parts.forEach((part) => {
      const text = part.text;
      const run: Run = { kind: part.kind, text, span: span.key, change: changed && part.kind !== "same" ? span.key : null, marks: [] };
      const last = runs.at(-1);
      // A space after a struck or inserted word belongs to it; merge runs that read the same way.
      if (last && last.kind === run.kind && last.span === run.span && last.change === run.change) last.text += run.text;
      else runs.push(run);
    });
  });
  return runs;
}

export const originalText = (runs: readonly Run[]) => runs.filter((r) => r.kind !== "ins").map((r) => r.text).join("").trim();
export const currentText = (runs: readonly Run[]) => runs.filter((r) => r.kind !== "del").map((r) => r.text).join("").trim();

export type Highlight = { id: string; on: Coordinate; start: number; end: number };

/** Find words in a passage: in the text as it reads now, or failing that in the vendor's words (or the other way round). */
export function anchorQuote(runs: readonly Run[], quote: string, prefer: Coordinate = "current"): Omit<Highlight, "id"> | null {
  const q = norm(quote);
  if (!q) return null;
  for (const on of prefer === "current" ? (["current", "original"] as const) : (["original", "current"] as const)) {
    const text = on === "current" ? currentText(runs) : originalText(runs);
    const at = text.indexOf(q);
    if (at >= 0) return { on, start: at, end: at + q.length };
  }
  return null;
}

/** Widen a range to whole words, so a sloppy selection ("e will make the Services av") quotes words. */
export function snapToWords(text: string, start: number, end: number): { start: number; end: number } {
  let s = Math.max(0, start);
  let e = Math.min(text.length, end);
  while (s > 0 && !/\s/.test(text[s - 1])) s--;
  while (e < text.length && !/\s/.test(text[e])) e++;
  return { start: s, end: e };
}

/** Split the runs where highlights start and end, and tag each piece with the highlights over it. */
export function markRuns(runs: readonly Run[], highlights: readonly Highlight[]): Run[] {
  if (highlights.length === 0) return [...runs];
  const out: Run[] = [];
  let original = 0;
  let current = 0;
  for (const run of runs) {
    const len = run.text.length;
    const starts: Record<Coordinate, number | null> = { original: run.kind !== "ins" ? original : null, current: run.kind !== "del" ? current : null };
    const over = highlights.filter((h) => starts[h.on] !== null);
    const cuts = new Set([0, len]);
    for (const h of over) {
      for (const p of [h.start - starts[h.on]!, h.end - starts[h.on]!]) if (p > 0 && p < len) cuts.add(p);
    }
    const points = [...cuts].sort((a, b) => a - b);
    for (let i = 0; i < points.length - 1; i++) {
      const [a, b] = [points[i], points[i + 1]];
      const marks = over.filter((h) => h.start < starts[h.on]! + b && h.end > starts[h.on]! + a).map((h) => h.id);
      out.push({ ...run, text: run.text.slice(a, b), marks: [...run.marks, ...marks] });
    }
    if (starts.original !== null) original += len;
    if (starts.current !== null) current += len;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// The document: every passage with its spans, the inserted clauses in their sections

export type DocPassage = { cite: string; section: number; caption: string; spans: Span[]; inserted: DocInsert | null };
export type DocSection = { number: number; title: string; passages: DocPassage[] };

export function documentSections(contract: Contract, clauses: readonly ClauseRedline[], doc: DocState): DocSection[] {
  return contract.sections.map((section) => ({
    number: section.number,
    title: section.title,
    passages: [
      ...section.passages.map((p) => ({ cite: p.id, section: section.number, caption: p.caption, spans: passageSpans(p, clauses, doc.edits), inserted: null })),
      ...doc.inserts.filter((i) => i.section === section.number).map((i) => ({ cite: i.cite, section: i.section, caption: i.caption, spans: [insertSpan(i)], inserted: i })),
    ],
  }));
}

export const allPassages = (sections: readonly DocSection[]) => sections.flatMap((s) => s.passages);

/** A tracked change, in document order. Its id is its span's key: "rule:PB-LIAB-01", "§2.3:0" or "insert:§5.4". */
export type Change = { id: string; cite: string; kind: "replace" | "edit" | "insert"; by: Author; ruleId: string | null; before: string; after: string; finding: Finding | null };

export function documentChanges(sections: readonly DocSection[]): Change[] {
  return allPassages(sections).flatMap((p) =>
    p.spans.filter(isChanged).map((s) => ({
      id: s.key,
      cite: s.cite,
      kind: s.kind === "insert" ? ("insert" as const) : s.kind === "clause" ? ("replace" as const) : ("edit" as const),
      by: s.by ?? "agent",
      ruleId: s.kind === "clause" ? s.ruleId : null,
      before: s.base,
      after: s.text,
      finding: s.kind === "clause" ? s.finding : null,
    })),
  );
}

/** The number a new clause gets: one after the last passage in its section, counting clauses already added. */
export function nextClauseCite(contract: Contract, inserts: readonly DocInsert[], section: number): string | null {
  const s = contract.sections.find((x) => x.number === section);
  if (!s) return null;
  const used = [...s.passages.map((p) => p.id), ...inserts.filter((i) => i.section === section).map((i) => i.cite)].map((cite) => Number(cite.split(".")[1]));
  return `§${section}.${Math.max(0, ...used) + 1}`;
}

/** Where a suggested edit lands: the first span whose current text holds the words, and that span's new text. */
export function locateEdit(spans: readonly Span[], find: string, replaceWith: string): { span: Span; next: string } | { error: string } {
  const f = norm(find);
  if (!f) return { error: "find is empty: quote the exact words to change." };
  const span = spans.find((s) => s.text.includes(f));
  if (!span) {
    const reads = spans.map((s) => s.text).join(" ");
    return { error: `"${f}" is not in ${spans[0]?.cite ?? "the passage"} as it reads now (a change can't cross from a redlined sentence into the text around it). It reads: "${reads}"` };
  }
  return { span, next: norm(span.text.replace(f, norm(replaceWith))) };
}
