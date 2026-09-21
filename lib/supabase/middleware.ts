import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "./config";

export async function refreshSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = supabaseConfig();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        if (headers) {
          Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
        }
      },
    },
  });
  // Verify with Auth; do not trust the session object supplied in cookies.
  const { data: { user }, error } = await supabase.auth.getUser();
  return { response, user: error ? null : user };
}
