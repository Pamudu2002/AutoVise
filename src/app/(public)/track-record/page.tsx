import type { Metadata } from "next";
import { TrackRecordView } from "@/components/track-record-view";
import { getTrackRecord } from "@/lib/data/insights";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Track record", description: "Every published prediction checkpoint, scored against what the share price actually did." };

export default async function TrackRecordPage() {
  const [{ resolved, open }, settings] = await Promise.all([getTrackRecord(), getSettings()]);
  return <TrackRecordView resolved={resolved} open={open} disclaimer={settings.disclaimer.short} />;
}
