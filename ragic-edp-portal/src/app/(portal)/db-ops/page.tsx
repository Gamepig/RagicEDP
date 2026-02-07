import { DbOpsOverview } from "@/components/dbops/dbops_overview";
import { auth } from "@/lib/auth/auth";
import { requireAuthorized } from "@/lib/auth/authorize";
import { getRepositories } from "@/lib/data/provider";

export const dynamic = "force-dynamic";

export default async function DbOpsPage() {
  const session = await auth();
  requireAuthorized(session, "/db-ops");

  const repos = getRepositories();
  const schema = await repos.dbops.getSchema({});
  return <DbOpsOverview initialSchema={schema} />;
}
