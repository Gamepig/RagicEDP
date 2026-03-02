import { CorrectionHistory } from "@/components/correction/correction_history";
import { auth } from "@/lib/auth/auth";
import { requireAuthorized } from "@/lib/auth/authorize";
import { getRepositories } from "@/lib/data/provider";

export const dynamic = "force-dynamic";

export default async function CorrectionHistoryPage() {
  const session = await auth();
  requireAuthorized(session, "/correction/history");

  const repos = getRepositories();
  const [history, tables] = await Promise.all([
    repos.correction.getHistory({ page: 1, limit: 20 }),
    repos.correction.getTables(),
  ]);
  return <CorrectionHistory initialData={history} tables={tables} />;
}
