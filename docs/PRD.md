# VSCode Copilot — AFK Mode

## 1. Problem Statement

When GitHub Copilot's agent mode runs long-running tasks (multi-file refactors, test suites, complex scaffolding), it frequently pauses to ask for user confirmation or input. If the user steps away from their desk, the session stalls until they return. There is no way to monitor progress or respond to Copilot prompts from a mobile device.

**AFK Mode** solves this by bridging VS Code Copilot and a mobile-optimized web app through an MCP server, so users can monitor progress, receive notifications, and respond to Copilot's questions from their phone.

---

## 2. Solution Overview

AFK Mode is a **single Node.js process** that serves two roles simultaneously from the moment it starts:

1. **MCP Server** (stdio) — Exposes tools that Copilot calls during agent sessions to report progress and request decisions.
2. **Web App Server** (HTTP + WebSocket) — Automatically starts alongside the MCP server. Serves a React-based mobile-optimized web app and maintains a real-time WebSocket connection with the user's phone.

The web server is **always running** while the MCP server is alive — there is no separate "start/stop" lifecycle. AFK mode is a **toggle in the web app** that the user controls from their phone. Copilot checks the AFK status before deciding whether to route interactions through the MCP tools or handle them natively in the chat panel.

```
┌──────────────┐      stdio       ┌───────────────────────────────┐     WebSocket      ┌────────────────┐
│  VS Code     │◄────────────────►│    MCP + Web Server           │◄──────────────────►│  Mobile Web    │
│  Copilot     │                  │    (single Node.js process)   │     HTTP (static)  │  App (React)   │
│  Agent Mode  │                  │                               │◄──────────────────►│  PWA           │
└──────────────┘                  └───────────────────────────────┘                    └────────────────┘
       │                                    │                                        │
       │  1. Copilot calls get_afk_status   │  2. Server pushes to WebSocket         │  5. User toggles
       │  2. If AFK → route via MCP tools   │  3. User responds on phone             │     AFK on/off
       │  (notify_session_progress,         │  4. Server returns response to tool    │     in web app
       │   get_user_decision)               │                                        │
       │                                    │                                        │
```

---

## 3. User Flow

### 3.1 Connecting the Mobile Web App

1. The MCP server process starts (VS Code spawns it). The HTTP/WebSocket server starts **automatically** on a local port. A unique **session token** is generated for this server instance.
2. User asks Copilot something like **"Show me the AFK app link"** or **"How do I connect my phone?"**.
3. Copilot calls the `get_current_web_app_url` MCP tool.
4. The tool returns a **connection URL** (with embedded session token) and a **QR code** (as a base64 data-URI image in Markdown).
5. Copilot renders the QR code and clickable URL in the chat panel.
6. User scans the QR code (or opens the URL) on their phone → mobile browser loads the web app.
7. The web app establishes a WebSocket connection using the session token from the URL.
8. The phone is now **paired** — the user sees the Dashboard with AFK mode **off** by default.

### 3.2 Activating AFK Mode

1. User taps the **AFK Mode toggle** in the web app → AFK mode is now **on**.
2. The server records the AFK status in session state.
3. When Copilot next needs to report progress or request a decision, it calls `get_afk_status`.
4. If AFK is on → Copilot routes the interaction through `notify_session_progress` / `get_user_decision` MCP tools.
5. If AFK is off → Copilot interacts with the user natively in the VS Code chat panel as usual.

### 3.3 During AFK Mode

- Copilot continues working and periodically calls `notify_session_progress` → user sees live updates on their phone.
- When Copilot needs input, it calls `get_user_decision` → user gets a notification/prompt on their phone, responds, and Copilot continues.
- If the user returns to their desk and wants to switch back, they tap the AFK toggle **off** in the web app. Copilot's next `get_afk_status` call will see AFK is off and resume native chat interaction.

### 3.4 Deactivating AFK Mode

