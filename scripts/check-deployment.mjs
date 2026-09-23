import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const base = (process.argv[2] || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
if (!base.startsWith("https://")) throw new Error("Provide the HTTPS deployment URL.");
const checks = [
  ["login", "/login", "GET", 200],
  ["dashboard access", "/dashboard", "GET", 307],
  ["receipt upload access", "/api/ai/parse-receipt", "POST", 401],
  ["recovery access", "/api/cron/jobs", "GET", 401],
  ["webhook rejects unsigned requests", "/api/webhooks/resend", "POST", 401],
];
let failures = 0;
for (const [name, path, method, expected] of checks) {
  try {
    const response = await fetch(base + path, { method, redirect: "manual", body: method === "POST" ? "{}" : undefined, signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, expected);
    console.log(`PASS ${name}`);
  } catch { failures++; console.error(`FAIL ${name} (expected HTTP ${expected})`); }
}
if (process.env.RESEND_WEBHOOK_SECRET) {
  // An ignored event validates the secret without creating a job or sending email.
  const body = JSON.stringify({ type: "email.sent", data: {} });
  const id = `msg_${randomUUID()}`, timestamp = String(Math.floor(Date.now() / 1000));
  const secret = Buffer.from(process.env.RESEND_WEBHOOK_SECRET.replace(/^whsec_/, ""), "base64");
  const signature = createHmac("sha256", secret).update(`${id}.${timestamp}.${body}`).digest("base64");
  try {
    const response = await fetch(`${base}/api/webhooks/resend`, { method: "POST", headers: { "content-type": "application/json", "svix-id": id, "svix-timestamp": timestamp, "svix-signature": `v1,${signature}` }, body, signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 200);
    console.log("PASS deployment uses the configured Resend signing secret");
  } catch { failures++; console.error("FAIL deployed Resend signing secret verification"); }
}
process.exitCode = failures ? 1 : 0;
