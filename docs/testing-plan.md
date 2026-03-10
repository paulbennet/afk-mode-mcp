# AFK Mode — Testing Plan

## Overview

This document covers the full verification plan for AFK Mode, organized by area. Tests are a mix of automated (scriptable) and manual (requires real browser/device).

---

## 1. Server Startup

| # | Test | Method | Expected Result |
|---|------|--------|-----------------|
| 1.1 | Server starts on default port | `node dist/index.js` | Binds to port 7842, prints connect URL to stderr |
| 1.2 | Server starts on custom port | `AFK_PORT=9000 node dist/index.js` | Binds to port 9000 |
| 1.3 | Port conflict error | Start two instances on same port | Second instance exits with `EADDRINUSE` error message |
| 1.4 | Local IP detection | Start server on a machine with network | URL contains LAN IP (not `127.0.0.1`) |
| 1.5 | Session token generation | Start server | URL contains a unique base64url token |

---

## 2. MCP Tools

Test via MCP SDK client or by having Copilot invoke the tools.

| # | Test | Method | Expected Result |
|---|------|--------|-----------------|
| 2.1 | Tool discovery | Connect MCP client, list tools | 4 tools returned: `get_current_web_app_url`, `get_afk_status`, `notify_session_progress`, `get_user_decision` |
| 2.2 | `get_current_web_app_url` | Call tool with no args | Returns URL with token, QR code as base64 data-URI markdown, session ID |
| 2.3 | `get_afk_status` — default | Call tool at startup | `{ afkMode: false, clientConnected: false, sessionId: "..." }` |
| 2.4 | `get_afk_status` — after toggle | Toggle AFK on from web app, call tool | `{ afkMode: true, clientConnected: true }` |
| 2.5 | `notify_session_progress` — no client | Call with valid params, no WS client connected | Returns `{ delivered: false }` |
| 2.6 | `notify_session_progress` — with client | Call with client connected | Returns `{ delivered: true }`, client receives progress update |
| 2.7 | `notify_session_progress` — all categories | Send one of each: `info`, `warning`, `error`, `success`, `milestone` | Each renders with correct icon on client |
| 2.8 | `notify_session_progress` — with progress bar | Include `progress: { current: 3, total: 10, label: "Files" }` | Client renders progress bar |
| 2.9 | `get_user_decision` — confirm | Send type `confirm` | Client shows Yes/No prompt, response returned to tool |
| 2.10 | `get_user_decision` — choice | Send type `choice` with options array | Client shows option buttons, selected option returned |
| 2.11 | `get_user_decision` — text | Send type `text` | Client shows text input, typed response returned |
| 2.12 | `get_user_decision` — diff | Send type `diff` with `{ filePath, before, after }` | Client shows diff viewer with approve/reject |
| 2.13 | `get_user_decision` — timeout | Set `timeoutSeconds: 5`, don't respond | Tool returns `defaultValue` after 5s, `timedOut: true` |
| 2.14 | `get_user_decision` — FIFO queue | Send two decisions rapidly | Client sees first, responds, then sees second |

### MCP Client Test Script

```js
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/index.js"],
  env: { AFK_PORT: "7843" },
});

const client = new Client({ name: "test", version: "1.0.0" });
await client.connect(transport);

const { tools } = await client.listTools();
console.log("Tools:", tools.map((t) => t.name));

const status = await client.callTool({ name: "get_afk_status", arguments: {} });
console.log("Status:", status.content);

await client.close();
```

---

## 3. WebSocket Connection

| # | Test | Method | Expected Result |
|---|------|--------|-----------------|
| 3.1 | Connect with valid token | Open WS to `ws://host:port/?token=<token>` | Connection opens, receives `connection_ack` with session ID |
| 3.2 | Connect with invalid token | Open WS with wrong token | Connection rejected with 401 |
| 3.3 | Connect without token | Open WS with no auth params | Connection rejected with 401 |
| 3.4 | Single-device enforcement | Connect second client while first is active | Second connection rejected with 409 |
| 3.5 | Reconnect ticket issued | Connect successfully | Receive `reconnect_ticket` message with ticket string and `expiresIn` |
| 3.6 | Reconnect with ticket | Disconnect, reconnect with `ws://host:port/?ticket=<ticket>` | Connection opens, new `connection_ack` + new ticket issued |
| 3.7 | Ticket rotation | Reconnect via ticket | Old ticket is invalidated, new ticket received |
| 3.8 | Expired ticket rejected | Wait >5 minutes, try reconnecting with old ticket | Connection rejected with 401 |
| 3.9 | Reused ticket rejected | Reconnect with ticket, then try same ticket again | Second attempt rejected with 401 |
| 3.10 | Keepalive ping | Wait 30+ seconds with connection open | Server sends WebSocket ping frames |

