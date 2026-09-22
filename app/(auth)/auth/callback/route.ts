import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "Missing authentication code", code: "INVALID_CALLBACK" }, { status: 400 });
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL("/login?error=callback", request.url));
    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch {
    return NextResponse.json({ error: "Unable to complete sign-in", code: "AUTH_UNAVAILABLE" }, { status: 503 });
  }
}
