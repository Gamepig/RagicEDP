import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { requireAdmin } from "@/lib/auth/authorize";
import { addToAllowlist, deleteFromAllowlist, getAllowlist } from "@/lib/firestore/allowlist.repo";
import { createOrResetEmailUserFromAllowlist, deleteUsersByEmail } from "@/lib/firestore/user.repo";

export const dynamic = "force-dynamic";
const PROTECTED_SUPER_ADMIN_EMAIL = "gamepig1976@gmail.com";

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border bg-background p-4 shadow-sm">{children}</div>;
}

async function addAllowlistAction(formData: FormData) {
  "use server";
  const session = requireAdmin(await auth(), "/admin/allowlist");
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return;
  await addToAllowlist(email);
  const actorEmail = session?.user?.email ?? "system";
  const generated = await createOrResetEmailUserFromAllowlist(email, actorEmail);
  revalidatePath("/admin/allowlist");
  redirect(`/admin/allowlist?generatedEmail=${encodeURIComponent(email)}&generatedPassword=${encodeURIComponent(generated.password)}`);
}

async function removeAllowlistAction(formData: FormData) {
  "use server";
  const session = requireAdmin(await auth(), "/admin/allowlist");
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return;
  const normalizedEmail = email.toLowerCase();
  const actorEmail = session.user?.email?.toLowerCase() ?? "";
  if (normalizedEmail === PROTECTED_SUPER_ADMIN_EMAIL && actorEmail !== PROTECTED_SUPER_ADMIN_EMAIL) return;
  await Promise.all([deleteFromAllowlist(normalizedEmail), deleteUsersByEmail(normalizedEmail)]);
  revalidatePath("/admin/allowlist");
}

export default async function AllowlistPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = requireAdmin(await auth(), "/admin/allowlist");
  const viewerEmail = session.user?.email?.toLowerCase() ?? "";
  const canViewProtected = viewerEmail === PROTECTED_SUPER_ADMIN_EMAIL;
  const searchParams = (await props.searchParams) ?? {};
  const generatedEmail = typeof searchParams.generatedEmail === "string" ? searchParams.generatedEmail : "";
  const generatedPassword = typeof searchParams.generatedPassword === "string" ? searchParams.generatedPassword : "";

  const allEntries = await getAllowlist();
  const entries = canViewProtected
    ? allEntries
    : allEntries.filter((entry) => entry.email.toLowerCase() !== PROTECTED_SUPER_ADMIN_EMAIL);
  const allowedCount = entries.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Allowlist</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage portal access for approved email addresses.</p>
      </div>

      <Card>
        {generatedPassword && (
          <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
            <div className="font-medium text-amber-900">一次性初始密碼（請立即交付使用者）</div>
            <div className="mt-1 text-amber-800">
              Email: <span className="font-mono">{generatedEmail}</span>
            </div>
            <div className="mt-1 text-amber-800">
              Password: <span className="font-mono">{generatedPassword}</span>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-medium uppercase text-muted-foreground">Summary</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {entries.length} total / {allowedCount} allowed
            </div>
            <a className="mt-2 inline-block text-xs text-primary underline" href="/admin/users">
              前往使用者管理
            </a>
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
                    <td className="px-4 py-3 text-sm">Allowed</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{entry.updatedAt ?? entry.createdAt}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{entry.updatedBy ?? entry.createdBy}</td>
                    <td className="px-4 py-3">
                      <form action={removeAllowlistAction}>
                        <input type="hidden" name="email" value={entry.email} />
                        <button
                          type="submit"
                          className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted/50"
                        >
                          Remove
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
