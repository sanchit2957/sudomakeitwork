import { and, eq, inArray } from "drizzle-orm";
import webpush from "web-push";
import { pushSubscriptions } from "../drizzle/schema";
import { getDb } from "./db";

type PushPayload = { title: string; body: string; incidentId?: number; url?: string };

function configured() {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export async function sendRescuerPush(recipientIds: number[], payload: PushPayload) {
  if (!recipientIds.length || !configured()) return { sent: 0, skipped: recipientIds.length };
  const db = await getDb();
  if (!db) return { sent: 0, skipped: recipientIds.length };
  const subscriptions = await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, recipientIds));
  let sent = 0;
  await Promise.all(subscriptions.map(async subscription => {
    try {
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify(payload));
      sent += 1;
    } catch (error) {
      const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
      if (statusCode === 404 || statusCode === 410) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, subscription.id));
      else console.warn("[Push] Delivery failed", { subscriptionId: subscription.id, statusCode });
    }
  }));
  return { sent, skipped: Math.max(0, recipientIds.length - sent) };
}
