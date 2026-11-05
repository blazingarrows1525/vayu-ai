/**
 * Product facts the interface states (counts on the landing page, upload formats). Each list
 * mirrors the intelligence plane's code; `product.test.ts` fails if they drift apart.
 */

/** Mirrors PROVIDER_ORDER in apps/ai/app/services/llm.py. */
export const LLM_PROVIDERS = ["Gemini", "Groq", "NVIDIA", "OpenAI", "OpenRouter", "Anthropic"] as const;

/** One per AgentConfig in apps/ai/app/agents/registry.py. */
export const AGENT_KINDS = ["Research", "Writing", "SEO", "Documentation", "Proofreading", "Interview prep", "Resume"] as const;

/** File types Research accepts for upload; each is parsed by apps/ai/app/rag/parsing.py. */
export const RESEARCH_FILE_TYPES = [
  { ext: "pdf", label: "PDF" },
  { ext: "docx", label: "Word" },
  { ext: "pptx", label: "PowerPoint" },
  { ext: "xlsx", label: "Excel" },
  { ext: "csv", label: "CSV" },
  { ext: "md", label: "Markdown" },
  { ext: "txt", label: "text" },
] as const;

export const RESEARCH_ACCEPT = RESEARCH_FILE_TYPES.map((t) => `.${t.ext}`).join(",");

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
/** "six" for 6 (falls back to digits above ten). */
export function spelled(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}