### Reconnect Ticket Test Script

```js
const WebSocket = require("ws");

// Step 1: Connect with token
const ws1 = new WebSocket("ws://localhost:7842/?token=<TOKEN>");
let ticket = null;

ws1.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type === "reconnect_ticket") {
    ticket = msg.ticket;
    ws1.close(); // Step 2: Disconnect
  }
});

ws1.on("close", () => {
  setTimeout(() => {
    // Step 3: Reconnect with ticket
    const ws2 = new WebSocket("ws://localhost:7842/?ticket=" + ticket);
    ws2.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "reconnect_ticket") {
        console.log("PASS — new ticket issued");
        ws2.close();

        // Step 4: Try old ticket (should fail)
        setTimeout(() => {
          const ws3 = new WebSocket("ws://localhost:7842/?ticket=" + ticket);
          ws3.on("error", () => console.log("PASS — old ticket rejected"));
        }, 500);
      }
    });
  }, 1000);
});
```

---

## 4. Web App UI

Open the app in a browser at `http://<ip>:7842/?token=<token>`.

| # | Test | Method | Expected Result |
|---|------|--------|-----------------|
| 4.1 | App loads | Navigate to URL | Page renders with "AFK Mode" heading, status bar shows "Connected" |
| 4.2 | Connection indicator | Check status bar | Green dot + "Connected" text, truncated session ID |
| 4.3 | Disconnected state | Stop server or navigate without token | Status bar shows "Disconnected" state |
| 4.4 | AFK toggle — on | Tap toggle switch | Switch becomes checked, server `afkMode` becomes `true` |
| 4.5 | AFK toggle — off | Tap toggle again | Switch unchecked, server `afkMode` becomes `false` |
| 4.6 | Progress feed renders | Send progress updates via MCP tool | Entries appear newest-first with correct icons: ℹ️ info, ✅ success, ❌ error, 🎯 milestone, ⚠️ warning |
| 4.7 | Progress bar | Send update with `progress` field | Bar renders with label and "current / total" text |
| 4.8 | Expandable details | Send update with `detail` field | Entry is expandable, shows detail text |
| 4.9 | Decision prompt — confirm | Trigger `get_user_decision` type `confirm` | Modal overlay appears with Yes/No buttons, countdown timer |
| 4.10 | Decision prompt — choice | Trigger with type `choice` and options | Modal shows option buttons |
| 4.11 | Decision prompt — text | Trigger with type `text` | Modal shows text input + submit |
| 4.12 | Decision prompt — diff | Trigger with type `diff` | Modal shows unified diff with red/green line coloring |
| 4.13 | Decision timeout countdown | Trigger with `timeoutSeconds: 30` | Countdown visible, progress bar drains |
| 4.14 | Tab navigation | Tap Dashboard / History / Settings | Correct panel renders for each tab |

---

## 5. History

| # | Test | Method | Expected Result |
|---|------|--------|-----------------|
| 5.1 | Entries persist | Receive progress updates, reload page | History tab shows previously received entries |
| 5.2 | Search | Type keyword in search box | List filters to matching entries |
| 5.3 | Category filter | Select a category filter | Only entries of that category shown |
| 5.4 | Clear history | Go to Settings, tap "Clear History" | History tab is empty, localStorage cleared |
| 5.5 | Max entries | Send 500+ progress updates | Only last 500 are retained in localStorage |

---

## 6. Settings

| # | Test | Method | Expected Result |
|---|------|--------|-----------------|
| 6.1 | Page renders | Navigate to Settings tab | Shows verbosity, sound, vibration, theme controls |
| 6.2 | Theme toggle | Switch between light/dark/system | App theme changes accordingly |
| 6.3 | Settings persist | Change settings, reload page | Settings are preserved |

---

## 7. Push Notifications

