"use client";

import { ErrorState } from "@/components/ui/states";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ padding: "28px 24px", maxWidth: 900 }}>
      <ErrorState title="This page couldn't load" body={`Something went wrong on the server${error.digest ? ` (reference ${error.digest})` : ""}. Try again in a moment.`} onRetry={reset} />
    </div>
  );
}
