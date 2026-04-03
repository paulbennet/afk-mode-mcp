# Architecture: How AFK Mode MCP Works

This document explains how AFK Mode is built — what runs where, how the pieces connect, and how data flows from VS Code Copilot to your phone and back.

## The Big Picture

AFK Mode is a **single Node.js process** that wears two hats at the same time:

1. **MCP Server** — communicates with VS Code Copilot over stdio (standard input/output), exposing tools that Copilot calls during agent sessions.
2. **Web App Server** — runs an Express HTTP server and a WebSocket server, serving a React PWA to your phone and maintaining a real-time connection with it.

Both roles start together and share the same in-memory session state. There is no database — everything lives in a single `Session` object for the lifetime of the process.

```
┌──────────────────┐        stdio         ┌─────────────────────────────────┐       WebSocket       ┌─────────────────┐
│   VS Code        │◄───────────────────►│   Node.js Process               │◄─────────────────────►│   Phone Browser  │
│   Copilot        │  (MCP protocol,     │                                 │  (real-time messages, │   (React PWA)    │
│   Agent Mode     │   JSON-RPC)         │   ┌───────────┐ ┌───────────┐  │   JSON over ws://)    │                  │
│                  │                     │   │ MCP Server│ │ HTTP + WS │  │                       │                  │
│                  │                     │   │ (stdio)   │ │ (Express) │  │       HTTP            │                  │
│                  │                     │   └─────┬─────┘ └─────┬─────┘  │◄─────────────────────►│                  │
│                  │                     │         │             │         │  (static files,       │                  │
│                  │                     │         └──────┬──────┘         │   VAPID key API)      │                  │
│                  │                     │                │                │                       │                  │
│                  │                     │      ┌─────────▼────────┐       │                       │                  │
│                  │                     │      │ Session (memory) │       │                       │                  │
│                  │                     │      └──────────────────┘       │                       │                  │
└──────────────────┘                     └─────────────────────────────────┘                       └─────────────────┘
```

## Startup Sequence

When VS Code spawns the MCP server (or you run `npx afk-mode-mcp`), the `main()` function in `src/server/index.ts` executes these steps in order:

1. **Initialize session** — creates a `Session` object with a random UUID (`sessionId`) and a 256-bit random token (`sessionToken`). AFK mode starts **off**.
2. **Generate VAPID keys** — creates an ephemeral key pair for Web Push notifications. These keys are thrown away when the process exits.
3. **Set up Express** — mounts the `/api/vapid-key` endpoint and serves the built React app as static files from `dist/webapp/`.
4. **Attach WebSocket** — hooks the `ws` library into the HTTP server's upgrade path for real-time communication.
5. **Register MCP tools** — defines the 4 tools (described below) on the MCP server instance.
6. **Start listening** — binds the HTTP server to the configured port (default `7842`) on the machine's LAN IP.
7. **Connect MCP transport** — opens the stdio transport so Copilot can start calling tools.

The server logs the connection URL (including the session token) to stderr, which is visible in VS Code's output panel.

There is also a `--setup` mode: running `npx afk-mode-mcp --setup` skips all of the above and instead writes `.vscode/mcp.json` and `.github/prompts/afk-workflow.prompt.md` to the current directory, then exits.

## The Four MCP Tools

These are the tools that Copilot's agent mode can call. They are defined in `src/server/mcp-tools.ts` using Zod schemas for input validation.

### `get_current_web_app_url`

**Purpose**: Give the user a way to connect their phone.

**Input**: None.

**What it does**:

1. Reads the session state for the `sessionId`.
2. Builds the connection URL: `http://<LAN-IP>:<port>/?token=<sessionToken>`.
3. Generates a QR code as a base64 PNG data-URI using the `qrcode` library.
4. Returns the URL, QR code (as Markdown image), and session ID.

**Output**: Copilot renders the QR code inline in the chat. The user scans it with their phone camera.

### `get_afk_status`

**Purpose**: Let Copilot check whether it should route through the phone or use normal chat.

**Input**: None.

**What it does**: Reads three values from the session — `afkMode`, `clientConnected`, and `sessionId`.

**Decision logic** (enforced by the `afk-workflow.prompt.md` system prompt):

- `afkMode: true` + `clientConnected: true` → route through MCP tools.
- `afkMode: true` + `clientConnected: false` → fall back to chat, warn user.
- `afkMode: false` → use normal VS Code chat.

### `notify_session_progress`

