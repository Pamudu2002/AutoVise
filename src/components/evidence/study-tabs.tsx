"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  ["", "Overview"],
  ["setup", "Setup"],
  ["screening", "Screening"],
  ["records", "Records"],
  ["coding", "Coding"],
  ["qa", "QA"],
  ["analysis", "Analysis"],
  ["findings", "Findings"],
  ["appendix", "Appendix"],
] as const;

export function StudyTabs({ studyId, counts }: { studyId: string; counts: Partial<Record<(typeof TABS)[number][0], number>> }) {
  const path = usePathname();
  const base = `/admin/evidence/${studyId}`;
  return (
    <nav className="tabs" aria-label="Study sections" style={{ overflowX: "auto" }}>
      {TABS.map(([seg, label]) => {
        const href = seg ? `${base}/${seg}` : base;
        const on = seg ? path === href || path.startsWith(`${href}/`) : path === base;
        return (
          <Link key={seg} href={href} className={`tab${on ? " on" : ""}`} aria-current={on ? "page" : undefined}>
            {label}
            {counts[seg] ? (
              <span className="chip num" style={{ marginLeft: 6, height: 20, fontSize: 11 }}>
                {counts[seg]}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
