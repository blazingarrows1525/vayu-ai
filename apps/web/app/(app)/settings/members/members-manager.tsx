"use client";

import { useId, useState } from "react";
import { UserMinus, UserPlus } from "lucide-react";
import type { Role } from "@vayu/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Notice } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/field";
import { ASSIGNABLE_ROLES, canAssignRole, canManageMember, can, ROLE_LABEL } from "@/lib/rbac";
import { plural } from "@/lib/format";

type Member = { userId: string; name: string | null; email: string; role: Role };
type Message = { tone: "success" | "danger"; text: string };

const ROLE_HELP: Record<Role, string> = {
  owner: "Full control, including deleting the workspace.",
  admin: "Everything editors can do, plus inviting and managing members.",
  editor: "Writes documents, runs Copilot and agents, adds research sources.",
  viewer: "Reads documents and comments, and asks research questions.",
};

function inviteError(reason: unknown, status: number): string {
  if (reason === "no_such_user") return "Nobody has a VAYU account with that email yet. Ask them to sign up first, then invite them.";
  if (reason === "already_member") return "That person is already a member of this workspace.";
  if (reason === "invalid_email") return "Enter a valid email address.";
  if (reason === "role_too_high") return "You can only grant roles below your own.";
  if (status === 403) return "Only admins and owners can invite members.";
  return `The invitation didn't go through (error ${status}).`;
}

function changeError(reason: unknown, status: number): string {
  if (reason === "self") return "You can't change your own role.";
  if (reason === "rank" || reason === "role_too_high") return "You can only manage members ranked below you.";
  if (status === 404) return "That person is no longer a member.";
  return `That change didn't save (error ${status}).`;
}

