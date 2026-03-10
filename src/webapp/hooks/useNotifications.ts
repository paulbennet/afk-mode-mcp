import { useEffect, useState } from "react";
import { useWebSocket } from "./useWebSocket";

export function useNotifications() {
  const { sendMessage, connectionState } = useWebSocket();
  const [permission, setPermission] = useState<NotificationPermission>(
    "Notification" in window ? Notification.permission : "denied",
  );

  useEffect(() => {
    if (connectionState !== "connected") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;

    async function subscribe() {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== "granted") return;

      // Fetch VAPID public key from server
      let vapidKey: string | null = null;
      try {
        const resp = await fetch("/api/vapid-key");
        if (resp.ok) {
          const data = await resp.json();
          vapidKey = data.key;
        }
      } catch {
        // VAPID not available — skip push subscription
        return;
      }

      if (!vapidKey) return;

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();

      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey,
        }));

      const json = subscription.toJSON();
      if (json.endpoint) {
        sendMessage({
          type: "push_subscription",
          subscription: {
            endpoint: json.endpoint,
            keys: json.keys as Record<string, string> | undefined,
          },
        });
      }
    }

    subscribe().catch(() => {
      // Push subscription failed — non-critical
    });
  }, [connectionState, sendMessage]);

  return { permission };
}
