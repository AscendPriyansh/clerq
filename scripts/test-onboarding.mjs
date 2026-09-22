import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { PrismaClient } from "@prisma/client";

nextEnv.loadEnvConfig(process.cwd());
const base = process.env.TEST_APP_URL || "http://127.0.0.1:3001";
const prisma = new PrismaClient();
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const jar = new Map();
const auth = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: cookies => cookies.forEach(({ name, value }) => jar.set(name, value)) },
});
const runId = randomUUID();
let userId;
const headers = () => ({ Cookie: [...jar].map(([name, value]) => `${name}=${value}`).join("; "), Origin: base });
const decode = value => value.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
try {
  const email = `clerq-test-${runId}@example.test`;
  const password = `${randomUUID()}aA9!`;
  // Admin-created disposable test identity: no confirmation email is sent.
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw new Error(`Test identity creation: ${created.error.code || created.error.status}`);
  userId = created.data.user.id;
  const signedIn = await auth.auth.signInWithPassword({ email, password });
  assert.equal(signedIn.error, null, "Password sign-in succeeds");
  console.log("PASS live password sign-in and SSR cookie creation");
  const response = await fetch(`${base}/onboarding`, { headers: headers(), redirect: "manual" });
  assert.equal(response.status, 200);
  const html = await response.text();
  const form = new FormData();
  for (const input of html.matchAll(/<input\b[^>]*>/g)) {
    const name = input[0].match(/name="([^"]*)"/)?.[1];
    const value = input[0].match(/value="([^"]*)"/)?.[1] ?? "";
    if (name?.startsWith("$ACTION")) form.append(decode(name), decode(value));
  }
  assert.ok([...form.keys()].length > 0, "Server action form metadata exists");
  form.set("name", `Clerq test ${runId}`);
  const submitted = await fetch(`${base}/onboarding`, { method: "POST", headers: headers(), body: form, redirect: "manual" });
  assert.equal(submitted.status, 303, "Onboarding redirects after success");
  const location = submitted.headers.get("location");
  assert.ok(location?.startsWith("/dashboard/"));
  const membership = await prisma.membership.findFirst({ where: { userId }, include: { organization: true } });
  assert.equal(membership?.role, "OWNER");
  assert.equal(location, `/dashboard/${membership.organization.slug}`);
  const dashboard = await fetch(new URL(location, base), { headers: headers() });
  assert.equal(dashboard.status, 200);
  assert.ok((await dashboard.text()).includes("Overview"));
  console.log("PASS onboarding Server Action, OWNER membership and dashboard");
  const denied = await fetch(`${base}/dashboard/not-their-organisation`, { headers: headers(), redirect: "manual" });
  assert.equal(denied.status, 307);
  console.log("PASS cross-organisation route denial");
} catch (error) {
  console.error(error instanceof assert.AssertionError ? error.message : `Test failed: ${error.name}: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (userId) {
    const orgs = await prisma.membership.findMany({ where: { userId }, select: { orgId: true } });
    await prisma.organization.deleteMany({ where: { id: { in: orgs.map(row => row.orgId) } } });
    await prisma.user.deleteMany({ where: { id: userId } });
    const result = await admin.auth.admin.deleteUser(userId);
    if (result.error) { console.error("Test Auth identity cleanup failed"); process.exitCode = 1; }
    else console.log("Test user and organisation cleaned up");
  }
  await prisma.$disconnect();
}
