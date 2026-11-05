import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AGENT_KINDS, LLM_PROVIDERS, RESEARCH_FILE_TYPES, spelled } from "./product";

const ai = (path: string) => readFileSync(fileURLToPath(new URL(`../../ai/app/${path}`, import.meta.url)), "utf8");

/** The landing page states these counts, so they must match the intelligence plane's code. */
describe("product facts match the intelligence plane", () => {
  it("lists the same LLM providers, in routing order", () => {
    const order = ai("services/llm.py").match(/PROVIDER_ORDER = \[([^\]]+)\]/)?.[1];
    expect(order).toBeDefined();
    const providers = [...order!.matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
    expect(providers).toEqual(LLM_PROVIDERS.map((p) => p.toLowerCase()));
  });

  it("has one agent kind per registered agent", () => {
    const registered = (ai("agents/registry.py").match(/AgentConfig\(/g) ?? []).length;
    expect(registered).toBe(AGENT_KINDS.length);
  });

  it("only offers upload types the parser understands", () => {
    const parsing = ai("rag/parsing.py");
    for (const { ext } of RESEARCH_FILE_TYPES) expect(parsing).toContain(`"${ext}":`);
  });
});

describe("spelled", () => {
  it("spells small numbers and keeps larger ones as digits", () => {
    expect(spelled(6)).toBe("six");
    expect(spelled(42)).toBe("42");
  });
});
