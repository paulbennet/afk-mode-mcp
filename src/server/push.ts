import webPush from "web-push";
import { getSession } from "./session.js";

let vapidConfigured = false;
let vapidPublicKey: string | null = null;

export function initPush(): void {
  // Auto-generate VAPID keys each startup.
  // Push subscriptions are already in-memory (lost on restart), so ephemeral
  // keys are fine — the phone re-subscribes each session.
  const keys = webPush.generateVAPIDKeys();
  webPush.setVapidDetails("mailto:afk-mode-mcp@localhost", keys.publicKey, keys.privateKey);
  vapidPublicKey = keys.publicKey;
  vapidConfigured = true;
}

export function getVapidPublicKey(): string | null {
  return vapidPublicKey;
}

export async function sendPushNotification(title: string, body: string): Promise<boolean> {
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
      JSON.stringify({ title, body }),
    );
    return true;
  } catch {
    return false;
  }
}