export function MembersManager({
  initial,
  currentUserId,
  actorRole,
  workspaceName,
}: {
  initial: Member[];
  currentUserId: string;
  actorRole: Role;
  workspaceName: string;
}) {
  const ids = useId();
  const [members, setMembers] = useState(initial);
  const [email, setEmail] = useState("");
  const grantable = ASSIGNABLE_ROLES.filter((r) => canAssignRole(actorRole, r));
  const [role, setRole] = useState<Role>(grantable.includes("viewer") ? "viewer" : (grantable[0] ?? "viewer"));
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);
  const canManage = can(actorRole, "workspace:manageMembers");

  async function refresh() {
    const res = await fetch("/api/members");
    if (res.ok) setMembers(((await res.json()) as { members: Member[] }).members);
  }

  async function invite() {
    const value = email.trim().toLowerCase();
    if (!value || inviting) return;
    setInviting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: value, role }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; reason?: string } | null;
      if (!res.ok || !data?.ok) {
        setMessage({ tone: "danger", text: inviteError(data?.reason, res.status) });
        return;
      }
      setEmail("");
      setMessage({ tone: "success", text: `Added ${value} as ${ROLE_LABEL[role]}. They'll find ${workspaceName} in their workspace switcher.` });
      await refresh();
    } catch {
      setMessage({ tone: "danger", text: "Couldn't reach VAYU. Try again." });
    } finally {
      setInviting(false);
    }
  }

  async function changeRole(m: Member, next: Role) {
    if (next === m.role) return;
    setPending(m.userId);
    setMessage(null);
    const previous = m.role;
    setMembers((all) => all.map((x) => (x.userId === m.userId ? { ...x, role: next } : x)));
    try {
      const res = await fetch(`/api/members/${m.userId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: next }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { reason?: string } | null;
        setMembers((all) => all.map((x) => (x.userId === m.userId ? { ...x, role: previous } : x)));
        setMessage({ tone: "danger", text: changeError(data?.reason, res.status) });
        return;
      }
      setMessage({ tone: "success", text: `${m.name || m.email} is now ${ROLE_LABEL[next]}.` });
    } catch {
      setMembers((all) => all.map((x) => (x.userId === m.userId ? { ...x, role: previous } : x)));
      setMessage({ tone: "danger", text: "Couldn't reach VAYU. Nothing was changed." });
    } finally {
      setPending(null);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    const m = removing;
    setPending(m.userId);
    setMessage(null);
    try {
      const res = await fetch(`/api/members/${m.userId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { reason?: string } | null;
        setMessage({ tone: "danger", text: changeError(data?.reason, res.status) });
        return;
      }
      setMembers((all) => all.filter((x) => x.userId !== m.userId));
      setMessage({ tone: "success", text: `Removed ${m.name || m.email} from ${workspaceName}.` });
    } catch {
      setMessage({ tone: "danger", text: "Couldn't reach VAYU. Nothing was changed." });
    } finally {
      setPending(null);
      setRemoving(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {canManage && grantable.length > 0 && (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void invite();
          }}
          className="surface flex flex-col gap-4 rounded-2xl p-5"
        >
          <h2 className="text-section font-semibold">Invite someone</h2>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
            <Field id={`${ids}-email`} label="Email">
              {(p) => (
                <Input {...p} type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
              )}
            </Field>
            <Field id={`${ids}-role`} label="Role">
              {(p) => (
                <Select {...p} value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  {grantable.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <p className="text-xs leading-relaxed text-vayu-muted">{ROLE_HELP[role]}</p>
          <div className="flex justify-end">
            <Button type="submit" variant="primary" icon={<UserPlus aria-hidden className="h-4 w-4" />} loading={inviting} loadingLabel="Inviting…" disabled={!email.trim()}>
              Invite
            </Button>
          </div>
        </form>
      )}

      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <section aria-labelledby={`${ids}-list`} className="surface rounded-2xl p-5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id={`${ids}-list`} className="text-section font-semibold">
            People
          </h2>
          <span className="text-xs text-vayu-muted">{plural(members.length, "member")}</span>
        </div>
        <ul className="mt-3 divide-y divide-vayu-border">
          {members.map((m) => {
            const self = m.userId === currentUserId;
            const manageable = canManage && !self && canManageMember(actorRole, m.role);
            const label = m.name || m.email;
            return (
              <li key={m.userId} className="flex flex-wrap items-center gap-3 py-3">
                <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-vayu-border bg-vayu-inset text-xs font-semibold uppercase text-vayu-muted">
                  {(label.trim()[0] ?? "?").toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-vayu-fg">
                    {m.name || m.email}
                    {self && <span className="ml-2 text-xs font-normal text-vayu-muted">(you)</span>}
                  </p>
                  {m.name && <p className="truncate text-xs text-vayu-muted">{m.email}</p>}
                </div>
                {manageable ? (
                  <div className="flex items-center gap-2">
                    <Select
                      aria-label={`Role for ${label}`}
                      value={m.role}
                      disabled={pending === m.userId}
                      onChange={(e) => void changeRole(m, e.target.value as Role)}
                      className="h-9 w-32 text-xs pointer-coarse:h-10"
                    >
                      {[...new Set<Role>([m.role, ...grantable])].map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </Select>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<UserMinus aria-hidden className="h-3.5 w-3.5" />}
                      aria-label={`Remove ${label}`}
                      disabled={pending === m.userId}
                      onClick={() => setRemoving(m)}
                      className="hover:text-vayu-danger"
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <Badge tone={m.role === "owner" ? "accent" : "neutral"}>{ROLE_LABEL[m.role]}</Badge>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <Disclosure summary="What each role can do">
        <dl className="grid gap-2 sm:grid-cols-[6rem_1fr]">
          {(Object.keys(ROLE_HELP) as Role[]).map((r) => (
            <div key={r} className="contents">
              <dt className="font-medium text-vayu-fg">{ROLE_LABEL[r]}</dt>
              <dd className="text-vayu-muted">{ROLE_HELP[r]}</dd>
            </div>
          ))}
        </dl>
      </Disclosure>

      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.name || removing?.email || "this member"}?`}
        description={`They lose access to ${workspaceName}'s documents, sources and history immediately. You can invite them again later.`}
        confirmLabel="Remove member"
        pendingLabel="Removing…"
        pending={removing !== null && pending === removing.userId}
        onConfirm={() => void confirmRemove()}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
