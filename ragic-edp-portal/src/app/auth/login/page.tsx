import { signIn } from "@/lib/auth/auth";

export const dynamic = "force-dynamic";

async function signInWithGoogle() {
  "use server";
  await signIn("google", { redirectTo: "/analytics" });
}

async function signInWithEmail(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  await signIn("credentials", {
    email,
    password,
    redirectTo: "/analytics",
  });
}

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">EDP Portal 登入</h1>
        <p className="mt-1 text-sm text-muted-foreground">使用 Google 或 Email + 密碼登入</p>

        <form action={signInWithGoogle} className="mt-4">
          <button className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border text-sm font-medium hover:bg-muted/40" type="submit">
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            使用 Google 登入
          </button>
        </form>

        <div className="my-4 text-center text-xs text-muted-foreground">或</div>

        <form action={signInWithEmail} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Email</label>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="user@company.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Password</label>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="••••••••••••"
            />
          </div>
          <button className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground" type="submit">
            登入
          </button>
        </form>
      </div>
    </main>
  );
}
