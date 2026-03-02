type AuthErrorPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function toText(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function AuthErrorPage(props: AuthErrorPageProps) {
  const params = (await props.searchParams) ?? {};
  const error = toText(params.error);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">登入失敗</h1>
        <p className="mt-2 text-sm text-muted-foreground">請確認帳號權限或登入資訊後重試。</p>
        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            Error: {error}
          </div>
        )}
        <a href="/auth/login" className="mt-4 inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted/40">
          返回登入頁
        </a>
      </div>
    </main>
  );
}
