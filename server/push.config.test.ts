import { createECDH } from "node:crypto";
import webpush from "web-push";
import { describe, expect, it } from "vitest";

describe("Web Push VAPID configuration", () => {
  it("accepts the configured contact subject and signing key pair", () => {
    const subject = process.env.VAPID_SUBJECT;
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;

    expect(subject).toMatch(/^(mailto:|https:\/\/)/);
    expect(publicKey).toMatch(/^[A-Za-z0-9_-]{60,}$/);
    expect(privateKey).toMatch(/^[A-Za-z0-9_-]{30,}$/);
    expect(() => webpush.setVapidDetails(subject!, publicKey!, privateKey!)).not.toThrow();
    const curve = createECDH("prime256v1");
    curve.setPrivateKey(Buffer.from(privateKey!, "base64url"));
    expect(curve.getPublicKey().toString("base64url")).toBe(publicKey);
  });
});
