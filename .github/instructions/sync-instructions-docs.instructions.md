---
description: "Use when: modifying source code, adding/removing files, changing dependencies, altering build config, or updating architecture. Ensures copilot-instructions.md and docs stay in sync with project reality."
applyTo: **
---

# Keep Instructions & Docs in Sync

When source changes affect project structure, conventions, or capabilities, update the corresponding documentation **in the same changeset** — not as a follow-up.

## What to check after source changes

| Change type                             | Update                                                                            |
| --------------------------------------- | --------------------------------------------------------------------------------- |
| New file/folder or removed file/folder  | `copilot-instructions.md` Architecture section, `README.md` if it lists structure |
| New/changed import convention           | `copilot-instructions.md` Code Style section                                      |
| New/changed naming pattern              | `copilot-instructions.md` Naming section                                          |
| New dependency or removed dependency    | `README.md` Tech Stack section                                                    |
| New/changed build script or build order | `copilot-instructions.md` Build & Run, `README.md` Setup/Development sections     |
| New environment variable                | `copilot-instructions.md` Key Patterns, `README.md` Environment Variables table   |
| New MCP tool or changed tool schema     | `README.md` MCP Tools section                                                     |
| New gotcha or pitfall discovered        | `copilot-instructions.md` Gotchas section                                         |
| New/changed web app feature             | `README.md` Web App Features section                                              |
| Security model change                   | `README.md` Security section                                                      |

## Rules

- Only update docs sections that are actually affected — don't rewrite unrelated sections
- Keep `copilot-instructions.md` concise — it's loaded into every Copilot interaction
- Keep `README.md` accurate for external readers — it's the project's public face
- If a gotcha is hit and resolved during implementation, add it to Gotchas immediately
