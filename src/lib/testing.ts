// For tests only: load the data files from disk the way the server does (lib/server-data.ts), so the
// tests run against the same contracts, playbook and history as the app.

import { readFileSync } from "node:fs";
import path from "node:path";
import { SIGNED_DOC_IDS } from "./collection";
import { parseContract } from "./contract";
import { parseReviewHistory } from "./learning";
import { loadLibrary } from "./library";
import { MATTER_IDS } from "./matters";
import { parsePlaybook } from "./playbook";

export const readData = (name: string) => readFileSync(path.join(process.cwd(), "src", "data", name), "utf8");

export const contracts = {
  ...Object.fromEntries(MATTER_IDS.map((id) => [id, parseContract(readData(`contracts/${id}.md`))])),
  ...Object.fromEntries(SIGNED_DOC_IDS.map((id) => [id, parseContract(readData(`collection/${id}.md`))])),
};
export const playbookText = readData("playbook.md");
export const playbook = parsePlaybook(playbookText);
export const history = parseReviewHistory(readData("review-history.jsonl"));

/** Hand the documents to the tool handlers, as the app does on load. */
export const loadTestLibrary = () => loadLibrary({ contracts, playbook, history });
