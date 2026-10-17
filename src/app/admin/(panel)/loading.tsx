import { Skeleton } from "@/components/ui/states";

export default function AdminLoading() {
  return (
    <div style={{ padding: "28px 24px", display: "flex", flexDirection: "column", gap: 20, maxWidth: 1400 }} aria-busy="true" aria-label="Loading">
      <Skeleton h={28} w={220} />
      <Skeleton h={16} w={360} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 16 }}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} h={96} r={14} />
        ))}
      </div>
      <Skeleton h={360} r={14} />
    </div>
  );
}
