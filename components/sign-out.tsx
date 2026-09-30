"use client";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SignOut() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return <><button className="workspace-signout" disabled={busy} onClick={async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await createClient().auth.signOut();
      if (error) throw error;
      window.location.replace("/login");
    } catch { setError("Unable to sign out. Try again."); setBusy(false); }
  }}><LogOut size={15} aria-hidden="true" />{busy ? "Signing out…" : "Sign out"}</button>{error && <p role="alert" className="auth-message auth-message-error">{error}</p>}</>;
}
