"use client";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function WorkspaceError({ reset }: { reset: () => void }) {
  return <section role="alert" className="page-status"><CircleAlert size={24} className="text-destructive mb-4" aria-hidden="true" /><h2>Unable to load this page</h2><p>Your saved records are still available. Try loading the page again.</p><Button onClick={reset}>Try again</Button></section>;
}
