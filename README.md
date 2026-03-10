# AFK Mode

**Monitor and respond to VS Code Copilot from your phone.**

When Copilot's agent mode runs long tasks, it frequently pauses for user input. If you step away, the session stalls. AFK Mode bridges Copilot and your phone through an MCP server — so you can watch progress, get notifications, and respond to prompts without being at your desk.

## Quick Start

### One-command setup

Run this in your project folder:

```bash
npx afk-mode --setup
```

This creates `.vscode/mcp.json` — done. Copilot will start AFK Mode automatically when it needs it.

### Usage

1. Ask Copilot: _"Show me the AFK app link"_ → scan the QR code on your phone
2. Toggle **AFK Mode on** in the app
3. Walk away — Copilot sends progress and prompts to your phone

### Want push notifications?

```bash
npx afk-mode --setup --vapid
```

This generates VAPID keys and configures push notifications so your phone gets alerts even when the browser tab is in the background.

### Manual setup (alternative)

If you prefer to configure manually, add this to `.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "afk-mode": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "afk-mode"],
      "env": {
        "AFK_PORT": "7842"
      }
    }
  }
}
```

## How It Works

AFK Mode is a single Node.js process that serves two roles simultaneously:

1. **MCP Server** (stdio) — Exposes tools that Copilot calls to report progress and request decisions
2. **Web App Server** (HTTP + WebSocket) — Serves a React PWA and maintains a real-time connection with your phone

```
┌──────────────┐     stdio      ┌──────────────────────┐    WebSocket     ┌──────────────┐
│  VS Code     │◄──────────────►│  MCP + Web Server    │◄────────────────►│  Mobile Web  │
│  Copilot     │                │  (single process)    │    HTTP (static) │  App (PWA)   │
│  Agent Mode  │                │                      │◄────────────────►│              │
└──────────────┘                └──────────────────────┘                  └──────────────┘
```

1. Copilot starts the MCP server → HTTP/WebSocket server starts automatically on port 7842
2. Ask Copilot _"Show me the AFK app link"_ → it calls `get_current_web_app_url` and renders a QR code
3. Scan the QR code on your phone → the PWA connects via WebSocket
4. Toggle **AFK Mode on** in the app → Copilot routes interactions through your phone
5. Copilot sends progress updates and decision prompts to your phone in real time
6. Toggle **AFK Mode off** → Copilot goes back to the normal VS Code chat panel

## MCP Tools

The server exposes 4 tools to Copilot:

| Tool                      | Purpose                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| `get_current_web_app_url` | Returns the connection URL + QR code for pairing your phone                                    |
| `get_afk_status`          | Checks if AFK mode is on and a client is connected                                             |
| `notify_session_progress` | Sends a progress update to the phone (info, warning, error, success, milestone)                |
| `get_user_decision`       | Asks the user a question and blocks until they respond (confirm, choice, text, or diff review) |

### `notify_session_progress`

Sends real-time progress to the phone. Categories control the icon and urgency:

- **info** — general status (ℹ️)
- **success** — task completed (✅)
- **error** — something failed (❌)
- **milestone** — significant achievement (🎯)
- **warning** — needs attention (⚠️)

Supports optional progress bars (`{ current, total, label }`) and file change lists.

### `get_user_decision`

Blocks Copilot until the user responds on their phone. Decision types:

- **confirm** — Yes/No
- **choice** — Pick from a list of options
- **text** — Free-form text input
- **diff** — Review a code diff and approve/reject

Includes a configurable timeout (default 5 minutes) with an optional default value.

## Web App Features

- **Dashboard** — AFK toggle, live progress feed with category icons and progress bars
- **Decision prompts** — Modal overlay with countdown timer, vibration alert
- **Diff viewer** — Unified diff with syntax coloring for code review decisions
- **History** — Searchable/filterable log of all progress entries (persisted in localStorage)
- **Settings** — Verbosity, sound, vibration, theme (light/dark/system)
- **PWA** — Installable to home screen, works offline via service worker (network-first caching)

## Push Notifications

Push notifications alert you on your phone even when the browser tab is in the background (e.g., for errors or pending decisions).

Push uses the **Web Push** standard with **VAPID** (Voluntary Application Server Identification). VAPID is an open W3C standard — no Google account, Firebase setup, or API keys required. Your keys are generated locally and the push payload is end-to-end encrypted.

### How it works

1. Server generates a VAPID key pair (once, reusable forever)
2. Client fetches the public key from `/api/vapid-key` and subscribes via the Push API
3. Browser returns an FCM/Mozilla/Apple push endpoint — stored on the server
4. Server sends encrypted payloads to the endpoint when needed
5. Service worker receives the push and shows a system notification

### Enable push notifications

The easiest way is to use the setup command:

```bash
npx afk-mode --setup --vapid
```

This generates VAPID keys and writes them to your `.vscode/mcp.json` automatically.

#### Manual VAPID setup

Generate keys manually:

```bash
npx web-push generate-vapid-keys
```

Then set them in your `.vscode/mcp.json`:

```json
{
  "servers": {
    "afk-mode": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "afk-mode"],
      "env": {
        "AFK_PORT": "7842",
        "AFK_PUSH_VAPID_PUBLIC": "your-public-key",
        "AFK_PUSH_VAPID_PRIVATE": "your-private-key"
      }
    }
  }
}
```

Without VAPID keys, push is silently disabled — everything else works normally.

## Security

- **Session token** — 256-bit random token generated per server instance, required for the initial WebSocket connection
- **Single device** — Only one phone can connect at a time (409 Conflict for second connections)
- **Reconnect tickets** — Rotating one-time tickets for seamless reconnection after network drops (expires after 5 minutes, invalidated after use)
- **Local network only** — The server binds to your machine's local IP; no internet exposure

## Environment Variables

| Variable                 | Default  | Description                              |
| ------------------------ | -------- | ---------------------------------------- |
| `AFK_PORT`               | `7842`   | HTTP/WebSocket server port               |
| `AFK_PUSH_VAPID_PUBLIC`  | _(none)_ | VAPID public key for push notifications  |
| `AFK_PUSH_VAPID_PRIVATE` | _(none)_ | VAPID private key for push notifications |

## Development (for contributors)

```bash
git clone <repo-url> && cd afk-mode
pnpm install

# Run server with hot reload
pnpm dev:server

# Run webapp dev server (Vite, port 5173)
pnpm dev:webapp

# Build everything
pnpm build

# Start production server
pnpm start

# Lint and format
pnpm lint             # Check for lint errors
pnpm lint:fix         # Auto-fix lint errors
pnpm format           # Format all source files
pnpm format:check     # Check formatting without writing
```

## Tech Stack

- **Server**: Node.js, Express 5, WebSocket (`ws`), `@modelcontextprotocol/sdk`
- **Web App**: React 19, Vite 7, MUI (Material UI) 7, Emotion
- **Build**: tsup (server), Vite (webapp)
- **Lint**: ESLint 10 with `typescript-eslint` + React Hooks plugin
- **Format**: Prettier
- **Push**: `web-push` with VAPID
- **QR**: `qrcode` (data-URI PNG)
