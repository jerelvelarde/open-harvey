// Concept: CopilotKit Intelligence, optional and off by default. Server only.
//
// Off (the default, and the stage demo): the runtime is exactly `{ agents: { default: agent } }`, the
// browser records nothing, and no request leaves the machine except to the model.
//
// On: the runtime runs in Intelligence mode. Threads persist in your Intelligence project, every run
// and every browser Trajectory is put in one Learning Space, and the gated decisions (plan approved,
// sent for approval, each approver's decision with their words, Maya's redline edits, a rule
// published) go to the Trajectory as developer events (lib/trajectory-events.ts). Automatic Learning
// works from those. It takes two settings, so a stray key never switches it on:
//
//   CPK_INTELLIGENCE_ENABLED=true
//   CPK_INTELLIGENCE_API_KEY=<the project key; the name the runtime itself documents>
//   CPK_INTELLIGENCE_LEARNING_CONTAINER_ID=vendor-contract-review   (optional; this is the default)
//
// The user is resolved here on the server, never from the browser: Maya Chen, the demo's signed-in user.

import { CopilotKitIntelligence, PlatformRequestError, type BuiltInAgent, type CopilotKitIntelligenceConfig, type CopilotRuntimeOptions, type CopilotRuntimeUser } from "@copilotkit/runtime/v2";
import { CURRENT_USER } from "./company";

export const DEFAULT_LEARNING_SPACE = "vendor-contract-review";
/** The shape Intelligence accepts for a Learning Space ID. */
const SPACE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type Env = Readonly<Record<string, string | undefined>>;

export type IntelligenceSettings =
  | { enabled: false; problem: string | null }
  | { enabled: true; apiKey: string; learningSpace: string; user: CopilotRuntimeUser };

/** What the browser may know: whether it is on, the Space, and any setup problem. Never the key. */
export type IntelligencePublic = { enabled: boolean; learningSpace: string | null; problem: string | null };

const isOn = (value: string | undefined) => /^(true|1|on|yes)$/i.test(value?.trim() ?? "");

/** The switch, read once from the environment. Both the flag and the key, or it stays off. */
export function intelligenceSettings(env: Env): IntelligenceSettings {
  if (!isOn(env.CPK_INTELLIGENCE_ENABLED)) return { enabled: false, problem: null };
  const apiKey = env.CPK_INTELLIGENCE_API_KEY?.trim();
  if (!apiKey) return { enabled: false, problem: "CPK_INTELLIGENCE_ENABLED is on but CPK_INTELLIGENCE_API_KEY is empty, so CopilotKit Intelligence stays off." };
  const learningSpace = env.CPK_INTELLIGENCE_LEARNING_CONTAINER_ID?.trim() || DEFAULT_LEARNING_SPACE;
  if (!SPACE_ID.test(learningSpace) || learningSpace.length > 64) {
    return { enabled: false, problem: `CPK_INTELLIGENCE_LEARNING_CONTAINER_ID "${learningSpace}" is not a Learning Space ID (lowercase letters, digits and hyphens), so CopilotKit Intelligence stays off.` };
  }
  return { enabled: true, apiKey, learningSpace, user: { id: CURRENT_USER.id, name: CURRENT_USER.name } };
}

export const publicSettings = (s: IntelligenceSettings): IntelligencePublic =>
  s.enabled ? { enabled: true, learningSpace: s.learningSpace, problem: null } : { enabled: false, learningSpace: null, problem: s.problem };

/** The Intelligence client for these settings: every run and every Trajectory goes to the one Space. */
export function intelligenceConfig(s: Extract<IntelligenceSettings, { enabled: true }>): CopilotKitIntelligenceConfig {
  return {
    apiKey: s.apiKey,
    getLearningContainerId: () => s.learningSpace,
    getTrajectoryLearningContainerIds: () => [s.learningSpace],
  };
}

/**
 * The runtime's options. Off: exactly what the app has always run. On: Intelligence mode, with the
 * user resolved on the server. `makeIntelligence` is for tests.
 */
export function runtimeOptions(
  env: Env,
  agent: BuiltInAgent,
  makeIntelligence: (config: CopilotKitIntelligenceConfig) => CopilotKitIntelligence = (config) => new CopilotKitIntelligence(config),
): CopilotRuntimeOptions {
  const s = intelligenceSettings(env);
  if (!s.enabled) return { agents: { default: agent } };
  return {
    agents: { default: agent },
    intelligence: makeIntelligence(intelligenceConfig(s)),
    identifyUser: () => s.user,
  };
}

// ---------------------------------------------------------------------------------------------
// Fail loud: one cheap authenticated read that proves the key, the network and the Space

export type IntelligenceStatus =
  | { state: "off" }
  | { state: "connected"; message: string }
  /** It works, but the Space is missing: runs and Trajectories connect without a Space. */
  | { state: "warning"; message: string }
  | { state: "error"; message: string };

/** Turn a failed check into a sentence a presenter can act on. */
export function describeIntelligenceError(error: unknown, space: string): IntelligenceStatus {
  if (error instanceof PlatformRequestError || (typeof error === "object" && error !== null && typeof (error as { status?: unknown }).status === "number")) {
    const status = (error as { status: number }).status;
    if (status === 401) return { state: "error", message: "CopilotKit Intelligence refused the API key (401). Check CPK_INTELLIGENCE_API_KEY: it must be this project's key." };
    if (status === 403) return { state: "error", message: "CopilotKit Intelligence refused the request (403). The key's project may not have Learning enabled." };
    if (status === 404)
      return {
        state: "warning",
        message: `The Learning Space "${space}" does not exist in this Intelligence project, so conversations and Trajectories connect without a Space. Create it in the Intelligence dashboard or set CPK_INTELLIGENCE_LEARNING_CONTAINER_ID.`,
      };
    return { state: "error", message: `CopilotKit Intelligence answered ${status}. Conversations may not reach Automatic Learning.` };
  }
  const name = error instanceof Error ? error.name : "";
  if (name === "TimeoutError" || name === "AbortError") return { state: "error", message: "CopilotKit Intelligence did not answer within 5 seconds. Check the network; the chat may fail until it does." };
  return { state: "error", message: `Can't reach CopilotKit Intelligence (${error instanceof Error ? error.message : String(error)}). Check the network; the chat may fail until it does.` };
}

/** Read the Learning Space with the server's key: proves the key, the connection and the Space in one call. */
export async function checkIntelligence(env: Env, makeIntelligence: (config: CopilotKitIntelligenceConfig) => CopilotKitIntelligence = (config) => new CopilotKitIntelligence(config)): Promise<IntelligenceStatus> {
  const s = intelligenceSettings(env);
  if (!s.enabled) return s.problem ? { state: "error", message: s.problem } : { state: "off" };
  try {
    const space = await makeIntelligence(intelligenceConfig(s)).experimental.learning.getLearningContainer({ containerId: s.learningSpace, signal: AbortSignal.timeout(5000) });
    return { state: "connected", message: `Connected to CopilotKit Intelligence · Learning Space "${space.name}" (${space.id}) · signed in as ${s.user.name}.` };
  } catch (error) {
    return describeIntelligenceError(error, s.learningSpace);
  }
}
