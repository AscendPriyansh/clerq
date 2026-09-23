export default function Loading() {
  return <div role="status" aria-live="polite" className="space-y-4 p-6">
    <p className="text-sm text-muted-foreground">Loading your workspace…</p>
    <div aria-hidden="true" className="space-y-3 motion-safe:animate-pulse">
      <div className="h-8 w-48 rounded bg-muted" />
      <div className="grid gap-4 sm:grid-cols-3">{[1, 2, 3].map(key => <div key={key} className="h-24 rounded border bg-muted" />)}</div>
      <div className="h-64 rounded border bg-muted" />
    </div>
  </div>;
}
