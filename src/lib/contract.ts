// Concept: the contract as data. A contract in src/data/contracts/*.md is plain markdown:
//
//   # Master Services Agreement
//   <one line: parties, form, date>
//   ## 8. Limitation of liability
//   **8.2 Cap.** Each party's total liability ...
//
// parseContract turns it into sections and passages with stable ids ("§8.2"), so every finding can
// cite the exact passage and the contract viewer can jump to it and highlight the quoted words.
// Pure: tested in contract.test.ts.

export type PassageId = `§${number}.${number}`;
export type Passage = { id: PassageId; section: number; caption: string; text: string };
export type Section = { number: number; title: string; passages: Passage[] };
export type Contract = { title: string; subtitle: string; sections: Section[]; words: number };

const SECTION = /^## (\d+)\. (.+)$/;
const PASSAGE = /^\*\*(\d+)\.(\d+) ([^*]+?)\.\*\*\s+(.+)$/;

export function parseContract(markdown: string): Contract {
  let title = "";
  let subtitle = "";
  const sections: Section[] = [];
  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("# ")) {
      title = line.slice(2).trim();
      continue;
    }
    const section = SECTION.exec(line);
    if (section) {
      sections.push({ number: Number(section[1]), title: section[2].trim(), passages: [] });
      continue;
    }
    const passage = PASSAGE.exec(line);
    if (passage) {
      const current = sections.at(-1);
      if (!current || Number(passage[1]) !== current.number) throw new Error(`Passage ${passage[1]}.${passage[2]} is outside its section`);
      current.passages.push({ id: `§${passage[1]}.${passage[2]}` as PassageId, section: current.number, caption: passage[3].trim(), text: passage[4].trim() });
      continue;
    }
    if (!subtitle && sections.length === 0) subtitle = line;
  }
  const words = markdown.replace(/[#*]/g, " ").split(/\s+/).filter(Boolean).length;
  return { title, subtitle, sections, words };
}

export function findPassage(contract: Contract, id: string): Passage | null {
  for (const section of contract.sections) {
    const passage = section.passages.find((p) => p.id === id);
    if (passage) return passage;
  }
  return null;
}

/** "§8.1–8.3": the passages of one section, for "what it read". */
export function sectionRange(contract: Contract, sectionNumber: number): string {
  const section = contract.sections.find((s) => s.number === sectionNumber);
  if (!section || section.passages.length === 0) return `§${sectionNumber}`;
  const first = section.passages[0].id;
  const last = section.passages.at(-1)!.id;
  return first === last ? first : `${first}–${last.slice(1)}`;
}

export const sectionOf = (id: string) => Number(id.replace("§", "").split(".")[0]);
