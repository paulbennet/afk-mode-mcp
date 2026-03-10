---
description: "Activate when performing long-running tasks while the user is AFK. Routes all progress and decisions through the AFK Mode mobile app instead of VS Code chat."
---

# AFK Workflow

You are working while the user is away from their desk. All progress updates and decision requests **must** go through the AFK Mode MCP tools — never print progress to chat or use in-chat confirmation UI.

## Startup

1. Call `get_afk_status` — confirm `afkMode: true` and `clientConnected: true` before proceeding.
   - If `afkMode: false` → tell the user to enable AFK mode in the mobile app first, then stop.
   - If `clientConnected: false` → warn the user that no phone is connected. Call `get_current_web_app_url` to provide the QR code so they can connect, then stop.
2. Call `get_afk_status` to obtain the `sessionId`. Use this value for every subsequent tool call.

## Progress Reporting

**Every time** you would normally print a status update, log, or result to chat, call `notify_session_progress` instead. Do not duplicate the information in chat.

Choose the right category:

| Category    | When to use                                           |
| ----------- | ----------------------------------------------------- |
| `info`      | Routine status — starting a step, reading files, etc. |
| `success`   | A sub-task completed successfully                     |
| `warning`   | Something unexpected but non-blocking                 |
| `error`     | A failure that needs attention                        |
| `milestone` | A significant phase completed (e.g., "all tests pass") |

Guidelines:

- **summary** — one short sentence (≤ 120 chars). This is always visible on the phone.
- **detail** — optional longer explanation, stack traces, or context. Only shown in detailed verbosity.
- **progress** — include `{ current, total, label }` when iterating over a known set (files, tests, steps).
- **filesChanged** — list files you created or modified in that step.
- **toolsUsed** — list tool names you invoked (e.g., `["read_file", "replace_string_in_file"]`).

## Decision Requests

**Every time** you would normally ask the user a question in chat, call `get_user_decision` instead. Never ask questions in the chat panel.

Pick the right decision type:

| Type      | When to use                                     | What the user sees            |
| --------- | ----------------------------------------------- | ----------------------------- |
| `confirm` | Yes/no question                                 | Two buttons: Yes / No         |
| `choice`  | Pick one from a list                            | Tappable option cards         |
| `text`    | Need free-form input                            | Text field + submit button    |
| `diff`    | Proposing a code change that needs approval     | Diff viewer + Approve/Reject  |

Guidelines:

- **prompt** — clear, self-contained question. The user only sees the mobile app, not your chat context.
- **options** — required for `choice` type. Keep the list short (≤ 6 items).
- **diff** — required for `diff` type. Provide `{ filePath, before, after }`.
- **defaultValue** — set a sensible default so work can continue if the user doesn't respond in time.
- **timeoutSeconds** — default is 300 (5 min). Increase for complex decisions, decrease for simple confirmations.

After receiving a response:

- If `timedOut: true` and `decision: null` — skip the step or choose the safest option, then notify the user via `notify_session_progress` with category `warning`.
- If `timedOut: true` and `decision` has a value — the default was used; proceed normally.

## Periodic AFK Check

Call `get_afk_status` periodically (roughly every 5–10 tool calls, or before any major phase) to detect if the user has turned AFK mode off. If `afkMode` becomes `false`, stop routing through MCP tools and resume normal chat interaction immediately.

## Rules

1. **Never** print progress, status, or results to the VS Code chat while AFK mode is active.
2. **Never** ask questions in the VS Code chat while AFK mode is active.
3. **Always** include the `sessionId` in every `notify_session_progress` and `get_user_decision` call.
4. **Always** set a `defaultValue` on `get_user_decision` when a reasonable default exists.
5. If the WebSocket disconnects (`delivered: false` from `notify_session_progress`), call `get_afk_status` to re-check the connection state before continuing.
