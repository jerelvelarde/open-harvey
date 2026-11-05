// A redline drawn as a blackline: the vendor's words, the ones Northstar changes struck through, and
// Northstar's words inserted with a quiet underline, so it reads as a legal markup rather than a link.
// The words come from lib/blackline.ts; this only draws them.

import { blackline } from "@/lib/blackline";

export function Blackline({ before, after, className = "" }: { before: string; after: string; className?: string }) {
  const pieces = blackline(before, after);
  return (
    <p className={`text-quote text-ink [text-wrap:pretty] ${className}`} data-testid="blackline">
      {pieces.map((piece, i) => {
        const gap = i < pieces.length - 1 ? " " : "";
        if (piece.kind === "del") {
          return (
            <span key={i}>
              <del className="text-muted decoration-muted/70" data-testid="struck">
                {piece.text}
              </del>
              {gap}
            </span>
          );
        }
        if (piece.kind === "ins") {
          return (
            <span key={i}>
              <ins className="font-medium no-underline [text-decoration-line:underline] decoration-rule decoration-1 underline-offset-[3px]" data-testid="inserted">
                {piece.text}
              </ins>
              {gap}
            </span>
          );
        }
        return (
          <span key={i}>
            {piece.text}
            {gap}
          </span>
        );
      })}
    </p>
  );
}
