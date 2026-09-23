"use client";
export default function WorkspaceError({ reset }: { reset: () => void }) {
  return <section role="alert" className="space-y-4 p-6"><h2 className="text-xl font-semibold">Unable to load this page</h2><p>Your saved records are still available. Try loading the page again.</p><button onClick={reset} className="rounded border px-4 py-2">Try again</button></section>;
}