Requires VAPID keys: set `AFK_PUSH_VAPID_PUBLIC` and `AFK_PUSH_VAPID_PRIVATE` env vars.

| # | Test | Method | Expected Result |
|---|------|--------|-----------------|
| 7.1 | VAPID key endpoint | `curl http://localhost:7842/api/vapid-key` | Returns `{ "key": "<public-key>" }` |
| 7.2 | VAPID disabled | Start server without VAPID env vars | `/api/vapid-key` returns 404, push silently skipped |
| 7.3 | Browser subscribes | Load app with VAPID configured, grant notification permission | `pushManager.getSubscription()` returns FCM/push endpoint |
| 7.4 | Subscription sent to server | Check server session state after client connects | `pushSubscription` is set with `endpoint` and `keys` |
| 7.5 | Push delivery | Send push via `web-push` library with subscription | FCM returns 201, service worker receives push event |
| 7.6 | Notification shown | Send push while app is backgrounded (manual, real browser) | System notification appears with title and body |
| 7.7 | Notification click | Tap the notification (manual) | App window focuses or opens |

### Push Test Script

```js
const webPush = require("web-push");

webPush.setVapidDetails(
  "mailto:afk-mode@localhost",
  process.env.AFK_PUSH_VAPID_PUBLIC,
  process.env.AFK_PUSH_VAPID_PRIVATE
);

// Get subscription from browser: navigator.serviceWorker.ready
//   .then(r => r.pushManager.getSubscription())
//   .then(s => s.toJSON())
const subscription = {
  endpoint: "<FCM endpoint>",
  keys: { p256dh: "<key>", auth: "<key>" },
};

webPush
  .sendNotification(subscription, JSON.stringify({ title: "Test", body: "Hello" }))
  .then((res) => console.log("Status:", res.statusCode))
  .catch((err) => console.error("Failed:", err.message));
```

---

## 8. PWA

| # | Test | POV | Expected Result |
|---|------|-----|-----------------|
| 8.1 | Manifest linked | Browser DevTools → Application | Manifest loaded with name, icons, display: standalone |
| 8.2 | Service worker active | Browser DevTools → Application → Service Workers | SW registered and active |
| 8.3 | Install prompt (desktop) | Chrome address bar | Install icon appears, clicking installs standalone app |
| 8.4 | Add to Home Screen (mobile) | Chrome menu on Android | "Add to Home Screen" option available |
| 8.5 | Standalone mode | Open installed PWA | No browser chrome, app fills screen |
| 8.6 | Offline fallback | Disconnect network, reload | Cached page loads (or 503 "Offline" for uncached resources) |
| 8.7 | Cache update | Deploy new version, reload online | New assets fetched (network-first strategy) |

---

## 9. Security

| # | Test | Method | Expected Result |
|---|------|--------|-----------------|
| 9.1 | No token = no access | Navigate to `http://host:port/` without token | App loads but WS connection fails, shows disconnected |
| 9.2 | Invalid token rejected | WS connect with fabricated token | 401 Unauthorized |
| 9.3 | Token not reusable after connect | Connect client A, disconnect, try token with client B while A was `clientConnected` | Depends on state — token works only when `clientConnected` is false |
| 9.4 | Single device enforced | Two simultaneous WS connections | Second gets 409 Conflict |
| 9.5 | Ticket single-use | Use a reconnect ticket, try it again | Second attempt returns 401 |
| 9.6 | Ticket expires | Wait >5 minutes, use old ticket | Returns 401 |

---

## Test Results Summary

| Area | Total | Automated | Manual | Status |
|------|-------|-----------|--------|--------|
| Server Startup | 5 | 5 | 0 | ✅ Verified |
| MCP Tools | 14 | 14 | 0 | ✅ Verified |
| WebSocket | 10 | 9 | 1 (keepalive timing) | ✅ Verified |
| Web App UI | 14 | 14 (Playwright) | 0 | ✅ Verified |
| History | 5 | 3 | 2 | ✅ Verified |
| Settings | 3 | 1 | 2 | ✅ Verified |
| Push Notifications | 7 | 5 | 2 (notification shown/click) | ✅ Verified |
| PWA | 7 | 2 | 5 (install/offline/standalone) | ⚠️ Prerequisites verified |
| Security | 6 | 6 | 0 | ✅ Verified |
