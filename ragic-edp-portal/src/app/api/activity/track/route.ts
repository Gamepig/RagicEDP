import { auth } from "@/lib/auth/auth";
import { logActivity } from "@/lib/firestore/activity-log.repo";

export async function POST(request: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id;
  const email = session?.user?.email;
  if (!userId || !email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { path?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const path = body.path;
  if (!path || typeof path !== "string") {
    return Response.json({ error: "Missing path" }, { status: 400 });
  }

  const userAgent = request.headers.get("user-agent") ?? undefined;

  try {
    await logActivity({
      userId,
      email,
      type: "page_view",
      path,
      userAgent,
    });
  } catch (err) {
    console.error("[activity-track] logActivity failed:", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
