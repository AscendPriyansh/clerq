"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SignOut() {
  const [error, setError] = useState("");
  return <><button className="rounded border px-3 py-1" onClick={async () => {
    try {
      const { error } = await createClient().auth.signOut();
      if (error) throw error;
      window.location.replace("/login");
    } catch { setError("Unable to sign out. Try again."); }
  }}>Sign out</button>{error && <p role="alert">{error}</p>}</>;
}
