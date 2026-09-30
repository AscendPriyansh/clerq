export default function Loading() {
  return <div role="status" aria-live="polite" className="workspace-page space-y-6">
    <p className="text-sm text-muted-foreground">Loading your workspace…</p>
    <div aria-hidden="true" className="space-y-5 motion-safe:animate-pulse">
      <div className="h-10 w-48 rounded-md bg-muted" />
      <div className="grid gap-4 sm:grid-cols-3">{[1, 2, 3].map(key => <div key={key} className="h-40 rounded-lg border bg-card" />)}</div>
      <div className="h-64 rounded-lg border bg-card" />
    </div>
  </div>;
}
