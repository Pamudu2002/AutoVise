"use client";

import { KeyRound, Plus } from "lucide-react";
import { useState } from "react";
import { AdminMain, PageHeader } from "@/components/admin/page-header";
import { useAction } from "@/components/admin/use-action";
import { Dialog } from "@/components/ui/dialog";
import { FieldError, Select } from "@/components/ui/fields";
import { changeOwnPassword, createUser, resetPassword, updateUser } from "@/lib/actions/users";
import { timeAgo } from "@/lib/format";

type Role = "super_admin" | "admin" | "analyst";
interface Row {
  id: string;
  name: string;
  email: string;
  role: Role;
  disabled: boolean;
  lastLoginAt: string | null;
  locked: boolean;
}

const ROLE: Record<Role, string> = { super_admin: "Super admin", admin: "Admin", analyst: "Analyst" };
const ROLE_HINT: Record<Role, string> = {
  analyst: "Uploads and reviews reports, enters prices and events, adds notes and reruns predictions.",
  admin: "Everything an analyst can do, plus companies, sectors, settings and publishing predictions.",
  super_admin: "Everything, plus managing users.",
};

export function UsersAdmin({ rows, me, manage, openPassword }: { rows: Row[]; me: string; manage: boolean; openPassword: boolean }) {
  const { exec, pending, error, setError } = useAction();
  const [create, setCreate] = useState(false);
  const [nu, setNu] = useState({ name: "", email: "", role: "analyst" as Role, password: "" });
  const [reset, setReset] = useState<Row | null>(null);
  const [pw, setPw] = useState("");
  const [own, setOwn] = useState(openPassword);
  const [ownPw, setOwnPw] = useState({ current: "", next: "", confirm: "" });

  return (
    <AdminMain max={1100}>
      <PageHeader
        title={manage ? "Users" : "Your account"}
        sub={manage ? "Who can sign in to the admin panel, and what they can do." : "Change the password you use to sign in."}
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => (setError(null), setOwn(true))}>
              <KeyRound size={16} aria-hidden />
              Change my password
            </button>
            {manage && (
              <button className="btn btn-primary" onClick={() => (setError(null), setCreate(true))}>
                <Plus size={16} aria-hidden />
                New user
              </button>
            )}
          </>
        }
      />
      {manage && (
        <div className="tbl-box">
          <table className="tbl" style={{ minWidth: 820 }}>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last sign-in</th>
                <th className="r">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontWeight: 500 }}>
                        {r.name}
                        {r.id === me ? " (you)" : ""}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>{r.email}</span>
                    </div>
                  </td>
                  <td style={{ width: 180 }}>
                    <label className="sr-only" htmlFor={`role-${r.id}`}>
                      Role for {r.name}
                    </label>
                    <Select id={`role-${r.id}`} style={{ height: 34, fontSize: 13 }} value={r.role} disabled={pending || r.id === me} onChange={(e) => exec(() => updateUser({ id: r.id, role: e.target.value as Role, disabled: r.disabled }))}>
                      {(Object.keys(ROLE) as Role[]).map((k) => (
                        <option key={k} value={k}>
                          {ROLE[k]}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td>{r.disabled ? <span className="pill pill-superseded">Disabled</span> : r.locked ? <span className="pill pill-review">Locked</span> : <span className="pill pill-approved">Active</span>}</td>
                  <td className="tnum" style={{ fontSize: 13 }} suppressHydrationWarning>
                    {r.lastLoginAt ? timeAgo(r.lastLoginAt) : "Never"}
                  </td>
                  <td className="r">
                    <div style={{ display: "inline-flex", gap: 4 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => (setError(null), setPw(""), setReset(r))}>
                        Reset password
                      </button>
                      {r.id !== me && (
                        <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => exec(() => updateUser({ id: r.id, role: r.role, disabled: !r.disabled }))}>
                          {r.disabled ? "Enable" : "Disable"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {manage && (
        <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8, boxShadow: "none" }}>
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>Roles</h2>
          {(Object.keys(ROLE) as Role[]).map((k) => (
            <p key={k} style={{ fontSize: 13, color: "var(--muted)" }}>
              <strong style={{ color: "var(--text)" }}>{ROLE[k]}:</strong> {ROLE_HINT[k]}
            </p>
          ))}
        </div>
      )}

      <Dialog
        open={create}
        onClose={() => setCreate(false)}
        title="New user"
        subtitle="Share the starting password securely; they can change it after signing in."
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setCreate(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={pending}
              onClick={async () => {
                const res = await exec(() => createUser(nu));
                if (res.ok) {
                  setCreate(false);
                  setNu({ name: "", email: "", role: "analyst", password: "" });
                }
              }}
            >
              Create user
            </button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="field">
            <label className="label" htmlFor="u-name">
              Name
            </label>
            <input id="u-name" className="input" value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} data-autofocus />
          </div>
          <div className="field">
            <label className="label" htmlFor="u-email">
              Work email
            </label>
            <input id="u-email" className="input" type="email" value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} />
          </div>
          <div className="field">
            <label className="label" htmlFor="u-role">
              Role
            </label>
            <Select id="u-role" value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value as Role })}>
              {(Object.keys(ROLE) as Role[]).map((k) => (
                <option key={k} value={k}>
                  {ROLE[k]}
                </option>
              ))}
            </Select>
            <span className="hint">{ROLE_HINT[nu.role]}</span>
          </div>
          <div className="field">
            <label className="label" htmlFor="u-pw">
              Starting password
            </label>
            <input id="u-pw" className="input" type="password" autoComplete="new-password" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} />
            <span className="hint">At least 12 characters with letters and a number.</span>
          </div>
          <FieldError>{error}</FieldError>
        </div>
      </Dialog>

      <Dialog
        open={!!reset}
        onClose={() => setReset(null)}
        title={`Reset password for ${reset?.name}`}
        subtitle="This also unlocks the account."
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setReset(null)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={pending}
              onClick={async () => {
                const res = await exec(() => resetPassword(reset!.id, pw));
                if (res.ok) setReset(null);
              }}
            >
              Reset password
            </button>
          </>
        }
      >
        <div className="field">
          <label className="label" htmlFor="r-pw">
            New password
          </label>
          <input id="r-pw" className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} data-autofocus />
          <span className="hint">At least 12 characters with letters and a number.</span>
          <FieldError>{error}</FieldError>
        </div>
      </Dialog>

      <Dialog
        open={own}
        onClose={() => setOwn(false)}
        title="Change your password"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setOwn(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={pending || !ownPw.next || ownPw.next !== ownPw.confirm}
              onClick={async () => {
                const res = await exec(() => changeOwnPassword(ownPw.current, ownPw.next));
                if (res.ok) {
                  setOwn(false);
                  setOwnPw({ current: "", next: "", confirm: "" });
                }
              }}
            >
              Change password
            </button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {(
            [
              ["current", "Current password", "current-password"],
              ["next", "New password", "new-password"],
              ["confirm", "Confirm new password", "new-password"],
            ] as const
          ).map(([k, label, ac]) => (
            <div className="field" key={k}>
              <label className="label" htmlFor={`o-${k}`}>
                {label}
              </label>
              <input id={`o-${k}`} className="input" type="password" autoComplete={ac} value={ownPw[k]} onChange={(e) => setOwnPw({ ...ownPw, [k]: e.target.value })} />
            </div>
          ))}
          {ownPw.confirm && ownPw.next !== ownPw.confirm && <span className="err">The new passwords don&apos;t match.</span>}
          <FieldError>{error}</FieldError>
        </div>
      </Dialog>
    </AdminMain>
  );
}
