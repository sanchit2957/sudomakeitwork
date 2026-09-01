import { and, eq, inArray } from "drizzle-orm";
import webpush from "web-push";
import { pushSubscriptions } from "../drizzle/schema";
import { getDb } from "./db";

type PushPayload = { title: string; body: string; incidentId?: number; url?: string };

export function verifyVapidConfiguration(): boolean {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!subject || !publicKey || !privateKey) {
    console.warn("\n==================================================================");
    console.warn("⚠️  [VAPID PUSH WARNING] Web Push credentials are MISSING!");
    console.warn("   Background push alerts to rescuers will NOT be delivered.");
    console.warn("   REQUIRED environment variables in .env / deployment:");
    console.warn("     - VAPID_SUBJECT (e.g. mailto:admin@assamrescue.gov.in)");
    console.warn("     - VAPID_PUBLIC_KEY");
    console.warn("     - VAPID_PRIVATE_KEY");
    console.warn("   Generate keys with: `npx web-push generate-vapid-keys`");
    console.warn("==================================================================\n");
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    console.log("✅ [VAPID PUSH] Web Push notification engine configured successfully.");
    return true;
  } catch (err) {
    console.error("❌ [VAPID PUSH ERROR] Invalid VAPID credentials provided:", err);
    return false;
  }
}

function configured() {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) return false;
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    return true;
  } catch {
    return false;
  }
}

export async function sendRescuerPush(recipientIds: number[], payload: PushPayload) {
  if (!recipientIds.length) {
    return { sent: 0, skipped: 0, successfulUserIds: [], failedUserIds: [] };
  }

  if (!configured()) {
    return {
      sent: 0,
      skipped: recipientIds.length,
      successfulUserIds: [],
      failedUserIds: recipientIds,
    };
  }

  const db = await getDb();
  if (!db) {
    return {
      sent: 0,
      skipped: recipientIds.length,
      successfulUserIds: [],
      failedUserIds: recipientIds,
    };
  }

  const subscriptions = await db
    .select()
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.userId, recipientIds));

  const successfulUserIds = new Set<number>();

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify(payload)
        );
        successfulUserIds.add(subscription.userId);
      } catch (error) {
        const statusCode =
          typeof error === "object" && error && "statusCode" in error
            ? Number(error.statusCode)
            : 0;
        if (statusCode === 404 || statusCode === 410) {
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.id, subscription.id));
        } else {
          console.warn("[Push] Delivery failed for subscription:", {
            userId: subscription.userId,
            subscriptionId: subscription.id,
            statusCode,
          });
        }
      }
    })
  );

  const successList = Array.from(successfulUserIds);
  const failedList = recipientIds.filter((id) => !successfulUserIds.has(id));

  return {
    sent: successList.length,
    skipped: failedList.length,
    successfulUserIds: successList,
    failedUserIds: failedList,
  };
}
