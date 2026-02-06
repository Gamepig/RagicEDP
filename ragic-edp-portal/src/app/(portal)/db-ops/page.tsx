import { getRepositories } from "@/lib/data/provider";
import { DbOpsOverview } from "@/components/dbops/dbops_overview";

export const dynamic = "force-dynamic";

export default async function DbOpsPage() {
  const repos = getRepositories();
  const schema = await repos.dbops.getSchema({});
  return <DbOpsOverview initialSchema={schema} />;
}
