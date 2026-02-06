import { getRepositories } from "@/lib/data/provider";
import { CorrectionOverview } from "@/components/correction/correction_overview";

export const dynamic = "force-dynamic";

export default async function CorrectionPage() {
  const repos = getRepositories();
  const pending = await repos.correction.getPendingRecords({ page: 1, limit: 20 });
  return <CorrectionOverview initialPending={pending} />;
}
