import { SettingsForm } from "@/components/admin/settings-form";
import { can, requirePageAdmin } from "@/lib/admin";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requirePageAdmin();
  return <SettingsForm initial={await getSettings()} canEdit={can(user.role, "settings.write")} />;
}
