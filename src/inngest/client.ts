import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "autovise" });

export const EVENTS = {
  reportUploaded: "report/version.uploaded",
  recompute: "company/recompute",
  pitchRefresh: "company/pitch.refresh",
  evidenceCode: "evidence/code.requested",
  evidenceEmbed: "evidence/embed.requested",
} as const;

export interface ReportUploadedData {
  versionId: string;
  companyId: string;
}

export interface RecomputeData {
  companyId: string;
  trigger?: string;
  force?: boolean;
}

export interface PitchRefreshData {
  companyId: string;
}

export interface EvidenceCodeData {
  studyId: string;
  recordIds: string[];
}

export interface EvidenceEmbedData {
  studyId: string;
}
