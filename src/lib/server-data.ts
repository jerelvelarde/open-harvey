// Server-only reads of the data files that are not JSON (JSON files are imported directly), and the
// choice of model.

import { readFileSync } from "node:fs";
import path from "node:path";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import { SIGNED_DOC_IDS } from "./collection";
import { parseContract, type Contract } from "./contract";
import { parseReviewHistory } from "./learning";
import { MATTER_IDS } from "./matters";
import { createMockModel } from "./mock-model";

const dataFile = (name: string) => readFileSync(path.join(process.cwd(), "src", "data", name), "utf8");

export const readPlaybook = () => dataFile("playbook.md");
export const readReviewHistory = () => parseReviewHistory(dataFile("review-history.jsonl"));
/** The two matters' contracts, and the six signed contracts in the Vendor contracts 2026 collection (lib/collection.ts). */
export const readContracts = (): Record<string, Contract> => ({
  ...Object.fromEntries(MATTER_IDS.map((id) => [id, parseContract(dataFile(path.join("contracts", `${id}.md`)))])),
  ...Object.fromEntries(SIGNED_DOC_IDS.map((id) => [id, parseContract(dataFile(path.join("collection", `${id}.md`)))])),
});

// ---------------------------------------------------------------------------------------------
// The model, chosen in one place. COPILOT_MODEL in .env.local overrides it (any provider/model id).
// The scripted mock (lib/mock-model.ts) plays the README demo with no key and no network. It runs:
// - with COPILOT_MODEL=mock, or without OPENAI_API_KEY;
// - in a production build (`npm start`, `npm run start:public`, any deploy) unless ALLOW_REAL_MODEL=true.
//   The runtime endpoint has no auth, so a deployed server with a key would let anyone run the agent on
//   it. In production the real model is opt-in, and belongs behind your own auth.

export const DEFAULT_MODEL = "openai/gpt-5.4-mini";
export const MOCK_MODEL = "mock";

type Env = Record<string, string | undefined>;

/** The model to run, and why it is the mock when it is (null when it is the real one). */
export function chooseModel(env: Env = process.env): { model: string; mockReason: string | null } {
  const configured = env.COPILOT_MODEL?.trim();
  if (configured === MOCK_MODEL) return { model: MOCK_MODEL, mockReason: "COPILOT_MODEL=mock" };
  if (!env.OPENAI_API_KEY?.trim()) return { model: MOCK_MODEL, mockReason: "no OPENAI_API_KEY" };
  if (env.NODE_ENV === "production" && env.ALLOW_REAL_MODEL?.trim() !== "true") {
    return { model: MOCK_MODEL, mockReason: "production build without ALLOW_REAL_MODEL=true; OPENAI_API_KEY is ignored" };
  }
  return { model: configured || DEFAULT_MODEL, mockReason: null };
}

export const copilotModel = (env: Env = process.env) => chooseModel(env).model;

export const usesMockModel = (env: Env = process.env) => copilotModel(env) === MOCK_MODEL;

/** The chat always answers: on the mock without a key, on the provider with one. */
export const chatEnabled = () => usesMockModel() || Boolean(process.env.OPENAI_API_KEY?.trim());

/** What BuiltInAgent runs on: a provider/model id, or the mock model itself. */
export function agentModel(): string | LanguageModelV3 {
  const { model, mockReason } = chooseModel();
  if (!mockReason) return model;
  console.info(`[copilot] Running on the scripted mock model (${mockReason}).`);
  return createMockModel();
}

/** The model name in the chat header. */
export const modelLabel = () => (usesMockModel() ? "mock · scripted demo" : copilotModel());
