"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { StatusDot } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { plural } from "@/lib/format";

type State = { kind: "checking" } | { kind: "ok"; agents: number } | { kind: "down"; message: string };

/**
 * Whether the AI service is reachable and accepts this login, from a cheap call (the agent
 * catalog; no model is invoked). The status page runs the full check, including the models.
 */
export function AiStatus() {
  const [state, setState] = useState<State>({ kind: "checking" });

  const check = useCallback(async () => {
    setState({ kind: "checking" });
    try {
      const res = await fetch("/api/ai/agents", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { agents?: unknown[] };
        setState({ kind: "ok", agents: Array.isArray(data.agents) ? data.agents.length : 0 });
      } else {
        setState({
          kind: "down",
          message:
            res.status === 403
              ? "Your role can't use the AI features in this workspace."
              : "The AI service didn't respond, so Copilot, research and agents won't work right now.",
        });
      }
    } catch {
      setState({ kind: "down", message: "Couldn't reach VAYU. Check your connection." });
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  return (
    <div className="flex flex-col gap-3">
      {/* One status line and one description element, updated in place: a late-appearing
          paragraph would otherwise register as the page's largest paint. */}
      <div aria-live="polite">
        <StatusDot
          tone={state.kind === "ok" ? "success" : state.kind === "down" ? "danger" : "neutral"}
          pulse={state.kind === "checking"}
          label={state.kind === "ok" ? "Connected" : state.kind === "down" ? "Unavailable" : "Checking…"}
        />
        <p className="mt-1.5 min-h-[2.75rem] text-sm leading-relaxed text-vayu-muted">
          {state.kind === "ok"
            ? `The AI service accepted your login${state.agents > 0 ? ` and offers ${plural(state.agents, "agent")}` : ""}.`
            : state.kind === "down"
              ? state.message
              : "Checking that the AI service is reachable and accepts your login."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <LinkButton href="/status" size="sm" variant="secondary">
          Full check
        </LinkButton>
        <Button
          size="sm"
          variant="ghost"
          icon={<RefreshCw aria-hidden className="h-3.5 w-3.5" />}
          disabled={state.kind === "checking"}
          onClick={() => void check()}
        >
          Check again
        </Button>
      </div>
    </div>
  );
}
