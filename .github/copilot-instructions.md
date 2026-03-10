# Project Guidelines

## Architecture

AFK Mode is a single Node.js process serving two roles simultaneously:

- **MCP Server** (stdio via `@modelcontextprotocol/sdk`) — tools called by VS Code Copilot
- **Web App Server** (Express 5 HTTP + `ws` WebSocket) — serves a React PWA for mobile

Code is split into three areas:

- `src/server/` — Node.js backend (MCP tools, WebSocket, push notifications, session state)
- `src/webapp/` — React 19 frontend (components, hooks, service worker)
- `src/shared/` — Types shared between server and webapp

See `docs/PRD.md` for the full product spec.

## Code Style

- **ESM only** — `"type": "module"` in package.json
- **Node imports** use the `node:` prefix: `import { createServer } from "node:http"`
- **Server relative imports** include `.js` extension: `import { getSession } from "./session.js"`
- **Webapp imports** omit extensions (Vite resolves them): `import { useWebSocket } from "./useWebSocket"`
- **Type-only imports**: `import type { ServerMessage } from "../shared/types.js"`
- **Named exports** over default exports
- **TypeScript strict mode** is on — no `any`, no implicit `undefined`

## Naming

- Components: PascalCase files and names (`Dashboard.tsx`, `ProgressEntry.tsx`)
- Hooks: `use` prefix, camelCase (`useWebSocket.tsx`, `useNotifications.ts`)
- Server modules: kebab-case (`mcp-tools.ts`) or camelCase (`session.ts`)
- Types/Interfaces: PascalCase (`ServerMessage`, `PendingDecision`)
- React props: inline `{ children }: { children: ReactNode }` for simple components

## Build & Run

```bash
pnpm install          # Install dependencies
pnpm build            # Build webapp (Vite) then server (tsup)
pnpm dev:server       # Run server with tsx hot reload
pnpm dev:webapp       # Run Vite dev server on port 5173
pnpm lint             # Check for lint errors
pnpm lint:fix         # Auto-fix lint errors
pnpm format           # Format all source files with Prettier
pnpm format:check     # Check formatting without writing
```

Build order matters: webapp builds first into `dist/webapp/`, then tsup bundles the server into `dist/index.js` (without `--clean`, to preserve the webapp output).

## Packaging & Distribution

- Published to npm as `afk-mode` — users install via `npx afk-mode --setup`
- `bin` entry in package.json points to `dist/index.js` (with shebang added by tsup `--banner.js`)
- `files` field limits the npm package to `dist/` only
- `prepublishOnly` script runs `pnpm build` automatically before `npm publish`
- `.npmignore` excludes source, tests, and dev configs from the published package
- `--setup` CLI flag writes `.vscode/mcp.json` instead of starting the MCP server

## Key Patterns

- **Session state** is an in-memory singleton in `session.ts` — no database
- **WebSocket** enforces single-device connection with rotating reconnect tickets
- **MCP tool definitions** use zod schemas in `mcp-tools.ts`
- **CLI setup** (`setup.ts`) handles `--setup` flag to write `.vscode/mcp.json` for users
- **Push notifications** use auto-generated VAPID keys (ephemeral, per session) — no env vars needed
- **Service worker** (`sw.ts`) is built as a separate Vite entry point, output as `dist/webapp/sw.js`
- **MUI (Material UI) 7** with Emotion — theme defined in `src/webapp/theme.ts`, dark/light mode via `ThemeProvider`

## Linting & Formatting

- **ESLint** (flat config in `eslint.config.js`) — TypeScript strict + React Hooks rules
- **Prettier** (config in `.prettierrc`) — code formatting for TS, TSX, CSS, JSON
- **eslint-config-prettier** disables ESLint rules that conflict with Prettier
- After editing any source file, run `pnpm lint:fix` then `pnpm format` to fix lint errors and format the code
- Before committing, ensure `pnpm lint` and `pnpm format:check` pass with no errors

## Gotchas

- Express 5 does **not** support `app.get("*", handler)` for catch-all routes — use `app.use(handler)` instead
- tsup `--clean` flag would wipe `dist/webapp/` — never add it back
- React 19 requires explicit `useRef<T>(undefined)` — not `useRef<T>()`
- The `PushSubscriptionJSON` DOM type is not available in Node.js — use the custom `PushSubscriptionData` interface from `shared/types.ts`
