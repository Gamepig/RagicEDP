import { CorrectionStarSchema } from "@/components/correction/correction_star_schema";
import { auth } from "@/lib/auth/auth";
import { requireAuthorized } from "@/lib/auth/authorize";
import { getRepositories } from "@/lib/data/provider";

export const dynamic = "force-dynamic";

export default async function CorrectionSchemaPage() {
  const session = await auth();
  requireAuthorized(session, "/correction/schema");

  const repos = getRepositories();
  const [mermaid, stats] = await Promise.all([
    repos.correction.getSchemaMermaid({ level: "overview" }),
    repos.correction.getSchemaStats(),
  ]);
  return <CorrectionStarSchema initialMermaid={mermaid} initialStats={stats} />;
}
