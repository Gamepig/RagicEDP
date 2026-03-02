export default function CustomChartsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        <div className="h-9 w-64 animate-pulse rounded bg-muted" />
      </div>

      <div className="rounded-xl border bg-muted/20 p-4">
        <div className="h-9 w-full animate-pulse rounded bg-muted" />
      </div>

      <div className="rounded-xl border bg-background p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          圖表載入中…
        </div>
      </div>
    </div>
  );
}
