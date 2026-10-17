import { Skeleton } from "@/components/ui/states";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading the pitch">
      <section style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <div className="wrap" style={{ paddingTop: 20, paddingBottom: 28, display: "flex", flexDirection: "column", gap: 20 }}>
          <Skeleton h={12} w={180} />
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            <Skeleton h={96} w={96} r={14} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
              <Skeleton h={28} w="min(420px, 80%)" />
              <Skeleton h={14} w={240} />
            </div>
          </div>
        </div>
      </section>
      <div className="wrap" style={{ paddingTop: 28, paddingBottom: 64, display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div style={{ flex: "999 1 640px", display: "flex", flexDirection: "column", gap: 24 }}>
          <Skeleton h={420} r={14} />
          <Skeleton h={46} />
          <Skeleton h={360} r={14} />
        </div>
        <div style={{ flex: "1 1 340px" }}>
          <Skeleton h={560} r={14} />
        </div>
      </div>
    </div>
  );
}
