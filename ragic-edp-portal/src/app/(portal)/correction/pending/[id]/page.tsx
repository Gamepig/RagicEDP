import { CorrectionDetail } from "@/components/correction/correction_detail";
import { auth } from "@/lib/auth/auth";
import { requireAuthorized } from "@/lib/auth/authorize";
import { getRepositories } from "@/lib/data/provider";

export const dynamic = "force-dynamic";

export default async function CorrectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  requireAuthorized(session, "/correction/pending");

  const { id } = await params;
  const repos = getRepositories();
  const detail = await repos.correction.getRecordDetail({ recordId: id });
  return <CorrectionDetail initialDetail={detail} />;
}
