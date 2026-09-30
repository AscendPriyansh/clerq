"use client";
import { Check, Mail, Play } from "lucide-react";
import { useState, useTransition } from "react";
import { activateForwarding } from "@/app/(dashboard)/dashboard/[orgSlug]/settings/actions";
import { Button } from "@/components/ui/button";

export function ForwardingSettings({ orgSlug, configured }: { orgSlug: string; configured: boolean }) {
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  if (configured) return <div className="settings-configured-note" role="status"><span><Check size={14} aria-hidden="true" /> Forwarding is active</span><small>Receipt attachments sent to this address will be queued for processing.</small></div>;
  return <div className="settings-activation" aria-busy={pending}>
    <Button disabled={pending} className="workspace-primary-action settings-activate-button" onClick={() => startTransition(async () => {
      setMessage("");
      setFailed(false);
      try {
        const result = await activateForwarding(orgSlug);
        setFailed("error" in result);
        setMessage("error" in result ? result.error ?? "Activation failed." : "Forwarding address activated. Send receipts to the address above.");
      } catch { setFailed(true); setMessage("Unable to activate forwarding. Try again."); }
    })}>{pending ? <><Mail size={14} aria-hidden="true" /> Activating…</> : <><Play size={14} aria-hidden="true" /> Activate email forwarding</>}</Button>
    {message && <p role={failed ? "alert" : "status"} className={`settings-feedback ${failed ? "settings-feedback-error" : "settings-feedback-success"}`}>{!failed && <Check size={14} aria-hidden="true" />}{message}</p>}
  </div>;
}
