// The world of the story: Northstar Software (fictional), its people, and the story clock.
// Everything comes from src/data/company.json; nothing here is invented at run time.

import company from "@/data/company.json";

export type Person = (typeof company.people)[number];

export const COMPANY = company.company;
export const PEOPLE: readonly Person[] = company.people;
export const PERSON_IDS = PEOPLE.map((p) => p.id);

/** The story is pinned to Thu Nov 5 2026, so dates read the same whenever the demo runs. */
export const STORY_DATE = company.storyDate;
/** CFO line for PB-APR-03: total contract value above this goes to the CFO. */
export const CFO_THRESHOLD = company.approvalThresholds.cfoAboveTotalContractValue;

export function getPerson(id: string): Person {
  const person = PEOPLE.find((p) => p.id === id);
  if (!person) throw new Error(`Unknown person: ${id}`);
  return person;
}

/** Maya Chen, Senior Counsel: at the keyboard for the whole demo. */
export const CURRENT_USER = getPerson("maya");

/** The quiet line every page carries, and the README: the name is a nod, not an affiliation. */
export const DISCLAIMER =
  "Open Harvey is an open-source demo built with CopilotKit, inspired by the patterns of leading legal AI products. Not affiliated with or endorsed by Harvey.";

/** "Now" on the story clock, for decisions and sends: the story date at 10:00 Pacific. */
export const storyNow = () => `${STORY_DATE}T10:00`;
