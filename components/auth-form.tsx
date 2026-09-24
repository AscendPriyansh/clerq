"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export function AuthForm({ mode, initialError }: { mode: "login" | "register"; initialError?: string }) {
  const [message, setMessage] = useState(initialError ?? "");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const intent = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ?? "password";
    const email = String(values.get("email") ?? "").trim();
    const password = String(values.get("password") ?? "");
    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      const callback = `${window.location.origin}/auth/callback`;
      if (intent === "google") {
        const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback } });
        if (error) throw error;
      } else if (intent === "magic") {
        if (!email) throw new Error("Enter your email address first.");
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: callback, shouldCreateUser: false } });
        if (error) throw error;
        setMessage("If an account exists, a sign-in link has been sent. Check your email.");
      } else if (mode === "register") {
        if (password.length < 8) throw new Error("Use a password of at least 8 characters.");
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name: String(values.get("name") ?? "").trim() }, emailRedirectTo: callback } });
        if (error) throw error;
        if (data.session) { window.location.replace("/onboarding"); }
        else setMessage("Check your email to confirm your account, then sign in to create your organisation.");
      } else {
        if (!email || !password) throw new Error("Enter your email address and password.");
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Discard routes prefetched before authentication, including login redirects.
        window.location.replace("/dashboard");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-in failed. Try again.");
    } finally { setBusy(false); }
  }
  return (
    <main className="mx-auto w-full max-w-md space-y-5 p-8">
      <h1 className="text-2xl font-semibold">{mode === "register" ? "Create your Clerq account" : "Sign in to Clerq"}</h1>
      <form onSubmit={submit} className="space-y-4">
        {mode === "register" && <label className="block">Name<input name="name" autoComplete="name" required maxLength={120} className="mt-1 block w-full rounded border p-2" /></label>}
        <label className="block">Email<input name="email" type="email" autoComplete="email" required className="mt-1 block w-full rounded border p-2" /></label>
        <label className="block">Password<input name="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} className="mt-1 block w-full rounded border p-2" /></label>
        <button disabled={busy} value="password" className="w-full rounded bg-black p-2 text-white disabled:opacity-50">{busy ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"}</button>
        {mode === "login" && <>
          <button disabled={busy} value="magic" className="w-full rounded border p-2">Email me a sign-in link</button>
          {process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true" && <button disabled={busy} value="google" formNoValidate className="w-full rounded border p-2">Continue with Google</button>}
        </>}
      </form>
      {message && <p role="status" className="rounded border p-3 text-sm">{message}</p>}
      <Link className="block underline" href={mode === "login" ? "/register" : "/login"}>{mode === "login" ? "Create an account" : "Already registered? Sign in"}</Link>
    </main>
  );
}
