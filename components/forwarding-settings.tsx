"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { activateForwarding } from "@/app/(dashboard)/dashboard/[orgSlug]/settings/actions";
import { Button } from "@/components/ui/button";
export function ForwardingSettings({ orgSlug }: { orgSlug: string }) {
  const [message, setMessage] = useState(""); const [pending, startTransition] = useTransition(); const router = useRouter();
  return <div className="space-y-2"><Button disabled={pending} onClick={() => startTransition(async () => { const result = await activateForwarding(orgSlug); setMessage("error" in result ? result.error ?? "Activation failed." : "Forwarding address activated. Send receipts to the address above."); router.refresh(); })}>Activate email forwarding</Button>{message && <p role="status">{message}</p>}</div>;
}
