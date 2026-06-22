"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Member {
  userId: string;
  role: string;
  name: string;
  email: string;
}

const ROLES = ["owner", "admin", "editor", "viewer"];

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [msg, setMsg] = useState("");

  function load() {
    fetch("/api/members")
      .then((r) => (r.ok ? r.json() : { members: [] }))
      .then((d) => setMembers((d.members ?? []) as Member[]));
  }

  useEffect(load, []);

  async function invite() {
    const res = await fetch("/api/members", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const d = await res.json();
    if (res.ok && d.ok) {
      setEmail("");
      setMsg("Invited.");
      load();
    } else {
      setMsg(
        d.reason === "no_such_user"
          ? "No user with that email."
          : d.reason === "already_member"
            ? "Already a member."
            : "Couldn't invite.",
      );
    }
  }

  async function changeRole(m: Member, r: string) {
    await fetch(`/api/members/${m.userId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: r }),
    });
    load();
  }

  async function remove(m: Member) {
    await fetch(`/api/members/${m.userId}`, { method: "DELETE" });
    load();
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-vayu-accent">
            VAYU AI
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Workspace members</h1>
        </div>
        <Link href="/dashboard" className="text-sm text-vayu-muted hover:text-vayu-fg">
          Dashboard
        </Link>
      </header>

      <section className="rounded-2xl border border-vayu-border bg-vayu-surface p-6">
        <h2 className="text-sm font-semibold">Invite a member</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            className="flex-1 rounded-lg border border-vayu-border bg-vayu-bg px-3 py-2 text-sm text-vayu-fg outline-none focus:border-vayu-accent"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-lg border border-vayu-border bg-vayu-bg px-2 py-2 text-sm text-vayu-fg outline-none"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button
            onClick={invite}
            className="rounded-lg bg-vayu-accent px-4 py-2 text-sm font-semibold text-vayu-bg transition hover:bg-vayu-accent-2"
          >
            Invite
          </button>
        </div>
        {msg && <p className="mt-2 text-xs text-vayu-muted">{msg}</p>}
      </section>

      <section className="mt-6 flex flex-col gap-2">
        {members.map((m) => (
          <div
            key={m.userId}
            className="flex items-center justify-between rounded-lg border border-vayu-border bg-vayu-surface px-4 py-3 text-sm"
          >
            <div>
              <span className="font-medium text-vayu-fg">{m.name}</span>
              <span className="ml-2 text-xs text-vayu-muted">{m.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={m.role}
                onChange={(e) => changeRole(m, e.target.value)}
                className="rounded-lg border border-vayu-border bg-vayu-bg px-2 py-1 text-xs text-vayu-fg outline-none"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <button
                onClick={() => remove(m)}
                className="text-xs text-vayu-muted transition hover:text-red-400"
              >
                remove
              </button>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
