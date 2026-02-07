import { CorrectionOverview } from "@/components/correction/correction_overview";
import { auth } from "@/lib/auth/auth";
import { requireAuthorized } from "@/lib/auth/authorize";
import { getRepositories } from "@/lib/data/provider";

export const dynamic = "force-dynamic";

export default async function CorrectionPage() {
  const session = await auth();
  requireAuthorized(session, "/correction");

  const repos = getRepositories();
  const pending = await repos.correction.getPendingRecords({ page: 1, limit: 20 });
  return <CorrectionOverview initialPending={pending} />;
}
