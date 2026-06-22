# Phase 7 — Agents (LangGraph)

**Status:** ✅ Complete · Commit _(this commit)_

## Goal
A LangGraph agent runtime for the 7 agent types, with step checkpointing + streaming.

## Key decisions
- One **LangGraph `StateGraph`** shared by all agents: `plan → research → synthesize`.
  Each agent type (`registry.py`) supplies its own persona/system prompt.
- Each node calls `AnthropicProvider.complete` and appends a checkpointed **step**
  (`operator.add` reducer on `state["steps"]`); graceful placeholder if no key.
- Runner: `run_and_persist` (executes graph, writes `agent_run` + `agent_step`, returns trace)
  and `stream_run` (live per-node SSE via `graph.astream`).

## Files
- ai: `agents/{registry,graph,runner}.py`, `api/v1/agents.py` (catalog, `/{type}/run`,
  `/{type}/stream`, `/runs/{id}`), `tests/test_agents.py`.
- web: `/agents` UI (catalog, task, live step trace) + `api/agents/{run,stream}` proxies;
  `proxy.ts` guards `/agents`.

## Verification
- 11 ai tests pass (health + RAG + agents, incl. "graph compiles for every agent");
  `next build` (16 routes).

## Pending (live)
Real agent output needs `ANTHROPIC_API_KEY`; run/step persistence needs the DB.

## Deferred (production hardening)
Async worker + queue for long runs, resume-from-checkpoint, human-in-the-loop pause (the
schema supports `status`/`checkpoint`; the sync runner is the demo path).
