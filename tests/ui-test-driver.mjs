/**
 * AFK Mode — UI Test Driver
 * Starts the MCP server + HTTP server, then exposes a simple HTTP API
 * on a control port so Playwright tests can trigger MCP actions.
 *
 * Control API on port 7860:
 *   GET /info         — Get session info (token, sessionId, url)
 *   POST /afk-status  — Get current AFK status
 *   POST /progress    — Send a progress notification (body: JSON)
 *   POST /decision    — Send a decision request (body: JSON), returns when user responds
 */

import { createServer } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const APP_PORT = "7855";
const CONTROL_PORT = 7860;

// Start MCP server
const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/index.js"],
    env: { ...process.env, AFK_PORT: APP_PORT },
});

const client = new Client({ name: "ui-test-driver", version: "1.0.0" });
await client.connect(transport);

// Wait for HTTP server to start
await new Promise((r) => setTimeout(r, 2000));

// Get app info
const urlResult = await client.callTool({ name: "get_current_web_app_url", arguments: {} });
const urlData = JSON.parse(urlResult.content[0].text);
const appUrl = urlData.url;
const sessionId = urlData.sessionId;
const token = new URL(appUrl).searchParams.get("token");

console.log(`App URL: ${appUrl}`);
console.log(`Session ID: ${sessionId}`);

// Control HTTP server
const controlServer = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
    }

    const url = new URL(req.url ?? "/", `http://localhost:${CONTROL_PORT}`);

    if (url.pathname === "/info" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ appUrl, sessionId, token, appPort: APP_PORT }));
        return;
    }

    if (url.pathname === "/afk-status" && req.method === "POST") {
        const result = await client.callTool({ name: "get_afk_status", arguments: {} });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(result.content[0].text);
        return;
    }

    if (url.pathname === "/progress" && req.method === "POST") {
        const body = await readBody(req);
        const args = JSON.parse(body);
        const result = await client.callTool({
            name: "notify_session_progress",
            arguments: { sessionId, ...args },
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(result.content[0].text);
        return;
    }

    if (url.pathname === "/decision" && req.method === "POST") {
        const body = await readBody(req);
        const args = JSON.parse(body);
        const result = await client.callTool({
            name: "get_user_decision",
            arguments: { sessionId, ...args },
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(result.content[0].text);
        return;
    }

    res.writeHead(404);
    res.end("Not found");
});

controlServer.listen(CONTROL_PORT, () => {
    console.log(`Control API running on http://localhost:${CONTROL_PORT}`);
    console.log("Ready for Playwright tests.");
});

function readBody(req) {
    return new Promise((resolve) => {
        let data = "";
        req.on("data", (chunk) => (data += chunk));
        req.on("end", () => resolve(data));
    });
}

// Keep alive until killed
process.on("SIGINT", async () => {
    controlServer.close();
    await client.close();
    process.exit(0);
});
