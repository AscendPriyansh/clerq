import { createHmac, randomBytes } from "node:crypto";
import { verifyResendWebhook, ReceivedEmailSchema, emailAddress } from "./resend";

const secretBytes = randomBytes(32), secret = `whsec_${secretBytes.toString("base64")}`;
const payload = JSON.stringify({ type: "email.received", data: { email_id: "30cbe6b1-693c-46d0-a7f3-86f443c9a89f", to: ["receipts@example.test"], attachments: [] } });
function headers(body: string, timestamp = Math.floor(Date.now() / 1000).toString()) {
  const id = "msg_test";
  const signature = createHmac("sha256", secretBytes).update(`${id}.${timestamp}.${body}`).digest("base64");
  return new Headers({ "svix-id": id, "svix-timestamp": timestamp, "svix-signature": `v1,${signature}` });
}
test("accepts a correctly signed Resend fixture", () => expect(ReceivedEmailSchema.parse(verifyResendWebhook(payload, headers(payload), secret)).type).toBe("email.received"));
test("rejects tampered body", () => expect(() => verifyResendWebhook(payload + " ", headers(payload), secret)).toThrow());
test("rejects old signature", () => expect(() => verifyResendWebhook(payload, headers(payload, "1"), secret)).toThrow());
test("recipient display name is stripped", () => expect(emailAddress("Acme <ACME@example.test>")).toBe("acme@example.test"));
