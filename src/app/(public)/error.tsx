"use client";

import { ErrorState } from "@/components/ui/states";

export default function PublicError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="wrap" style={{ paddingTop: 48, paddingBottom: 64 }}>
      <ErrorState title="We couldn't load this page" body="The research service didn't respond. Try again in a moment." onRetry={reset} />
    </div>
  );
}
