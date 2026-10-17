"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { signIn } from "@/lib/auth";

export interface LoginState {
  error?: string;
  fields?: { email?: string };
}

function message(code: string | undefined): string {
  if (code === "locked") return "Too many failed attempts. This account is locked for 15 minutes.";
  const left = code?.startsWith("invalid:") ? Number(code.split(":")[1]) : null;
  if (left !== null && left <= 2) return `That email and password don't match. ${left} more attempt${left === 1 ? "" : "s"} before the account locks for 15 minutes.`;
  return "That email and password don't match.";
}

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password.", fields: { email } };
  const next = String(form.get("next") ?? "/admin");
  try {
    await signIn("credentials", {
      email,
      password,
      remember: form.get("remember") === "on" ? "true" : "false",
      redirectTo: next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin",
    });
    return {};
  } catch (err) {
    if (err instanceof CredentialsSignin) return { error: message(err.code), fields: { email } };
    if (err instanceof AuthError) return { error: "Sign-in failed. Try again.", fields: { email } };
    throw err; // the redirect on success
  }
}