1. User taps the **AFK Mode toggle** off in the web app.
2. AFK status is updated in server session state.
3. Copilot continues normally — any pending `get_user_decision` calls that are still blocking will continue to wait for a response (the user can still respond from the web app even when AFK is off).
4. The web server remains running for the lifetime of the MCP server process. The user can re-enable AFK at any time.

---

## 4. MCP Tool Specifications

### 4.1 `get_current_web_app_url`

Returns the connection URL and QR code for the already-running web app. Can be called at any time — the server is always running.

| Field            | Value                                                              |
| ---------------- | ------------------------------------------------------------------ |
| **Trigger**      | User asks Copilot for the AFK app link / QR code                   |
| **Input**        | `{}` (no parameters)                                               |
| **Behavior**     | Returns the current web app URL (with session token) and a QR code |
| **Output**       | `{ url: string, qrCodeMarkdown: string, sessionId: string }`       |
| **Side effects** | None — web server is already running                               |

### 4.2 `get_afk_status`

Returns the current AFK mode status. Copilot should call this before deciding whether to route interactions through MCP tools or handle them natively in chat.

| Field        | Value                                                                                  |
| ------------ | -------------------------------------------------------------------------------------- |
| **Trigger**  | Copilot needs to know whether to use MCP tools or native chat for the next interaction |
| **Input**    | `{}` (no parameters)                                                                   |
| **Behavior** | Returns the AFK toggle state and whether a mobile client is connected                  |
| **Output**   | `{ afkMode: boolean, clientConnected: boolean, sessionId: string }`                    |

> **Copilot behavior based on response:**
>
> - `afkMode: true` + `clientConnected: true` → Route through `notify_session_progress` / `get_user_decision`.
> - `afkMode: true` + `clientConnected: false` → AFK is on but nobody is listening. Copilot should fall back to native chat and warn the user.
> - `afkMode: false` → Use native VS Code chat panel as usual.

### 4.3 `notify_session_progress`

