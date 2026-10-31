"use client";

import { Check } from "lucide-react";
import { useAction } from "@/components/admin/use-action";
import { setStudyStatus } from "@/lib/actions/evidence";
import { STATUS_STEPS, type StudyStatus } from "@/lib/evidence/types";

/** The study's workflow stepper. Steps are a guide for the team, not a lock. */
export function StatusControl({ studyId, status, canWrite }: { studyId: string; status: StudyStatus; canWrite: boolean }) {
  const { exec, pending } = useAction();
  const at = STATUS_STEPS.findIndex((s) => s.key === status);
  return (
    <ol style={{ display: "flex", gap: 8, flexWrap: "wrap", listStyle: "none", padding: 0, margin: 0 }} aria-label="Study status">
      {STATUS_STEPS.map((s, i) => {
        const on = i === at;
        return (
          <li key={s.key}>
            <button
              type="button"
              className="chip chip-btn"
              aria-current={on ? "step" : undefined}
              disabled={!canWrite || pending || on}
              onClick={() => exec(() => setStudyStatus(studyId, s.key))}
              style={on ? { background: "var(--primary-soft)", color: "var(--primary-text)", borderColor: "transparent", opacity: 1 } : undefined}
            >
              {i < at ? <Check size={14} aria-hidden /> : <span className="num">{i + 1}</span>}
              {s.label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
