"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/actions/result";

/** Runs a server action, shows a toast with the outcome and refreshes the page data. */
export function useAction() {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const exec = useCallback(
    <T,>(fn: () => Promise<ActionResult<T>>, opts: { success?: string; quiet?: boolean; action?: { label: string; href: string } } = {}) =>
      new Promise<ActionResult<T>>((resolve) => {
        start(async () => {
          const res = await fn();
          if (res.ok) {
            setError(null);
            const msg = opts.success ?? res.message;
            if (msg && !opts.quiet) toast({ title: msg, tone: "success", action: opts.action });
            router.refresh();
          } else {
            setError(res.error);
            toast({ title: "That didn't work", body: res.error, tone: "error" });
          }
          resolve(res);
        });
      }),
    [router, toast],
  );
  return { exec, pending, error, setError };
}
