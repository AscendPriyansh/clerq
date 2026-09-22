import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());

// Read-only checks. Never print credentials or response bodies containing tokens.
const timeout = () => AbortSignal.timeout(15000);
async function checkAuth() {
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY }, signal: timeout(),
  });
  const data = await response.json();
  console.log(JSON.stringify({ service: "Supabase Auth", status: response.status, emailEnabled: data.external?.email, googleEnabled: data.external?.google }));
}
async function checkResend() {
  const response = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` }, signal: timeout(),
  });
  const data = await response.json();
  console.log(JSON.stringify({ service: "Resend domains", status: response.status, domains: data.data?.map(domain => ({ name: domain.name, status: domain.status, receiving: domain.capabilities?.receiving })) }));
}
const results = await Promise.allSettled([checkAuth(), checkResend()]);
for (const result of results) {
  if (result.status === "rejected") {
    console.error("Service check could not connect:", result.reason?.name ?? "UnknownError");
    process.exitCode = 1;
  }
}
