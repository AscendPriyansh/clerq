"use client";

import Link from "next/link";
import { ArrowRight, Check, LockKeyhole } from "lucide-react";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export function AuthForm({ mode, initialError }: { mode: "login" | "register"; initialError?: string }) {
  const [message, setMessage] = useState(initialError ?? "");
  const [busy, setBusy] = useState(false);
  const [hasError, setHasError] = useState(Boolean(initialError));
  const isRegister = mode === "register";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const values = new FormData(event.currentTarget);
    const intent = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ?? "password";
    const email = String(values.get("email") ?? "").trim();
    const password = String(values.get("password") ?? "");
    setBusy(true);
    setMessage("");
    setHasError(false);
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
      } else if (isRegister) {
        if (password.length < 8) throw new Error("Use a password of at least 8 characters.");
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name: String(values.get("name") ?? "").trim() }, emailRedirectTo: callback } });
        if (error) throw error;
        if (data.session) window.location.replace("/onboarding");
        else setMessage("Check your email to confirm your account, then sign in to create your organisation.");
      } else {
        if (!email || !password) throw new Error("Enter your email address and password.");
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.replace("/dashboard");
      }
    } catch (error) {
      setHasError(true);
      setMessage(error instanceof Error ? error.message : "Sign-in failed. Try again.");
    } finally { setBusy(false); }
  }

  return (
    <main id="main-content" className="auth-shell">
      <div className="auth-grid">
        <section className="auth-intro">
          <Link href="/" className="flex items-center gap-2.5 text-[17px] font-semibold tracking-[-0.04em] text-foreground"><span className="brand-mark" aria-hidden="true"><span /></span>Clerq</Link>
          <div className="auth-intro-copy">
            <p className="mono-eyebrow">{isRegister ? "START WITH CLERQ" : "WELCOME BACK"}</p>
            <h1>{isRegister ? "Bring the month together." : "Your records, ready when you are."}</h1>
            <p>{isRegister ? "A clear workspace for receipts, bank transactions and the details between them." : "Pick up where you left off and keep every receipt close to its bank transaction."}</p>
          </div>
          <div className="auth-intro-note"><span className="auth-note-icon"><Check size={13} /></span><span>Private records. Clear review. No bank connection required.</span></div>
        </section>
        <section className="auth-card-wrap">
          <div className="auth-card">
            <div className="auth-card-heading"><div><p className="mono-eyebrow">{isRegister ? "CREATE ACCOUNT" : "SIGN IN"}</p><h2>{isRegister ? "Create your Clerq account" : "Sign in to Clerq"}</h2></div><span className="auth-lock"><LockKeyhole size={15} /></span></div>
            <form onSubmit={submit} className="auth-form" aria-busy={busy}>
              {isRegister && <label className="auth-field"><span>Name</span><input disabled={busy} name="name" autoComplete="name" required maxLength={120} placeholder="Your name" /></label>}
              <label className="auth-field"><span>Email</span><input disabled={busy} name="email" type="email" autoComplete="email" required placeholder="you@company.com" /></label>
              <label className="auth-field"><span>Password</span><input aria-label="Password" disabled={busy} name="password" type="password" autoComplete={isRegister ? "new-password" : "current-password"} placeholder={isRegister ? "At least 8 characters" : "Your password"} />{isRegister && <small>Use at least 8 characters.</small>}</label>
              <button type="submit" disabled={busy} value="password" className="auth-submit">{busy ? "Please wait…" : isRegister ? "Create account" : "Sign in"}<ArrowRight size={16} /></button>
              {mode === "login" && <>
                <div className="auth-divider"><span>or</span></div>
                <button type="submit" disabled={busy} value="magic" className="auth-secondary-submit">Email me a sign-in link</button>
                {process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true" && <button type="submit" disabled={busy} value="google" formNoValidate className="auth-secondary-submit">Continue with Google</button>}
              </>}
            </form>
            {message && <p role={hasError ? "alert" : "status"} className={`auth-message ${hasError ? "auth-message-error" : "auth-message-success"}`}>{message}</p>}
            <p className="auth-footer-link">{isRegister ? "Already registered?" : "New to Clerq?"} <Link href={isRegister ? "/login" : "/register"}>{isRegister ? "Sign in" : "Create an account"}</Link></p>
          </div>
          <p className="auth-legal">A workspace for your organisation’s receipts and bank records.</p>
        </section>
      </div>
    </main>
  );
}
