import type { ChatCitation } from "@/lib/rag/context";

/** Anonymous visitor id for chat sessions and feedback (visitors have no accounts). */
export const ANON_COOKIE = "av_anon";

/** Metadata streamed with each assistant message. */
export type ChatMeta = { dbId?: string; citations?: ChatCitation[] };

export const FEEDBACK_REASONS = ["Didn’t answer", "Wrong number", "Out of date", "No date given", "Other"] as const;
