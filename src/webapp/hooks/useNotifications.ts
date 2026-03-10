import { useEffect, useState } from "react";
import { useWebSocket } from "./useWebSocket";

export function useNotifications() {
    const { sendMessage, connectionState } = useWebSocket();
    const [permission, setPermission] = useState<NotificationPermission>(
        "Notification" in window ? Notification.permission : "denied"
    );

    useEffect(() => {
        if (connectionState !== "connected") return;
        if (!("Notification" in window) || !("serviceWorker" in navigator)) return;

        async function subscribe() {
            const perm = await Notification.requestPermission();
            setPermission(perm);

            if (perm !== "granted") return;

            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: undefined, // VAPID key would go here
            });

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
