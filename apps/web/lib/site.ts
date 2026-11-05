export const site = {
  name: "VAYU AI",
  tagline: "Intelligence at the speed of thought.",
  description:
    "An AI-native workspace: a block editor with Copilot, research that cites its sources, and agents that work through longer tasks.",
} as const;

export const capabilities = [
  { title: "VAYU Editor", desc: "Block editor with slash commands, tables, math, mermaid." },
  { title: "AI Copilot", desc: "Streaming /rewrite, /improve, /continue — context-aware." },
  { title: "Research Center", desc: "Upload docs, ask grounded questions with citations." },
  { title: "Knowledge Vault", desc: "Search everything you've added by meaning, and find related sources." },
  { title: "Agent Command", desc: "LangGraph agents: research, SEO, docs, interview prep." },
  { title: "Version Control", desc: "Git-for-docs: snapshots, timeline, diff, restore." },
  { title: "Workspaces", desc: "Invite people, give them roles, and discuss documents in comments." },
  { title: "Analytics", desc: "Words, reading time, recent edits and Copilot usage per workspace." },
] as const;
