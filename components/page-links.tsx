import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { pageHref, type PageParams } from "@/lib/pagination";

export function PageLinks({ path, params, pageKey = "page", page, hasNext, label = "Records" }: {
  path: string; params: PageParams; pageKey?: string; page: number; hasNext: boolean; label?: string;
}) {
  return <nav aria-label={`${label} pages`} className="page-pagination">
    {page > 1 ? <Link href={pageHref(path, params, pageKey, page - 1)} scroll={false}><ChevronLeft size={13} aria-hidden="true" />Previous</Link> : <span aria-disabled="true" className="page-disabled"><ChevronLeft size={13} aria-hidden="true" />Previous</span>}
    <span aria-current="page">Page {page}</span>
    {hasNext ? <Link href={pageHref(path, params, pageKey, page + 1)} scroll={false}>Next<ChevronRight size={13} aria-hidden="true" /></Link> : <span aria-disabled="true" className="page-disabled">Next<ChevronRight size={13} aria-hidden="true" /></span>}
  </nav>;
}
