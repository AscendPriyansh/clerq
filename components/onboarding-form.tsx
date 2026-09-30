"use client";

import { ArrowRight } from "lucide-react";
import { useActionState } from "react";
import { createOrganization } from "@/app/onboarding/actions";

export function OnboardingForm() {
  const [state, action, pending] = useActionState(createOrganization, { error: "" });
  return <form action={action} className="auth-form" aria-busy={pending}>
    <label className="auth-field"><span>Organisation name</span><input aria-label="Organisation name" disabled={pending} name="name" required minLength={2} maxLength={100} autoComplete="organization" placeholder="e.g. Melbourne Studio" /><small>Use 2–100 characters.</small></label>
    <button disabled={pending} className="auth-submit">{pending ? "Creating…" : "Create organisation"}<ArrowRight size={16} /></button>
    {state.error && <p role="alert" className="auth-message auth-message-error">{state.error}</p>}
  </form>;
}
