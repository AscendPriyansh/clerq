import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
nextEnv.loadEnvConfig(process.cwd());
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const options = { public: false, fileSizeLimit: 10 * 1024 * 1024, allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"] };
const existing = await client.storage.getBucket("receipts-vault");
const result = existing.data ? await client.storage.updateBucket("receipts-vault", options) : await client.storage.createBucket("receipts-vault", options);
if (result.error) { console.error("Storage setup failed", result.error.name); process.exitCode = 1; }
else console.log("Private receipts-vault bucket configured (10 MB; PDF and supported images).");
