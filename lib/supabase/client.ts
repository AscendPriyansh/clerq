"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "./config";

let client: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (!client) {
    const { url, anonKey } = supabaseConfig();
    client = createBrowserClient(url, anonKey);
  }
  return client;
}
