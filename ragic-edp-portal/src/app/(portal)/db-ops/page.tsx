import { DbOpsOverview } from "@/components/dbops/dbops_overview";
import { auth } from "@/lib/auth/auth";
import { requireAuthorized } from "@/lib/auth/authorize";
import { getRepositories } from "@/lib/data/provider";
import type { ResultV0, DbOpsSchemaV0 } from "@/lib/data/types";

export const dynamic = "force-dynamic";

export default async function DbOpsPage() {
  const session = await auth();
  requireAuthorized(session, "/db-ops");

  let schema: ResultV0<DbOpsSchemaV0>;
  try {
    const repos = getRepositories();
    schema = await repos.dbops.getSchema({});
  } catch (err) {
    schema = {
      ok: false,
      error: { code: "PAGE_LOAD_ERROR", message: err instanceof Error ? err.message : String(err) },
    };
  }
  return <DbOpsOverview initialSchema={schema} />;
}