**Purpose**: Send a real-time progress update to the phone.

**Input** (Zod-validated):
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | string | yes | Session identifier |
| `summary` | string | yes | Short status line (≤120 chars recommended) |
| `detail` | string \| null | no | Extended explanation, stack traces |
| `category` | enum | yes | `info` · `warning` · `error` · `success` · `milestone` |
| `progress` | `{ current, total, label }` | no | For progress bars (e.g., "3 of 10 files") |
| `filesChanged` | string[] | no | Files created or modified |
| `toolsUsed` | string[] | no | Tools invoked in this step |

**What it does**:

1. Creates a `ProgressHistoryEntry` with a UUID and timestamp.
2. Appends the entry to `session.progressHistory` (the History tab reads this).
3. Sends a `progress_update` WebSocket message to the connected phone.
4. If category is `error` or `milestone`, also sends a **push notification** (so the phone alerts even when the browser tab is backgrounded).
5. Returns `{ delivered: true/false }` — false if no phone is connected.

### `get_user_decision`

**Purpose**: Ask the user a question on their phone and **block** until they answer (or timeout).

**Input** (Zod-validated):
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | string | yes | Session identifier |
| `prompt` | string | yes | The question to ask |
| `type` | enum | yes | `confirm` · `choice` · `text` · `diff` |
| `options` | string[] | no | For `choice` type — the options to pick from |
| `diff` | `{ filePath, before, after }` | no | For `diff` type — the code change to review |
| `defaultValue` | string \| null | no | Used if timeout fires (so work can continue) |
| `timeoutSeconds` | number | no | Default 300 (5 minutes) |

**What it does**:

1. Creates a `Promise` that resolves when the user responds or the timer fires.
2. Stores the promise's `resolve` callback and a `setTimeout` handle in `session.pendingDecisions`.
3. Sends a `decision_request` WebSocket message to the phone (queued if another decision is already showing — the phone shows only one at a time, FIFO order).
4. Sends a push notification: "🔔 Decision Needed".
5. **Blocks the MCP tool call** until one of:
   - The user taps a response → the WebSocket handler calls `resolvePendingDecision()` → returns `{ decision: "...", timedOut: false }`.
   - The timer fires → returns `{ decision: defaultValue, timedOut: true }`.

This blocking behavior is what makes AFK Mode powerful — Copilot's agent naturally pauses at `get_user_decision` and resumes when the phone responds.

## WebSocket Protocol

The WebSocket server (`src/server/websocket.ts`) is the real-time backbone connecting the server to the phone.

### Connection Flow

```
Phone                                          Server
  │                                              │
  │  1. HTTP Upgrade: ws://host:port/?token=xxx  │
  │─────────────────────────────────────────────►│
  │                                              │  2. Validate token (or reconnect ticket)
  │                                              │  3. Check no other device connected
  │                                              │
  │  4. connection_ack { sessionId, afkMode }    │
  │◄─────────────────────────────────────────────│
  │                                              │
  │  5. reconnect_ticket { ticket, expiresIn }   │
  │◄─────────────────────────────────────────────│
  │                                              │
  │  ═══════ Connection established ═══════      │
  │                                              │
  │  6. progress_update { ... }                  │  (when Copilot calls notify_session_progress)
  │◄─────────────────────────────────────────────│
  │                                              │
  │  7. decision_request { ... }                 │  (when Copilot calls get_user_decision)
  │◄─────────────────────────────────────────────│
  │                                              │
  │  8. decision_response { id, decision }       │  (user taps answer)
  │─────────────────────────────────────────────►│
  │                                              │  9. Resolve pending promise → unblock tool
  │                                              │
  │  10. set_afk_status { afkMode: true/false }  │  (user toggles AFK switch)
  │─────────────────────────────────────────────►│
  │                                              │
  │  11. push_subscription { subscription }      │  (browser Push API subscription)
  │─────────────────────────────────────────────►│
  │                                              │
  │  12. ping                                    │  (client keepalive)
  │─────────────────────────────────────────────►│
  │  13. pong                                    │
  │◄─────────────────────────────────────────────│
```

### Message Types

**Server → Client** (`ServerMessage`):

| Type               | When Sent                                           | Key Fields                                                                                |
| ------------------ | --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `connection_ack`   | On connection                                       | `sessionId`, `afkMode`                                                                    |
| `reconnect_ticket` | Immediately on connection, then renewed every 4 min | `ticket`, `expiresIn`                                                                     |
| `progress_update`  | Copilot calls `notify_session_progress`             | `summary`, `category`, `progress`, etc.                                                   |
| `decision_request` | Copilot calls `get_user_decision`                   | `prompt`, `decisionType` (maps to tool input `type`), `options`, `diff`, `timeoutSeconds` |

