import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

interface McpConfig {
  servers: Record<
    string,
    {
      type: string;
      command: string;
      args: string[];
      env?: Record<string, string>;
    }
  >;
}

export async function runSetup(): Promise<void> {
  const cwd = process.cwd();
  const vscodeDir = path.join(cwd, ".vscode");
  const mcpJsonPath = path.join(vscodeDir, "mcp.json");

  // Build the server entry
  const env: Record<string, string> = {
    AFK_PORT: "7842",
  };

  const serverEntry = {
    type: "stdio" as const,
    command: "npx",
    args: ["-y", "afk-mode-mcp"],
    env,
  };

  // Read or create mcp.json
  let config: McpConfig;
  if (existsSync(mcpJsonPath)) {
    try {
      const content = readFileSync(mcpJsonPath, "utf-8");
      config = JSON.parse(content) as McpConfig;
      if (!config.servers) {
        config.servers = {};
      }
    } catch {
      process.stderr.write(
        `Warning: Could not parse existing ${mcpJsonPath}. Creating a new one.\n`,
      );
      config = { servers: {} };
    }
  } else {
    config = { servers: {} };
  }

  // Check if already configured
  if (config.servers["afk-mode-mcp"]) {
    process.stderr.write("Updating existing afk-mode-mcp entry in .vscode/mcp.json\n");
  } else {
    process.stderr.write("Adding afk-mode-mcp to .vscode/mcp.json\n");
  }

  config.servers["afk-mode-mcp"] = serverEntry;

  // Write the file
  if (!existsSync(vscodeDir)) {
    mkdirSync(vscodeDir, { recursive: true });
  }

  writeFileSync(mcpJsonPath, JSON.stringify(config, null, 4) + "\n", "utf-8");

  process.stderr.write(`\n✅ AFK Mode configured!\n\n`);
  process.stderr.write(`   Config written to: ${mcpJsonPath}\n`);
  process.stderr.write(
    `   Copilot will start the MCP server automatically when it needs AFK tools.\n\n`,
  );
  process.stderr.write(`   Next steps:\n`);
  process.stderr.write(`   1. Open VS Code in this workspace\n`);
  process.stderr.write(
    `   2. Ask Copilot: "Show me the AFK app link" → scan the QR code on your phone\n`,
  );
  process.stderr.write(`   3. Toggle AFK Mode on and walk away!\n\n`);
  process.stderr.write(
    `   Push notifications are enabled automatically — no extra setup needed.\n\n`,
  );
}
