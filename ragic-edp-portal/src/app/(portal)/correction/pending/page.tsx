import { CorrectionPendingList } from "@/components/correction/correction_pending_list";
import { auth } from "@/lib/auth/auth";
import { requireAuthorized } from "@/lib/auth/authorize";
import { getRepositories } from "@/lib/data/provider";

export const dynamic = "force-dynamic";

export default async function CorrectionPendingPage() {
  const session = await auth();
  requireAuthorized(session, "/correction/pending");

  const repos = getRepositories();
  const [pending, tables] = await Promise.all([
    repos.correction.getPendingRecords({ page: 1, limit: 20 }),
    repos.correction.getTables(),
  ]);
  return <CorrectionPendingList initialData={pending} tables={tables} />;
}