Sends a progress update to the connected mobile client. Returns immediately (fire-and-forget from Copilot's perspective).

| Field        | Value                                                     |
| ------------ | --------------------------------------------------------- |
| **Trigger**  | Copilot wants to report progress during a long task       |
| **Input**    | See schema below                                          |
| **Behavior** | Push update to WebSocket client; store in session history |
| **Output**   | `{ delivered: boolean }`                                  |

**Input Schema:**

```jsonc
{
  "sessionId": "string",
  "summary": "string", // Short human-readable summary (always present)
  "detail": "string | null", // Extended detail (shown when verbosity = detailed)
  "category": "info | warning | error | success | milestone",
  "progress": {
    // Optional structured progress
    "current": 3,
    "total": 5,
    "label": "Refactoring services",
  },
  "filesChanged": ["string"], // Optional list of files touched
  "toolsUsed": ["string"], // Optional list of tools Copilot called
}
```

### 4.4 `get_user_decision`

Sends a decision request to the mobile client and **blocks** until the user responds or the timeout expires. This is the core interaction tool.

| Field        | Value                                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| **Trigger**  | Copilot needs user confirmation or input to continue                                                        |
| **Input**    | See schema below                                                                                            |
| **Behavior** | Push decision request to WebSocket; hold the MCP tool call open; return when user responds or timeout fires |
| **Output**   | `{ decision: string, timedOut: boolean }`                                                                   |

**Input Schema:**

```jsonc
{
  "sessionId": "string",
  "prompt": "string",                    // The question for the user
  "type": "confirm | choice | text | diff",
  "options": ["string"] | null,         // For "choice" type: list of options
  "diff": {                             // For "diff" type
    "filePath": "string",
    "before": "string",
    "after": "string"
  },
  "defaultValue": "string | null",      // Used if timeout fires
  "timeoutSeconds": 300                  // Default: 5 minutes
}
```

**Decision Types:**

| Type      | Mobile UI                                                     | Response Format              |
| --------- | ------------------------------------------------------------- | ---------------------------- |
| `confirm` | Yes / No buttons                                              | `"yes"` or `"no"`            |
| `choice`  | Radio buttons or tappable cards                               | The selected option string   |
| `text`    | Text input field + submit                                     | Free-text string             |
| `diff`    | Side-by-side or unified diff view with Approve/Reject buttons | `"approved"` or `"rejected"` |

**Timeout Behavior:**

- When `timeoutSeconds` elapses with no user response, the tool returns `{ decision: defaultValue, timedOut: true }`.
- If no `defaultValue` is set and timeout fires, returns `{ decision: null, timedOut: true }` — Copilot should handle this gracefully (e.g., skip the step or ask again later).

---

## 5. Web App Specification

### 5.1 Tech Stack

| Layer         | Choice                                               |
| ------------- | ---------------------------------------------------- |
| Framework     | React 19                                             |
| Bundler       | Vite                                                 |
| Styling       | MUI (Material UI) 7 + Emotion                        |
| Real-time     | Native WebSocket API                                 |
| Notifications | Web Push API (via service worker)                    |
| QR Generation | `qrcode` npm package (server-side, returns data-URI) |
| PWA           | Service worker + `manifest.json` for installability  |

### 5.2 Screens

#### Connection Screen

- Shown when the user opens the URL from the QR code.
- Displays "Connecting..." spinner → transitions to Dashboard on successful WebSocket handshake.
- If connection fails, shows retry button and manual IP/port entry.

#### Dashboard

- **AFK Mode Toggle**: Prominent switch at the top. Off by default. When toggled on, a visual indicator (pulsing dot, color shift) confirms AFK mode is active. Toggling it sends an immediate WebSocket message to the server updating the AFK status.
- **Status Bar**: Green dot = connected, AFK on/off indicator, session ID, time elapsed.
- **Progress Feed**: Scrollable timeline of progress notifications (newest at top).
  - Each entry shows: timestamp, category icon, summary, and expandable detail.
  - Milestone entries are visually emphasized.
  - Error entries shown in red with detail expanded by default.
- **Notification Sound**: Configurable chime on new updates (can be muted).

#### Decision Prompt (Modal Overlay)

- Appears over the Dashboard when a decision is requested.
- Shows the prompt text prominently.
- Renders the appropriate input control based on `type`:
  - **confirm**: Two large tap-friendly buttons (Yes / No).
  - **choice**: List of tappable option cards.
  - **text**: Text area with submit button.
  - **diff**: Syntax-highlighted diff viewer (unified format for mobile) with Approve / Reject buttons.
- Shows a **countdown timer** for the timeout.
- Plays a distinct notification sound + vibration when a decision is needed.

#### Session History

- Searchable/filterable log of all progress updates and decisions for the current session.
- Persisted in `localStorage` so it survives page refreshes.

#### Settings

- **Verbosity**: Simple (summary only) / Detailed (summary + detail + files + tools).
- **Sound**: On / Off, volume slider.
- **Vibration**: On / Off.
- **Theme**: Light / Dark / System.

### 5.3 PWA Capabilities

- `manifest.json` for "Add to Home Screen" on mobile.
- Service worker for:
  - Caching static assets (offline shell).
  - Web Push notifications (user can receive notifications even when the browser tab is in the background).
- Push notification flow:
  1. On first connect, web app requests notification permission.
  2. Subscribes to push via the Push API; sends subscription to MCP server.
  3. MCP server stores the subscription; sends push messages for new decisions/critical progress.
  4. Tapping a push notification opens/focuses the web app.

---

## 6. Authentication & Pairing

### 6.1 QR Code Flow

```
VS Code Chat Panel                     Mobile Phone
─────────────────                      ────────────
  ┌─────────────────────┐
  │  [QR Code Image]    │
  │                     │  ──scan──►   Browser opens:
  │  http://192.168.x   │             http://192.168.1.5:7842/?token=a3f9...
  │  :7842/?token=a3f9… │
  └─────────────────────┘              WebSocket connects with token
                                       ◄── Server validates token ──►
                                       Session paired ✓
                                       User sees Dashboard (AFK off)
                                       User taps AFK toggle → AFK on ✓
```

### 6.2 Security Model (Local Network MVP)

| Concern             | Mitigation                                                                                                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unauthorized access | Session token is a cryptographically random 256-bit value (Base64url-encoded). Required on WebSocket handshake.                                                            |
| Token leakage       | Token is embedded in the URL fragment (not sent to server in HTTP requests). Expires when the MCP server process exits. Single-use: only one client can connect per token. |
| Cross-origin        | CORS restricted to the local network IP.                                                                                                                                   |
| WebSocket hijacking | Token validated on `upgrade` request before completing handshake.                                                                                                          |
| Replay attack       | Token invalidated after first successful connection. Reconnects use a short-lived rotating ticket issued over the WebSocket.                                               |

---

## 7. Configuration

The MCP server accepts configuration via its MCP server definition in VS Code settings (`.vscode/mcp.json` or user settings):

```jsonc
{
  "servers": {
    "afk-mode-mcp": {
      "type": "stdio",
      "command": "node",
      "args": ["path/to/afk-mode-mcp/dist/server.js"],
      "env": {
        "AFK_PORT": "7842", // Web server port (default: auto)
        "AFK_DEFAULT_TIMEOUT": "300", // Default decision timeout in seconds
        "AFK_VERBOSITY": "simple", // Default verbosity: "simple" | "detailed"
        "AFK_PUSH_VAPID_PUBLIC": "...", // VAPID key for push notifications
        "AFK_PUSH_VAPID_PRIVATE": "...", // VAPID private key
      },
    },
  },
}
```

---

## 8. Project Structure

```
afk-mode-mcp/
├── package.json
├── tsconfig.json
├── vite.config.ts                  # Builds the React web app
│
├── src/
│   ├── server/                     # MCP server + web server (Node.js)
│   │   ├── index.ts                # Entry point: stdio MCP + HTTP/WS server
│   │   ├── mcp-tools.ts            # Tool definitions & handlers
│   │   ├── session.ts              # Session state management
│   │   ├── websocket.ts            # WebSocket server logic
│   │   ├── push.ts                 # Web Push notification sending
│   │   └── qr.ts                   # QR code generation
│   │
│   └── webapp/                     # React web app (Vite + MUI)
│       ├── index.html
│       ├── main.tsx                # React entry point
│       ├── App.tsx                 # Router / layout
│       ├── hooks/
│       │   ├── useWebSocket.ts     # WebSocket connection hook
│       │   └── useNotifications.ts # Push notification hook
│       ├── components/
│       │   ├── Dashboard.tsx       # Progress feed
│       │   ├── DecisionPrompt.tsx  # Modal for user decisions
│       │   ├── DiffViewer.tsx      # Diff rendering for "diff" type
│       │   ├── ProgressEntry.tsx   # Single progress item
│       │   ├── SessionHistory.tsx  # Searchable log
│       │   ├── Settings.tsx        # Preferences
│       │   └── StatusBar.tsx       # Connection status
│       ├── styles/
│       │   └── globals.css         # Base styles
│       ├── sw.ts                   # Service worker (push + cache)
│       └── manifest.json           # PWA manifest
│
├── dist/                           # Build output
│   ├── server.js                   # Compiled MCP server
│   └── webapp/                     # Built static files (served by server)
│
└── docs/
    └── PRD.md                      # This document
```

---

## 9. MVP Scope

### In Scope (v1)

| Feature                                                                                                | Notes                                  |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| MCP tools: `get_current_web_app_url`, `get_afk_status`, `notify_session_progress`, `get_user_decision` | Core functionality                     |
| Web app: Dashboard, Decision Prompt, Session History, Settings                                         | Full mobile-optimized UI               |
| QR code pairing                                                                                        | Scan to connect                        |
| WebSocket real-time updates                                                                            | Primary communication channel          |
| All decision types: confirm, choice, text, diff                                                        | Full decision support                  |
| Timeout with default                                                                                   | Auto-resolve when user doesn't respond |
| Configurable verbosity                                                                                 | Simple / Detailed                      |
| Push notifications                                                                                     | Via Service Worker + Web Push API      |
| Notification sounds + vibration                                                                        | Configurable                           |
| PWA (installable)                                                                                      | Add to home screen                     |
| Session history (localStorage)                                                                         | Survives page refresh                  |
| Local network connectivity                                                                             | Phone on same WiFi as dev machine      |
| Security: token-based auth, single-use token, CORS                                                     | See §6.2                               |

### Deferred (v2+)

| Feature                                      | Notes                                                                   |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| Tunnel / remote access                       | ngrok-style or VS Code port forwarding for access outside local network |
| Multi-session support                        | Monitor multiple VS Code instances from one web app                     |
| Auto AFK detection (idle)                    | Trigger AFK mode when VS Code is idle for N minutes                     |
| Session persistence across restarts          | Resume if MCP server crashes                                            |
| Rich media in progress (screenshots, charts) | Beyond text + file lists                                                |
| Native mobile app                            | If PWA limitations become blocking                                      |

---

## 10. Non-Functional Requirements

| Requirement                        | Target                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------- |
| WebSocket latency (LAN)            | < 50ms round-trip                                                      |
| Decision timeout accuracy          | ± 1 second                                                             |
| Web app initial load (LAN)         | < 2 seconds                                                            |
| Concurrent connections per session | 1 (single paired device)                                               |
| Session history retention          | Current session only (localStorage)                                    |
| Accessibility                      | WCAG 2.1 AA (contrast, touch targets ≥ 44px, screen reader labels)     |
| Browser support                    | Safari iOS 16+, Chrome Android 100+, Chrome/Edge desktop (for testing) |

---

## 11. Key Technical Decisions

### Why a single process?

The MCP server must communicate with VS Code via **stdio** (VS Code spawns the process). Running the HTTP/WebSocket server in the same process avoids IPC complexity and keeps deployment simple — one `node` command in the MCP config.

### Why does `get_user_decision` block?

MCP tools are request/response from the LLM's perspective. Copilot calls the tool and waits for a result. The MCP server holds the tool call open (via a Promise that resolves when the WebSocket receives the user's response or timeout fires). This is the simplest way to bridge async human input into the synchronous tool-call model.

