import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/auth";
import { requireAuthorized } from "@/lib/auth/authorize";
import { addToAllowlist, getAllowlist, removeFromAllowlist } from "@/lib/firestore/allowlist.repo";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await auth();
  requireAuthorized(session, "/admin/allowlist");
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border bg-background p-4 shadow-sm">{children}</div>;
}

async function addAllowlistAction(formData: FormData) {
  "use server";
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return;
  await addToAllowlist(email);
  revalidatePath("/admin/allowlist");
}

async function removeAllowlistAction(formData: FormData) {
  "use server";
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return;
  await removeFromAllowlist(email);
  revalidatePath("/admin/allowlist");
}

export default async function AllowlistPage() {
  await requireAdmin();

  const entries = await getAllowlist();
  const allowedCount = entries.filter((entry) => entry.status === "allowed").length;
  const revokedCount = entries.length - allowedCount;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Allowlist</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage portal access for approved email addresses.</p>
      </div>

      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-medium uppercase text-muted-foreground">Summary</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {entries.length} total / {allowedCount} allowed / {revokedCount} revoked
            </div>
          </div>

          <form action={addAllowlistAction} className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              aria-label="Email address"
              placeholder="email@company.com"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm sm:w-72"
            />
            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Add
            </button>
          </form>
        </div>
      </Card>

      <Card>
        <div className="text-xs font-medium uppercase text-muted-foreground">Entries</div>
        <div className="mt-4 overflow-hidden rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">Email</th>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">Status</th>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">Updated</th>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">Actor</th>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-sm text-muted-foreground">
                    No allowlist entries yet.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.email} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{entry.email}</td>
                    <td className="px-4 py-3 text-sm">{entry.status === "allowed" ? "Allowed" : "Revoked"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{entry.updatedAt ?? entry.createdAt}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{entry.updatedBy ?? entry.createdBy}</td>
                    <td className="px-4 py-3">
                      <form action={entry.status === "allowed" ? removeAllowlistAction : addAllowlistAction}>
                        <input type="hidden" name="email" value={entry.email} />
                        <button
                          type="submit"
                          className={
                            entry.status === "allowed"
                              ? "inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted/50"
                              : "inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
                          }
                        >
                          {entry.status === "allowed" ? "Remove" : "Allow"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
