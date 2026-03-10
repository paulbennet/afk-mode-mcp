import webPush from "web-push";
import { getSession } from "./session.js";

let vapidConfigured = false;

export function initPush(): void {
  const publicKey = process.env.AFK_PUSH_VAPID_PUBLIC;
  const privateKey = process.env.AFK_PUSH_VAPID_PRIVATE;

  if (publicKey && privateKey) {
    webPush.setVapidDetails("mailto:afk-mode@localhost", publicKey, privateKey);
    vapidConfigured = true;
  }
}

export async function sendPushNotification(
  title: string,
  body: string
): Promise<boolean> {
  if (!vapidConfigured) return false;

  const session = getSession();
  if (!session.pushSubscription) return false;

  try {
    const sub = session.pushSubscription;
    await webPush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: sub.keys as { p256dh: string; auth: string },
      },
        );
        return true;
    } catch {
        return false;
    }
}
