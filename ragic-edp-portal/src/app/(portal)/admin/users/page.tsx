import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/auth";
import { requireAdmin } from "@/lib/auth/authorize";
import { ActivityLogButton } from "@/components/admin/activity_log_button";
import { listUsers, resetPasswordByUserId, updateUserRoleStatus } from "@/lib/firestore/user.repo";

export const dynamic = "force-dynamic";
const PROTECTED_SUPER_ADMIN_EMAIL = "gamepig1976@gmail.com";

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border bg-background p-4 shadow-sm">{children}</div>;
}

async function updateUserAction(formData: FormData) {
  "use server";
  const session = requireAdmin(await auth(), "/admin/users");
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "") as "admin" | "user";
  const status = String(formData.get("status") ?? "") as "active" | "suspended";
  if (!userId) return;
  await updateUserRoleStatus(userId, { role, status }, session.user?.email ?? "system");
  revalidatePath("/admin/users");
}

async function resetPasswordAction(formData: FormData) {
  "use server";
  const session = requireAdmin(await auth(), "/admin/users");
  const userId = String(formData.get("userId") ?? "");
  const email = String(formData.get("email") ?? "");
  if (!userId || !email) return;
  const newPassword = await resetPasswordByUserId(userId, session.user?.email ?? "system");
  revalidatePath("/admin/users");
  redirect(`/admin/users?resetEmail=${encodeURIComponent(email)}&resetPassword=${encodeURIComponent(newPassword)}`);
}

export default async function AdminUsersPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = requireAdmin(await auth(), "/admin/users");
  const viewerEmail = session.user?.email?.toLowerCase() ?? "";
  const canViewProtected = viewerEmail === PROTECTED_SUPER_ADMIN_EMAIL;

  const searchParams = (await props.searchParams) ?? {};
  const resetEmail = typeof searchParams.resetEmail === "string" ? searchParams.resetEmail : "";
  const resetPassword = typeof searchParams.resetPassword === "string" ? searchParams.resetPassword : "";

  const allUsers = await listUsers();
  const users = canViewProtected
    ? allUsers
    : allUsers.filter((u) => (u.email ?? "").toLowerCase() !== PROTECTED_SUPER_ADMIN_EMAIL);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage user role, status and reset passwords.</p>
      </div>

      <Card>
        <div className="text-sm">
          <a className="text-primary underline" href="/admin/allowlist">
            前往白名單管理
          </a>
        </div>
      </Card>

      <Card>
        {resetPassword && (
          <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
            <div className="font-medium text-amber-900">一次性重設密碼（請立即交付使用者）</div>
            <div className="mt-1 text-amber-800">Email: <span className="font-mono">{resetEmail}</span></div>
            <div className="mt-1 text-amber-800">Password: <span className="font-mono">{resetPassword}</span></div>
          </div>
        )}

        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">Email</th>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">Provider</th>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">Role</th>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">Status</th>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">Last Login</th>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">Actions</th>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">記錄</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-sm text-muted-foreground">No users.</td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.userId} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{u.email}</td>
                    <td className="px-4 py-3 text-xs">{u.authProvider ?? "-"}</td>
                    <td className="px-4 py-3 text-xs">{u.role ?? "user"}</td>
                    <td className="px-4 py-3 text-xs">{u.status ?? "active"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{u.lastLoginAt ?? "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <form action={updateUserAction} className="flex items-center gap-2">
                          <input type="hidden" name="userId" value={u.userId} />
                          <select name="role" defaultValue={u.role ?? "user"} className="h-8 rounded border bg-background px-2 text-xs">
                            <option value="user">user</option>
                            <option value="admin">admin</option>
                          </select>
                          <select name="status" defaultValue={u.status ?? "active"} className="h-8 rounded border bg-background px-2 text-xs">
                            <option value="active">active</option>
                            <option value="suspended">suspended</option>
                          </select>
                          <button type="submit" className="inline-flex h-8 items-center rounded border px-2 text-xs hover:bg-muted/40">更新</button>
                        </form>

                        <form action={resetPasswordAction}>
                          <input type="hidden" name="userId" value={u.userId} />
                          <input type="hidden" name="email" value={u.email} />
                          <button type="submit" className="inline-flex h-8 items-center rounded-md bg-primary px-2 text-xs text-primary-foreground">
                            重設密碼
                          </button>
                        </form>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <ActivityLogButton userId={u.userId} email={u.email} />
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
