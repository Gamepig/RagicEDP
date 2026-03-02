import { CorrectionDashboard } from "@/components/correction/correction_dashboard";
import { auth } from "@/lib/auth/auth";
import { requireAuthorized } from "@/lib/auth/authorize";
import { getRepositories } from "@/lib/data/provider";

export const dynamic = "force-dynamic";

export default async function CorrectionPage() {
  const session = await auth();
  requireAuthorized(session, "/correction");

  const repos = getRepositories();
  const stats = await repos.correction.getStatistics();
  return <CorrectionDashboard initialStats={stats} />;
}
