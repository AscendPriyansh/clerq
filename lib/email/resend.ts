import { Resend } from "resend";
import { z } from "zod";

export const ReceivedEmailSchema = z.object({
  type: z.literal("email.received"),
  data: z.object({
    email_id: z.string().uuid(),
    to: z.array(z.string().max(320)).min(1).max(100),
    received_for: z.array(z.string().max(320)).max(100).default([]),
    attachments: z.array(z.object({ id: z.string().uuid(), content_type: z.string() })).max(100).default([]),
  }),
});

export function verifyResendWebhook(payload: string, headers: Headers, webhookSecret: string) {
  return new Resend("re_signature_verification_only").webhooks.verify({ payload, webhookSecret, headers: {
    id: headers.get("svix-id") || "", timestamp: headers.get("svix-timestamp") || "", signature: headers.get("svix-signature") || "",
  } });
}

export function emailAddress(value: string) { return (value.match(/<([^>]+)>/)?.[1] ?? value).trim().toLowerCase(); }
