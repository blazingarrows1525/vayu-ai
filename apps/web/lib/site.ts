export const site = {
  name: "VAYU AI",
  tagline: "Intelligence at the speed of thought.",
  description:
    "An AI-native workspace that fuses a Notion-grade editor, a research engine, and a fleet of agents.",
} as const;

export const capabilities = [
  { title: "VAYU Editor", desc: "Block editor with slash commands, tables, math, mermaid." },
  { title: "AI Copilot", desc: "Streaming /rewrite, /improve, /continue — context-aware." },
  { title: "Research Center", desc: "Upload docs, ask grounded questions with citations." },
  { title: "Knowledge Vault", desc: "Semantic search and a graph of your ideas." },
  { title: "Agent Command", desc: "LangGraph agents: research, SEO, docs, interview prep." },
  { title: "Version Control", desc: "Git-for-docs: snapshots, timeline, diff, restore." },
  { title: "Workspaces", desc: "Teams, roles, comments, mentions — collaboration-ready." },
  { title: "Analytics", desc: "Writing velocity, reading time, AI usage, research activity." },
] as const;
