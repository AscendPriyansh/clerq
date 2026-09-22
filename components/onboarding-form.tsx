"use client";

import { useActionState } from "react";
import { createOrganization } from "@/app/onboarding/actions";

export function OnboardingForm() {
  const [state, action, pending] = useActionState(createOrganization, { error: "" });
  return <form action={action} className="space-y-4">
    <label className="block">Organisation name<input name="name" required minLength={2} maxLength={100} autoComplete="organization" className="mt-1 block w-full rounded border p-2" /></label>
    <button disabled={pending} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">{pending ? "Creating…" : "Create organisation"}</button>
    {state.error && <p role="alert">{state.error}</p>}
  </form>;
}
