"use client";

import { CircleAlert, Eye, EyeOff } from "lucide-react";
import { useActionState, useState } from "react";
import { loginAction, type LoginState } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const [show, setShow] = useState(false);
  return (
    <form action={action} className="card" style={{ width: "100%", padding: 28, display: "flex", flexDirection: "column", gap: 18, boxShadow: "var(--shadow-md)" }}>
      {state.error && (
        <div role="alert" style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: 10, background: "var(--neg-soft)", color: "var(--text)", fontSize: 13, lineHeight: 1.5 }}>
          <CircleAlert size={16} style={{ color: "var(--neg)", flex: "none", marginTop: 2 }} aria-hidden />
          <span>{state.error}</span>
        </div>
      )}
      <input type="hidden" name="next" value={next ?? "/admin"} />
      <div className="field">
        <label className="label" htmlFor="email">
          Work email
        </label>
        <input id="email" name="email" className="input" type="email" autoComplete="email" placeholder="name@company.com" defaultValue={state.fields?.email} required />
      </div>
      <div className="field">
        <label className="label" htmlFor="pw">
          Password
        </label>
        <div style={{ position: "relative", display: "flex" }}>
          <input id="pw" name="password" className="input" type={show ? "text" : "password"} autoComplete="current-password" style={{ paddingRight: 48 }} required />
          <button type="button" className="btn btn-ghost btn-icon btn-sm" style={{ position: "absolute", right: 4, top: 4 }} aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(!show)}>
            {show ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
          </button>
        </div>
        <span className="hint">Forgotten it? Ask a super-admin to reset it from the Users page.</span>
      </div>
      <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14, cursor: "pointer" }}>
        <input type="checkbox" name="remember" className="check" />
        Keep me signed in for 7 days
      </label>
      <button className="btn btn-primary btn-lg" type="submit" disabled={pending} style={{ width: "100%" }}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
