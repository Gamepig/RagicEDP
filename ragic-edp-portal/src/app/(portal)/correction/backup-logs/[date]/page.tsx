import { BackupLogDetail } from "@/components/correction/backup_log_detail";
import { auth } from "@/lib/auth/auth";
import { requireAuthorized } from "@/lib/auth/authorize";
import { getRepositories } from "@/lib/data/provider";

export const dynamic = "force-dynamic";

export default async function BackupLogDetailPage({ params }: { params: Promise<{ date: string }> }) {
  const session = await auth();
  requireAuthorized(session, "/correction/backup-logs");

  const { date } = await params;
  const repos = getRepositories();
  const detail = await repos.correction.getBackupDetail({ date });
  return <BackupLogDetail initialDetail={detail} />;
}
