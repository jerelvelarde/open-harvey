// A redline as a lawyer reads it: the vendor's own words with the changed ones struck through and
// Northstar's words inserted, word by word. blackline() compares the sentence the redline replaces
// (the contract's words, never a summary) with the redline, keeps the words they share, and marks
// the rest. When the two share too little to read as an edit, it strikes the whole sentence and
// inserts the whole redline instead. Pure: tested in blackline.test.ts.

/** `before`: on a "same" piece whose words differ from the vendor's only in trailing punctuation, the vendor's words. */
export type Piece = { kind: "same" | "del" | "ins"; text: string; before?: string };

/** Below this share of common words, show the redline as a replacement, not an edit. */
const MIN_SHARED = 0.4;

export function blackline(before: string, after: string): Piece[] {
  const a = before.trim().split(/\s+/).filter(Boolean);
  const b = after.trim().split(/\s+/).filter(Boolean);
  // Longest common subsequence of words, then walk it to emit pieces in order.
  // Words match whatever punctuation follows them ("Services" and "Services,"), so a moved comma is not a struck word.
  const same = (x: string, y: string) => x.replace(/[,.;:]+$/, "") === y.replace(/[,.;:]+$/, "");
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) lcs[i][j] = same(a[i], b[j]) ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  }
  const shared = lcs[0][0];
  if (shared < MIN_SHARED * Math.max(a.length, b.length)) {
    return [
      { kind: "del", text: a.join(" ") },
      { kind: "ins", text: b.join(" ") },
    ].filter((p) => p.text) as Piece[];
  }
  const pieces: (Piece & { before: string })[] = [];
  const push = (kind: Piece["kind"], word: string, before = word) => {
    const last = pieces.at(-1);
    if (last?.kind === kind) {
      last.text += ` ${word}`;
      last.before += ` ${before}`;
    } else pieces.push({ kind, text: word, before });
  };
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && same(a[i], b[j])) {
      push("same", b[j], a[i]);
      i++;
      j++;
    } else if (j === b.length || (i < a.length && lcs[i + 1][j] >= lcs[i][j + 1])) {
      // On a tie the struck words come first: "~~three (3)~~ twelve (12)".
      push("del", a[i]);
      i++;
    } else {
      push("ins", b[j]);
      j++;
    }
  }
  return pieces.map(({ before, ...piece }) => (piece.kind === "same" && before !== piece.text ? { ...piece, before } : piece));
}