**Client → Server** (`ClientMessage`):

| Type                | When Sent                   | Key Fields                       |
| ------------------- | --------------------------- | -------------------------------- |
| `set_afk_status`    | User toggles AFK switch     | `afkMode`                        |
| `decision_response` | User answers a decision     | `id`, `decision`                 |
| `push_subscription` | Browser Push API subscribes | `subscription` (endpoint + keys) |
| `ping`              | Client keepalive            | (none)                           |

### Authentication

WebSocket connections are authenticated during the HTTP upgrade handshake:

1. **Initial connection**: the phone includes `?token=<sessionToken>` in the URL. The server compares this against the session's stored token.
2. **Reconnection**: if the phone loses network briefly, it uses `?ticket=<reconnectTicket>` instead. Tickets are one-time use and expire after 5 minutes.

If neither token nor ticket is valid, the server responds with `401 Unauthorized` and destroys the socket.

### Single-Device Enforcement

Only one phone can be connected at a time. If a second phone tries to connect while one is already active:

1. The server checks if the existing socket is truly alive (readyState is OPEN and it responded to the last ping).
2. If the existing socket is stale (missed a pong), it's terminated and the new connection is accepted.
3. If the existing socket is healthy, the new connection is rejected with `409 Conflict`.

### Keepalive

There are two keepalive mechanisms — one at the WebSocket protocol level (for server-side liveness detection) and one at the application level (for client-side liveness detection):

**Server-side (protocol-level)**: The server sends a WebSocket `ping` frame every **30 seconds**. The browser responds with a `pong` frame automatically (built into the WebSocket spec). The server tracks liveness with an `isSocketAlive` flag — if it's still false at the next ping cycle (meaning the client missed a pong), the connection is terminated as stale.

**Client-side (application-level)**: The client can send a `{ type: "ping" }` JSON message over the WebSocket. The server responds with `{ type: "pong" }`. This lets the client verify the server is still reachable.

### Decision Queue

Decisions are delivered one at a time (FIFO):

1. When `get_user_decision` is called, the `decision_request` message is pushed onto `decisionSendQueue`.
2. If no decision is currently being shown (i.e., `currentDecisionId` is null), the message is sent immediately.
3. When the user responds (or the decision times out), the queue advances to the next item.

This prevents the phone from being overwhelmed with multiple prompts at once.

### Reconnect Tickets

To handle brief network drops (e.g., switching from Wi-Fi to cellular):

1. On every new connection, the server generates a 256-bit random ticket and sends it as a `reconnect_ticket` message.
2. The ticket is renewed every **4 minutes** (before the 5-minute expiry) as long as the connection stays open.
3. If the connection drops, the client stores the last ticket and attempts to reconnect with `?ticket=<ticket>`.
4. On reconnection, the ticket is consumed (invalidated) and a new one is issued.
5. If the ticket has expired (>5 min), the client must use the original session token.

## Session State

All state lives in a single in-memory `Session` object (`src/server/session.ts`). There is no database — restarting the server loses all state.

```typescript
interface Session {
  sessionId: string; // UUID, identifies this session
  sessionToken: string; // 256-bit base64url token for auth
  afkMode: boolean; // Is AFK mode toggled on?
  clientConnected: boolean; // Is a phone currently connected via WebSocket?
  progressHistory: ProgressHistoryEntry[]; // All progress updates (for the History tab)
  pendingDecisions: Map<string, PendingDecision>; // Active decision promises waiting for response
  pushSubscription: PushSubscriptionData | null; // Browser push endpoint + keys
  reconnectTicket: string | null; // Current one-time reconnect ticket
  reconnectTicketExpiry: number | null; // When the ticket expires (epoch ms)
}
```

Key operations:

- `initSession()` — called once at startup, creates the session with random IDs.
- `addProgressEntry()` — appends to `progressHistory` (the History tab displays this list).
- `addPendingDecision()` — stores a promise's `resolve` callback so the WebSocket handler can resolve it when the user responds.
- `resolvePendingDecision(id, decision)` — clears the timeout, removes the entry, calls `resolve()` to unblock the MCP tool.
- `generateReconnectTicket()` / `consumeReconnectTicket()` — manage the rotating reconnect ticket.