### Why QR code over account-based auth?

For a local-network MVP, QR code pairing is zero-config: no accounts, no cloud services, no OAuth flows. The session token in the URL is sufficient for single-session security. Account-based auth can be layered on when tunnel/remote support is added.

### Why React?

User preference. Additionally: large ecosystem, strong PWA tooling, good mobile performance with modern React + Vite, and broad developer familiarity.

---

## 12. Open Questions

1. **Port conflicts**: Should the server try a list of fallback ports, or fail and ask the user to specify one?
2. **Multiple browser tabs**: If the user opens the URL in two tabs, should the second one be rejected, or should both receive updates (with only one able to respond to decisions)?
3. **Copilot integration instruction**: Should the project ship a `.github/copilot-instructions.md` that tells Copilot _when and how_ to call the AFK tools (e.g., "Before any long-running task, call `get_afk_status` to decide whether to route interactions through AFK MCP tools or native chat")?
4. **Decision queueing**: If Copilot sends multiple `get_user_decision` calls concurrently (unlikely but possible), should they queue on the mobile UI or reject the second call?
5. **AFK status polling frequency**: Should Copilot call `get_afk_status` before every interaction, or cache the result and re-check periodically? The tool description should guide this behavior.
6. **Progress updates when AFK is off**: Should `notify_session_progress` still deliver to the web app when AFK mode is off (for passive monitoring), or should Copilot skip calling it entirely?
