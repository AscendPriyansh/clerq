export const metadata = { title: "Create your organisation" };

import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { OnboardingForm } from "@/components/onboarding-form";

export default async function Onboarding() {
  await requireUser();
  return <main id="main-content" className="auth-shell">
    <div className="auth-grid">
      <section className="auth-intro">
        <Link href="/" className="flex items-center gap-2.5 text-[17px] font-semibold tracking-[-0.04em] text-foreground"><span className="brand-mark" aria-hidden="true"><span /></span>Clerq</Link>
        <div className="auth-intro-copy">
          <p className="mono-eyebrow">ONE SMALL STEP</p>
          <h1>Set up a workspace for your records.</h1>
          <p>Give your organisation a home for receipts, bank transactions and monthly reconciliation.</p>
        </div>
        <div className="auth-intro-note"><span className="auth-note-icon"><Check size={13} /></span><span>You can start uploading receipts as soon as your workspace is ready.</span></div>
      </section>
      <section className="auth-card-wrap">
        <div className="auth-card">
          <Link href="/" className="auth-back-link"><ArrowLeft size={14} /> Back to Clerq</Link>
          <div className="auth-card-heading"><div><p className="mono-eyebrow">WORKSPACE SETUP</p><h2>Create your organisation</h2><p className="auth-card-description">Set up a workspace for your receipts and bank transactions.</p></div></div>
          <OnboardingForm />
        </div>
        <p className="auth-legal">Your organisation name is used to identify this workspace.</p>
      </section>
    </div>
  </main>;
}
