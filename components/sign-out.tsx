"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOut() {
  const router = useRouter();
  const [error, setError] = useState("");
  return <><button className="rounded border px-3 py-1" onClick={async () => {
    try {
      const { error } = await createClient().auth.signOut();
      if (error) throw error;
      router.replace("/login");
      router.refresh();
    } catch { setError("Unable to sign out. Try again."); }
  }}>Sign out</button>{error && <p role="alert">{error}</p>}</>;
}
