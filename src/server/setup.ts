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

async function generateVapidKeys(): Promise<{ publicKey: string; privateKey: string } | null> {
  try {
    const webPush = await import("web-push");
    return webPush.generateVAPIDKeys();
  } catch {
    return null;
  }
}

export async function runSetup(args: string[]): Promise<void> {
  const withVapid = args.includes("--vapid");
  const cwd = process.cwd();
  const vscodeDir = path.join(cwd, ".vscode");
  const mcpJsonPath = path.join(vscodeDir, "mcp.json");

  // Build the server entry
  const env: Record<string, string> = {
    AFK_PORT: "7842",
  };

  if (withVapid) {
    const keys = await generateVapidKeys();
    if (keys) {
      env.AFK_PUSH_VAPID_PUBLIC = keys.publicKey;
      env.AFK_PUSH_VAPID_PRIVATE = keys.privateKey;
      process.stderr.write("Generated VAPID keys for push notifications.\n");
    } else {
      process.stderr.write(
        "Warning: Could not generate VAPID keys. Push notifications will be disabled.\n",
      );
    }
  }

  const serverEntry = {
    type: "stdio" as const,
    command: "npx",
    args: ["-y", "afk-mode"],
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
  if (config.servers["afk-mode"]) {
    process.stderr.write("Updating existing afk-mode entry in .vscode/mcp.json\n");
  } else {
    process.stderr.write("Adding afk-mode to .vscode/mcp.json\n");
  }

  config.servers["afk-mode"] = serverEntry;

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

  if (!withVapid) {
    process.stderr.write(`   Optional: Re-run with --vapid to enable push notifications:\n`);
    process.stderr.write(`   npx afk-mode --setup --vapid\n\n`);
  }
}