## Push Notifications

Push notifications use the **Web Push** standard with **VAPID** (Voluntary Application Server Identification). No Google account, Firebase, or API keys are needed.

### Flow

```
Phone Browser                          Server                              Push Service
     │                                    │                                 (FCM/Mozilla/Apple)
     │  1. GET /api/vapid-key             │                                      │
     │───────────────────────────────────►│                                      │
     │  2. { key: "BPub..." }            │                                      │
     │◄───────────────────────────────────│                                      │
     │                                    │                                      │
     │  3. navigator.serviceWorker        │                                      │
     │     .pushManager.subscribe()       │                                      │
     │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─►│
     │  4. PushSubscription { endpoint }  │                                      │
     │◄ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│
     │                                    │                                      │
     │  5. WS: push_subscription { ... }  │                                      │
     │───────────────────────────────────►│  6. Store subscription in session    │
     │                                    │                                      │
     │        (later, on error/milestone) │                                      │
     │                                    │  7. webPush.sendNotification()       │
     │                                    │─────────────────────────────────────►│
     │                                    │                                      │  8. Deliver push
     │  9. Service Worker: push event     │                                      │     to browser
     │◄ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│
     │  10. Show system notification      │                                      │
```

VAPID keys are generated fresh each time the server starts. Since push subscriptions are in-memory too, everything is ephemeral and isolated per developer — no shared secrets, no cross-talk.

Push notifications are sent automatically for:

- **Error** progress updates (`category: "error"`)
- **Milestone** progress updates (`category: "milestone"`)
- **Decision requests** (every `get_user_decision` call)

## Web App (React PWA)

The React app (`src/webapp/`) is built with Vite and served as static files by the Express server. It is a Progressive Web App — installable to the home screen, with a service worker for offline caching.

### Component Tree

```
main.tsx
  └─ WebSocketProvider (useWebSocket.tsx)
       └─ App.tsx
            ├─ StatusBar — connection indicator (✅ connected / ❌ disconnected)
            ├─ DecisionPrompt — modal overlay when a decision is active
            └─ Bottom Tabs
                 ├─ Dashboard — AFK toggle + live progress feed
                 │    └─ ProgressEntry — individual update cards
                 ├─ SessionHistory — searchable/filterable history log
                 │    └─ ProgressEntry — reused for history entries
                 └─ Settings — verbosity, sound, vibration, theme, notifications
```

### How the App Connects

1. The user opens the URL (from QR code): `http://<IP>:<port>/?token=<token>`.
2. `main.tsx` creates the React root and wraps the app in `WebSocketProvider`.
3. `useWebSocket` extracts the `token` from the URL query string.
4. It opens a WebSocket to `ws://<host>:<port>/?token=<token>`.
5. On `connection_ack`, it stores the `sessionId` and `afkMode` in React state.
6. On `reconnect_ticket`, it stores the ticket for later reconnection.
7. The app is now live — progress updates and decision requests flow in real time.

### Decision UI

When a `decision_request` arrives:

1. `useWebSocket` sets `pendingDecision` in context.
2. `DecisionPrompt` renders as a modal overlay with a countdown timer.
3. The phone vibrates (if enabled in settings).
4. Based on `decisionType`:
   - **confirm** → Yes/No buttons
   - **choice** → tappable option cards
   - **text** → text input field + Submit
   - **diff** → `DiffViewer` component (unified diff with green/red syntax coloring) + Approve/Reject
5. The user taps their answer → `respondToDecision(id, answer)` sends a `decision_response` message over WebSocket.
6. The server receives it, resolves the pending promise, and the MCP tool returns to Copilot.

### Service Worker

The service worker (`src/webapp/sw.ts`) provides two capabilities:

1. **Offline caching** — network-first strategy. It tries the network first, caches a copy of successful responses, and falls back to cache if the network is unavailable.
2. **Push notifications** — listens for `push` events, parses the JSON payload (`{ title, body }`), and shows a system notification. Tapping the notification focuses or opens the app.

## Security Model

| Layer                      | Mechanism                                                     |
| -------------------------- | ------------------------------------------------------------- |
| **Session authentication** | 256-bit random base64url token, generated per server instance |
| **WebSocket auth**         | Token in URL query param (`?token=`) for initial connection   |
| **Reconnection auth**      | One-time rotating tickets (`?ticket=`), 5-min expiry          |
| **Single device**          | Only one active WebSocket allowed; second connection gets 409 |
| **Stale detection**        | Ping/pong every 30s; missed pong = connection terminated      |
| **Push isolation**         | Ephemeral VAPID keys per session; no shared secrets           |
| **Network scope**          | Server binds to LAN IP; not exposed to the internet           |
| **Input validation**       | All MCP tool inputs validated with Zod schemas                |

