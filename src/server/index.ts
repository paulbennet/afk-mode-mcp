import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { initSession } from "./session.js";
import { initWebSocket } from "./websocket.js";
import { initPush, getVapidPublicKey } from "./push.js";
import { registerTools } from "./mcp-tools.js";
import { runSetup } from "./setup.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getLocalIp(): string {
  const interfaces = networkInterfaces();
  let fallback: string | null = null;

  for (const [name, iface] of Object.entries(interfaces)) {
    if (!iface) continue;
    const lowerName = name.toLowerCase();
    for (const addr of iface) {
      if (addr.family !== "IPv4" || addr.internal) continue;

      // Prefer common LAN interfaces (Wi-Fi, Ethernet)
      const isLan =
        lowerName.includes("wi-fi") ||
        lowerName.includes("wifi") ||
        lowerName.includes("wlan") ||
        lowerName.includes("ethernet") ||
        lowerName.includes("eth") ||
        lowerName.includes("en0") ||
        lowerName.includes("en1");

      if (isLan) return addr.address;

      // Prefer 192.168.x.x / 172.16-31.x.x ranges over VPN-like addresses (10.x.x.x)
      if (!fallback || addr.address.startsWith("192.168.") || addr.address.startsWith("172.")) {
        fallback = addr.address;
      }
    }
  }
  return fallback ?? "127.0.0.1";
}

async function main(): Promise<void> {
  // Initialize session
  const session = initSession();

  // Initialize push notifications (if VAPID keys provided)
  initPush();

  // ── HTTP Server (Express) ──
  const app = express();
  const port = parseInt(process.env.AFK_PORT || "7842", 10);

  // API: expose VAPID public key for push subscriptions
  app.get("/api/vapid-key", (_req, res) => {
    const key = getVapidPublicKey();
    if (key) {
      res.json({ key });
    } else {
      res.status(404).json({ error: "VAPID not configured" });
    }
  });

  // Serve static webapp files
  // In production (tsup bundle), __dirname is dist/ so webapp is at dist/webapp/
  // In dev (tsx), __dirname is src/server/ so we need to resolve to dist/webapp/
  const webappDir = path.resolve(__dirname, "webapp");
  const webappDirResolved = existsSync(webappDir)
    ? webappDir
    : path.resolve(__dirname, "../../dist/webapp");
  app.use(express.static(webappDirResolved));

  // SPA fallback — serve index.html for all non-file routes
  app.use((_req, res) => {
    res.sendFile(path.join(webappDirResolved, "index.html"));
  });

  const httpServer = createServer(app);

  // ── WebSocket Server ──
  initWebSocket(httpServer);

  // Construct web app URL
  const localIp = getLocalIp();
  const getWebAppUrl = () => `http://${localIp}:${port}/?token=${session.sessionToken}`;

  // ── MCP Server (stdio) ──
  const mcpServer = new McpServer({
    name: "afk-mode-mcp",
    version: "1.0.0",
  });

  registerTools(mcpServer, getWebAppUrl);

  // Start HTTP server
  await new Promise<void>((resolve, reject) => {
    httpServer.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        process.stderr.write(
          `\nError: Port ${port} is already in use. Set AFK_PORT environment variable to use a different port.\n`,
        );
        process.exit(1);
      }
      reject(err);
    });
    httpServer.listen(port, () => {
      process.stderr.write(`\nAFK Mode web server running at http://${localIp}:${port}\n`);
      process.stderr.write(`Session ID: ${session.sessionId}\n`);
      process.stderr.write(`Connect URL: ${getWebAppUrl()}\n\n`);
      resolve();
    });
  });

  // Start MCP server on stdio
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
}

// ── CLI mode: handle --setup before starting MCP server ──
if (process.argv.includes("--setup")) {
  runSetup().catch((err) => {
    process.stderr.write(`Setup failed: ${err}\n`);
    process.exit(1);
  });
} else {
  main().catch((err) => {
    process.stderr.write(`Fatal error: ${err}\n`);
    process.exit(1);
  });
}
