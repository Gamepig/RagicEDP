import { BackupLogList } from "@/components/correction/backup_log_list";
import { auth } from "@/lib/auth/auth";
import { requireAuthorized } from "@/lib/auth/authorize";
import { getRepositories } from "@/lib/data/provider";

export const dynamic = "force-dynamic";

export default async function BackupLogsPage() {
  const session = await auth();
  requireAuthorized(session, "/correction/backup-logs");

  const repos = getRepositories();
  const data = await repos.correction.getBackupList({ page: 1, limit: 10 });
  return <BackupLogList initialData={data} />;
}
