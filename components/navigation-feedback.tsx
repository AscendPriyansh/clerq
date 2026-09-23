"use client";
import { useLinkStatus } from "next/link";
export function NavigationFeedback() {
  const { pending } = useLinkStatus();
  return <span role="status" className="ml-2 inline-block min-w-4 text-xs">{pending ? "…" : ""}<span className="sr-only">{pending ? "Loading page" : ""}</span></span>;
}
