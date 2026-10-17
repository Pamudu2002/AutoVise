import { CardSkeleton, Skeleton } from "@/components/ui/states";

export default function Loading() {
  return (
    <div className="wrap" style={{ paddingTop: 48, paddingBottom: 64, display: "flex", flexDirection: "column", gap: 24 }} aria-busy="true" aria-label="Loading">
      <Skeleton h={14} w={220} />
      <Skeleton h={44} w="min(640px, 90%)" />
      <Skeleton h={18} w="min(520px, 80%)" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(340px, 100%), 1fr))", gap: 20, marginTop: 24 }}>
        {Array.from({ length: 6 }, (_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
