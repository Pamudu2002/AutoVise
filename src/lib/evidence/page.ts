import "server-only";
import { notFound } from "next/navigation";
import { can, requirePageAdmin, type Permission } from "@/lib/admin";
import { getStudyBundle } from "./data";

/** For study pages: signs-in check plus the study bundle, or a 404. */
export async function loadStudy(studyId: string, p: Permission = "evidence.write") {
  const user = await requirePageAdmin();
  const bundle = /^[0-9a-f-]{36}$/i.test(studyId) ? await getStudyBundle(studyId) : null;
  if (!bundle) notFound();
  return { user, bundle, canWrite: can(user.role, p), canApprove: can(user.role, "evidence.approve") };
}
