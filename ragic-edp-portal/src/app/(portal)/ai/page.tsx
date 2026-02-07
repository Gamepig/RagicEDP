import { AiExpertOverview } from "@/components/ai_expert/ai_expert_overview";
import { auth } from "@/lib/auth/auth";
import { requireAuthorized } from "@/lib/auth/authorize";

export const dynamic = "force-dynamic";

export default async function AiExpertPage() {
  const session = await auth();
  requireAuthorized(session, "/ai");

  return <AiExpertOverview />;
}
