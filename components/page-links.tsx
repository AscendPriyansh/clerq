import Link from "next/link";
import { pageHref, type PageParams } from "@/lib/pagination";
export function PageLinks({ path, params, pageKey = "page", page, hasNext, label = "Records" }: {
  path: string; params: PageParams; pageKey?: string; page: number; hasNext: boolean; label?: string;
}) {
  return <nav aria-label={`${label} pages`} className="flex items-center gap-4 py-3 text-sm">
    {page > 1 ? <Link className="rounded border px-3 py-2" href={pageHref(path, params, pageKey, page - 1)} scroll={false}>Previous</Link> : <span className="px-3 py-2 text-muted-foreground">Previous</span>}
    <span>Page {page}</span>
    {hasNext ? <Link className="rounded border px-3 py-2" href={pageHref(path, params, pageKey, page + 1)} scroll={false}>Next</Link> : <span className="px-3 py-2 text-muted-foreground">Next</span>}
  </nav>;
}
