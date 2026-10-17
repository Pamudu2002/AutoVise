"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Refreshes server data on an interval while something is still processing. */
export function AutoRefresh({ when, every = 4000 }: { when: boolean; every?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!when) return;
    const id = setInterval(() => router.refresh(), every);
    return () => clearInterval(id);
  }, [when, every, router]);
  return null;
}
