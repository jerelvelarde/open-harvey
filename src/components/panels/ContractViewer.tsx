// The contract viewer: the document as it arrived, section by section, with stable passage ids.
// Every cite chip in the app opens it on one passage and marks the words the finding quotes, so
// "we checked it" always points at text. Passages with a finding carry its verdict and rule id
// beneath them, and the contents list names each deviating section's risk in a word. The section
// headings are the contract's own words; everywhere else a clause goes by its topic (lib/playbook.ts).

"use client";

import { X } from "lucide-react";
import { useEffect, useMemo } from "react";
import type { CiteFocus } from "@/components/cite-focus";
import { clearPassage } from "@/components/cite-focus";
import { ResultTag, SectionTag } from "@/components/ui/LegalTags";
import type { Passage } from "@/lib/contract";
import { getContract } from "@/lib/library";
import type { Finding } from "@/lib/review";
import type { MatterView } from "@/lib/store";

const anchor = (id: string) => `passage-${id.replace("§", "").replace(".", "-")}`;

/** `inMatter`: on a matter's Contract tab, under the matter's own 22px title, so the document's title steps down. */
export function ContractViewer({ view, focus, inMatter = false }: { view: MatterView; focus: CiteFocus | null; inMatter?: boolean }) {
  const contract = getContract(view.matter.id);
  const byPassage = useMemo(() => {
    const map = new Map<string, Finding[]>();
    for (const f of view.found) map.set(f.cite, [...(map.get(f.cite) ?? []), f]);
    return map;
  }, [view.found]);

  // Jump to the cited passage, every time a chip is clicked (focus.n changes)
  useEffect(() => {
    if (!focus) return;
    // Bring the passage's whole section in under the "Showing §8.2" bar: its heading first, never clipped.
    const frame = requestAnimationFrame(() => {
      const passage = document.getElementById(anchor(focus.passageId));
      (passage?.closest("section[data-section]") ?? passage)?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [focus]);

  const sectionFindings = (n: number) => view.found.filter((f) => f.cite.startsWith(`§${n}.`));

  return (
    <div className="grid grid-cols-1 gap-4 @4xl:grid-cols-[236px_minmax(0,1fr)]" data-testid="contract-viewer">
      <nav aria-label="Sections" className="hidden @4xl:block">
        <ol className="sticky top-3 space-y-0.5 text-small">
          {contract.sections.map((section) => {
            return (
              <li key={section.number}>
                <a
                  href={`#${anchor(section.passages[0]?.id ?? "")}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(anchor(section.passages[0].id))?.scrollIntoView({ block: "start", behavior: "smooth" });
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
            );
          })}
        </ol>
      </nav>

      <article aria-label={contract.title} className="min-w-0 rounded-md border border-hairline bg-surface">
        <header className="border-b border-hairline px-5 py-4 @3xl:px-8">
          <h2 className={`font-serif text-ink ${inMatter ? "text-body font-semibold" : "text-title"}`}>{contract.title}</h2>
          <p className="mt-1 text-small text-muted">
            {contract.subtitle} · {contract.sections.length} sections · {contract.words.toLocaleString("en-US")} words
          </p>
        </header>
        {focus && (
          <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-hairline bg-stone px-5 py-2 text-small @3xl:px-8" data-testid="cite-banner">
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
        <div className="max-w-[78ch] px-5 py-5 @3xl:px-8">
          {contract.sections.map((section) => (
            <section key={section.number} data-section={section.number} aria-label={`${section.number}. ${section.title}`} className="mb-6 scroll-mt-14 last:mb-0">
              <h3 className="mb-2 font-semibold text-ink">
                {section.number}. {section.title}
              </h3>
              <div className="space-y-1">
                {section.passages.map((passage) => (
                  <PassageBlock key={passage.id} passage={passage} findings={byPassage.get(passage.id) ?? []} focus={focus?.passageId === passage.id ? focus : null} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}

function PassageBlock({ passage, findings, focus }: { passage: Passage; findings: Finding[]; focus: CiteFocus | null }) {
  const quote = focus?.quote && passage.text.includes(focus.quote) ? focus.quote : null;
  const at = quote ? passage.text.indexOf(quote) : -1;
  return (
    <div
      id={anchor(passage.id)}
      data-passage={passage.id}
      data-focused={focus ? "true" : undefined}
      className={`scroll-mt-16 rounded-md px-3 py-2 transition-colors duration-300 ${focus ? "bg-stone" : ""}`}
    >
      <p className="text-ink [text-wrap:pretty]">
        <span className="mr-1.5 font-mono text-small text-muted">{passage.id.slice(1)}</span>
        <span className="font-semibold">{passage.caption}.</span>{" "}
        {at >= 0 && quote ? (
          <>
            {passage.text.slice(0, at)}
            <mark className="cite-mark text-ink" data-testid="cite-mark">
              {quote}
            </mark>
            {passage.text.slice(at + quote.length)}
          </>
        ) : (
          passage.text
        )}
      </p>
      {findings.length > 0 && (
        <p className="mt-1.5 flex flex-wrap items-center gap-2 text-small text-muted">
          {findings.map((f) => (
            <span key={f.ruleId ?? f.topic} className="inline-flex items-center gap-1.5">
              <ResultTag status={f.status} risk={f.risk} />
              {f.ruleId && <span className="font-mono">{f.ruleId}</span>}
              <span>{f.ruleId ? "· " : ""}{f.topic}</span>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