## Data Flow: End-to-End Example

Here is what happens when Copilot sends a progress update while you're away from your desk:

```
1. Copilot calls `notify_session_progress` with { summary: "Tests passing: 8/12", category: "info", progress: { current: 8, total: 12, label: "Tests" } }
      │
      ▼
2. MCP tool handler (mcp-tools.ts):
   - Creates a ProgressHistoryEntry with UUID + timestamp
   - Appends to session.progressHistory
   - Calls sendProgressUpdate() on the WebSocket module
      │
      ▼
3. WebSocket module (websocket.ts):
   - Checks if activeSocket exists and is OPEN
   - Sends JSON message: { type: "progress_update", id: "...", summary: "Tests passing: 8/12", ... }
      │
      ▼
4. Phone receives WebSocket message:
   - useWebSocket hook parses the message
   - Adds to progressUpdates state array
   - React re-renders Dashboard
      │
      ▼
5. Dashboard.tsx displays a new ProgressEntry card:
   - ℹ️ icon (info category)
   - "Tests passing: 8/12" summary
   - Progress bar: 8/12 (66%)
   - "just now" timestamp
      │
      ▼
6. MCP tool returns { delivered: true } to Copilot
   - Copilot continues working
```

And here is a decision flow:

```
1. Copilot calls `get_user_decision` with { prompt: "Delete unused test fixtures?", type: "confirm", defaultValue: "no", timeoutSeconds: 120 }
      │
      ▼
2. MCP tool handler creates a Promise and stores resolve() in session.pendingDecisions
   Tool call is now BLOCKED — Copilot waits
      │
      ▼
3. WebSocket sends decision_request to phone
   Push notification sent: "🔔 Decision Needed"
      │
      ▼
4. Phone shows DecisionPrompt modal:
   - "Delete unused test fixtures?"
   - [Yes] [No] buttons
   - Countdown: 120 seconds
   - Phone vibrates
      │
      ▼
5. User taps [Yes]
   Phone sends: { type: "decision_response", id: "...", decision: "yes" }
      │
      ▼
6. WebSocket handler calls resolvePendingDecision("...", "yes")
   - Clears timeout
   - Removes from pendingDecisions map
   - Calls resolve({ decision: "yes", timedOut: false })
      │
      ▼
7. Promise resolves → MCP tool returns { decision: "yes", timedOut: false }
   Copilot resumes and deletes the fixtures
```

## File Map

```
src/
├── server/
│   ├── index.ts          Entry point: HTTP server, MCP server, startup orchestration
│   ├── mcp-tools.ts      4 MCP tool definitions with Zod schemas
│   ├── session.ts        In-memory session state (singleton)
│   ├── websocket.ts      WebSocket server, auth, keepalive, decision queue
│   ├── push.ts           VAPID key generation + push notification sending
│   ├── qr.ts             QR code generation (data-URI PNG)
│   └── setup.ts          --setup CLI: writes .vscode/mcp.json + prompt file
├── webapp/
│   ├── main.tsx          React entry point, service worker registration
│   ├── App.tsx           Root component: tabs, theme, auth gate
│   ├── theme.ts          MUI theme (light/dark, Tailwind-inspired palette)
│   ├── sw.ts             Service worker: caching + push notification display
│   ├── styles/
│   │   └── globals.css   Base styles
│   ├── components/
│   │   ├── Dashboard.tsx       AFK toggle + live progress feed
│   │   ├── ProgressEntry.tsx   Individual progress update card
│   │   ├── DecisionPrompt.tsx  Modal decision UI with countdown timer
│   │   ├── DiffViewer.tsx      Unified diff renderer (green/red coloring)
│   │   ├── SessionHistory.tsx  Searchable/filterable history log
│   │   ├── Settings.tsx        Verbosity, sound, vibration, theme, push
│   │   └── StatusBar.tsx       Connection indicator
│   └── hooks/
│       ├── useWebSocket.tsx    WebSocket client + React context provider
│       └── useNotifications.ts Audio/vibration on decision requests
└── shared/
    └── types.ts          TypeScript interfaces shared between server and webapp
```
