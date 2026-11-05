// The Intelligence switch: off unless both the flag and the key are set, exactly today's runtime when
// off, one Learning Space for runs and Trajectories when on, the user from the server, and failures
// that say what to fix. No test makes a network call.

import { BuiltInAgent, PlatformRequestError, type CopilotKitIntelligence, type CopilotKitIntelligenceConfig } from "@copilotkit/runtime/v2";
import { describe, expect, it } from "vitest";
import { DEFAULT_LEARNING_SPACE, checkIntelligence, describeIntelligenceError, intelligenceSettings, publicSettings, runtimeOptions } from "./intelligence";

const KEY = "test-not-a-real-key";
const agent = new BuiltInAgent({ model: "openai/gpt-5.4-mini", prompt: "test" });

/** A stand-in client that records its config and answers the Space read as told. */
function fakeIntelligence(answer: () => Promise<unknown>) {
  const configs: CopilotKitIntelligenceConfig[] = [];
  const make = (config: CopilotKitIntelligenceConfig) => {
    configs.push(config);
    return { experimental: { learning: { getLearningContainer: answer } } } as unknown as CopilotKitIntelligence;
  };
  return { make, configs };
}

describe("the switch", () => {
  it("is off by default, and a key alone does not turn it on", () => {
    expect(intelligenceSettings({})).toEqual({ enabled: false, problem: null });
    expect(intelligenceSettings({ CPK_INTELLIGENCE_API_KEY: KEY })).toEqual({ enabled: false, problem: null });
    expect(intelligenceSettings({ CPK_INTELLIGENCE_ENABLED: "false", CPK_INTELLIGENCE_API_KEY: KEY })).toEqual({ enabled: false, problem: null });
  });

  it("says so when the flag is on without a key, and stays off", () => {
    const s = intelligenceSettings({ CPK_INTELLIGENCE_ENABLED: "true", CPK_INTELLIGENCE_API_KEY: "  " });
    expect(s.enabled).toBe(false);
    expect(!s.enabled && s.problem).toContain("CPK_INTELLIGENCE_API_KEY is empty");
  });

  it("is on with both, in the vendor-contract-review Space, as Maya Chen", () => {
    expect(intelligenceSettings({ CPK_INTELLIGENCE_ENABLED: "true", CPK_INTELLIGENCE_API_KEY: KEY })).toEqual({
      enabled: true,
      apiKey: KEY,
      learningSpace: DEFAULT_LEARNING_SPACE,
      user: { id: "maya", name: "Maya Chen" },
    });
    expect(DEFAULT_LEARNING_SPACE).toBe("vendor-contract-review");
  });

  it("takes another Space from the environment, and refuses one that is not a Space ID", () => {
    const on = { CPK_INTELLIGENCE_ENABLED: "1", CPK_INTELLIGENCE_API_KEY: KEY };
    expect(intelligenceSettings({ ...on, CPK_INTELLIGENCE_LEARNING_CONTAINER_ID: "legal-ops" })).toMatchObject({ enabled: true, learningSpace: "legal-ops" });
    const bad = intelligenceSettings({ ...on, CPK_INTELLIGENCE_LEARNING_CONTAINER_ID: "Vendor Contracts" });
    expect(bad.enabled).toBe(false);
  });

  it("never hands the key to the browser", () => {
    const pub = publicSettings(intelligenceSettings({ CPK_INTELLIGENCE_ENABLED: "true", CPK_INTELLIGENCE_API_KEY: KEY }));
    expect(pub).toEqual({ enabled: true, learningSpace: "vendor-contract-review", problem: null });
    expect(JSON.stringify(pub)).not.toContain(KEY);
  });
});

describe("the runtime's options", () => {
  it("off: exactly today's runtime, one agent and nothing else, and no client is built", () => {
    const { make, configs } = fakeIntelligence(async () => ({}));
    for (const env of [{}, { CPK_INTELLIGENCE_API_KEY: KEY }, { CPK_INTELLIGENCE_ENABLED: "true" }]) {
      const options = runtimeOptions(env, agent, make);
      expect(Object.keys(options)).toEqual(["agents"]);
      expect(options.agents).toEqual({ default: agent });
    }
    expect(configs).toEqual([]);
  });

  it("on: Intelligence mode, the user from the server, runs and Trajectories in the one Space", async () => {
    const { make, configs } = fakeIntelligence(async () => ({}));
    const options = runtimeOptions({ CPK_INTELLIGENCE_ENABLED: "true", CPK_INTELLIGENCE_API_KEY: KEY }, agent, make);
    expect(Object.keys(options).sort()).toEqual(["agents", "identifyUser", "intelligence"]);
    expect(options.agents).toEqual({ default: agent });
    const identify = (options as { identifyUser: (r: Request) => unknown }).identifyUser;
    // Whatever the browser sends, the user is Maya.
    expect(await identify(new Request("http://localhost/api/copilotkit", { headers: { "x-user-id": "mallory" } }))).toEqual({ id: "maya", name: "Maya Chen" });
    const config = configs[0];
    expect(config.apiKey).toBe(KEY);
    expect(await config.getLearningContainerId?.({ surface: "web", user: { id: "maya", name: "Maya Chen" }, agentId: "default", input: {} as never })).toBe("vendor-contract-review");
    expect(await config.getTrajectoryLearningContainerIds?.({ trajectoryId: crypto.randomUUID(), user: { id: "maya", name: "Maya Chen" } })).toEqual(["vendor-contract-review"]);
  });
});

describe("failing loud", () => {
  const on = { CPK_INTELLIGENCE_ENABLED: "true", CPK_INTELLIGENCE_API_KEY: KEY };

  it("reports off, or the setup problem, without a request", async () => {
    expect(await checkIntelligence({})).toEqual({ state: "off" });
    expect(await checkIntelligence({ CPK_INTELLIGENCE_ENABLED: "true" })).toMatchObject({ state: "error" });
  });

  it("names the Space when it is there", async () => {
    const { make } = fakeIntelligence(async () => ({ id: "vendor-contract-review", name: "Vendor contract review" }));
    expect(await checkIntelligence(on, make)).toEqual({ state: "connected", message: 'Connected to CopilotKit Intelligence · Learning Space "Vendor contract review" (vendor-contract-review) · signed in as Maya Chen.' });
  });

  it("says what to fix for a wrong key, a refusal, a missing Space, a timeout and no network", async () => {
    const fail = (error: unknown) => checkIntelligence(on, fakeIntelligence(async () => Promise.reject(error)).make);
    expect(await fail(new PlatformRequestError("Unauthorized", 401))).toMatchObject({ state: "error", message: expect.stringContaining("refused the API key (401)") });
    expect(await fail(new PlatformRequestError("Forbidden", 403))).toMatchObject({ state: "error", message: expect.stringContaining("(403)") });
    // A missing Space warns and carries on, as the runtime does.
    expect(await fail(new PlatformRequestError("Not found", 404))).toMatchObject({ state: "warning", message: expect.stringContaining('"vendor-contract-review" does not exist') });
    expect(await fail(Object.assign(new Error("timed out"), { name: "TimeoutError" }))).toMatchObject({ state: "error", message: expect.stringContaining("did not answer within 5 seconds") });
    expect(await fail(new TypeError("fetch failed"))).toMatchObject({ state: "error", message: expect.stringContaining("Can't reach CopilotKit Intelligence (fetch failed)") });
    expect(describeIntelligenceError(new PlatformRequestError("Bad gateway", 502), "x")).toMatchObject({ state: "error", message: expect.stringContaining("502") });
  });
});
