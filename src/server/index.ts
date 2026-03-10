import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { initSession } from "./session.js";
import { initWebSocket } from "./websocket.js";
import { initPush } from "./push.js";
import { registerTools } from "./mcp-tools.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getLocalIp(): string {
    const interfaces = networkInterfaces();
    for (const iface of Object.values(interfaces)) {
        if (!iface) continue;
        for (const addr of iface) {
            if (addr.family === "IPv4" && !addr.internal) {
                return addr.address;
            }
        }
    }
    return "127.0.0.1";
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
        const key = process.env.AFK_PUSH_VAPID_PUBLIC;
        if (key) {
            res.json({ key });
        } else {
            res.status(404).json({ error: "VAPID not configured" });
        }
    });

    // Serve static webapp files
    const webappDir = path.resolve(__dirname, "webapp");
    app.use(express.static(webappDir));

    // SPA fallback — serve index.html for all non-file routes
    app.use((_req, res) => {
        res.sendFile(path.join(webappDir, "index.html"));
    });

    const httpServer = createServer(app);

    // ── WebSocket Server ──
    initWebSocket(httpServer);

    // Construct web app URL
    const localIp = getLocalIp();
    const getWebAppUrl = () => `http://${localIp}:${port}/?token=${session.sessionToken}`;

    // ── MCP Server (stdio) ──
    const mcpServer = new McpServer({
        name: "afk-mode",
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

main().catch((err) => {
    process.stderr.write(`Fatal error: ${err}\n`);
    process.exit(1);
});
