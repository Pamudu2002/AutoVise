import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "autovise" });

export const EVENTS = {
  reportUploaded: "report/version.uploaded",
  recompute: "company/recompute",
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
