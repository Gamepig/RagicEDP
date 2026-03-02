import { GA4OpsOverview } from "@/components/dbops/ga4_ops_overview";
import { auth } from "@/lib/auth/auth";
import { requireAuthorized } from "@/lib/auth/authorize";
import { getGA4Schema } from "@/actions/ga4-ops";
import type { DbOpsSchemaV0, ResultV0 } from "@/lib/data/types";

export const dynamic = "force-dynamic";

export default async function GA4OpsPage() {
  const session = await auth();
  requireAuthorized(session, "/ga4-ops");

  let schema: ResultV0<DbOpsSchemaV0>;
  try {
    schema = await getGA4Schema({});
  } catch (err) {
    schema = {
      ok: false,
      error: { code: "PAGE_LOAD_ERROR", message: err instanceof Error ? err.message : String(err) },
    };
  }

  return <GA4OpsOverview initialSchema={schema} />;
}
