import { redirect } from "next/navigation";

import { auth, signOut } from "@/lib/auth/auth";
import { requireAuthorized } from "@/lib/auth/authorize";
import { updatePasswordByUserId } from "@/lib/firestore/user.repo";

export const dynamic = "force-dynamic";

function validateStrongPassword(password: string): string | null {
  if (password.length < 12) return "密碼至少 12 碼";
  if (!/[A-Z]/.test(password)) return "密碼需包含大寫英文字母";
  if (!/[a-z]/.test(password)) return "密碼需包含小寫英文字母";
  if (!/[0-9]/.test(password)) return "密碼需包含數字";
  if (!/[^A-Za-z0-9]/.test(password)) return "密碼需包含特殊符號";
  return null;
}

async function changePasswordAction(formData: FormData) {
  "use server";
  const session = requireAuthorized(await auth(), "/auth/change-password");
  const userId = (session.user as any)?.id as string | undefined;
  const nextPassword = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!userId) return redirect("/auth/error?error=MissingUserId");
  if (nextPassword !== confirm) return redirect("/auth/change-password?error=Mismatch");
  const fail = validateStrongPassword(nextPassword);
  if (fail) return redirect(`/auth/change-password?error=${encodeURIComponent(fail)}`);

  await updatePasswordByUserId(userId, nextPassword);
  await signOut({ redirectTo: "/auth/login" });
}

type ChangePasswordPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function toText(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] ?? "" : v ?? "";
}

export default async function ChangePasswordPage(props: ChangePasswordPageProps) {
  const session = requireAuthorized(await auth(), "/auth/change-password");
  const mustChange = Boolean((session.user as any)?.mustChangePassword);
  if (!mustChange) {
    redirect("/analytics");
  }

  const params = (await props.searchParams) ?? {};
  const error = toText(params.error);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">首次登入請修改密碼</h1>
        <p className="mt-1 text-sm text-muted-foreground">為了安全，請先設定你的專屬新密碼。</p>
        {error && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div>
        )}
        <form action={changePasswordAction} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">新密碼</label>
            <input
              name="password"
              type="password"
              required
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="至少12碼，含大小寫/數字/符號"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">確認新密碼</label>
            <input
              name="confirm"
              type="password"
              required
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="再次輸入新密碼"
            />
          </div>
          <button type="submit" className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground">
            更新密碼
          </button>
        </form>
      </div>
    </main>
  );
}
