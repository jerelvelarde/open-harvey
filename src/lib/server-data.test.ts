// The model gate: the mock without a key, the real model in development with one, and in a production
// build (any deploy) the mock unless ALLOW_REAL_MODEL=true, so a public server never spends a key.

import { describe, expect, it } from "vitest";
import { DEFAULT_MODEL, MOCK_MODEL, chooseModel } from "./server-data";

const KEY = "test-not-a-real-key";

describe("the model gate", () => {
  it("runs the mock without a key, in any mode", () => {
    expect(chooseModel({})).toEqual({ model: MOCK_MODEL, mockReason: "no OPENAI_API_KEY" });
    expect(chooseModel({ OPENAI_API_KEY: "  ", NODE_ENV: "development" }).model).toBe(MOCK_MODEL);
    expect(chooseModel({ NODE_ENV: "production", ALLOW_REAL_MODEL: "true" }).model).toBe(MOCK_MODEL);
  });

  it("runs the mock when COPILOT_MODEL=mock, even with a key and the real model allowed", () => {
    expect(chooseModel({ OPENAI_API_KEY: KEY, COPILOT_MODEL: "mock" })).toEqual({ model: MOCK_MODEL, mockReason: "COPILOT_MODEL=mock" });
    expect(chooseModel({ OPENAI_API_KEY: KEY, COPILOT_MODEL: "mock", NODE_ENV: "production", ALLOW_REAL_MODEL: "true" }).model).toBe(MOCK_MODEL);
  });

  it("runs the real model in development with a key: the default, or COPILOT_MODEL", () => {
    expect(chooseModel({ OPENAI_API_KEY: KEY, NODE_ENV: "development" })).toEqual({ model: DEFAULT_MODEL, mockReason: null });
    expect(chooseModel({ OPENAI_API_KEY: KEY, NODE_ENV: "development", COPILOT_MODEL: "openai/gpt-5.4" }).model).toBe("openai/gpt-5.4");
  });

  it("ignores the key in a production build unless ALLOW_REAL_MODEL=true", () => {
    const gated = chooseModel({ OPENAI_API_KEY: KEY, NODE_ENV: "production" });
    expect(gated.model).toBe(MOCK_MODEL);
    expect(gated.mockReason).toContain("ALLOW_REAL_MODEL=true");
    expect(chooseModel({ OPENAI_API_KEY: KEY, NODE_ENV: "production", ALLOW_REAL_MODEL: "false" }).model).toBe(MOCK_MODEL);
    expect(chooseModel({ OPENAI_API_KEY: KEY, NODE_ENV: "production", ALLOW_REAL_MODEL: "1" }).model).toBe(MOCK_MODEL);
  });

  it("runs the real model in a production build only when ALLOW_REAL_MODEL=true", () => {
    expect(chooseModel({ OPENAI_API_KEY: KEY, NODE_ENV: "production", ALLOW_REAL_MODEL: "true" })).toEqual({ model: DEFAULT_MODEL, mockReason: null });
  });
});
