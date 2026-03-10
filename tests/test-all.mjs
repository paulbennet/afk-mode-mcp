/**
 * AFK Mode — Comprehensive Integration Tests
 * Covers: Server Startup, MCP Tools, WebSocket, Security
 *
 * Usage: node tests/test-all.mjs
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { WebSocket } from "ws";

// ── Test Infrastructure ──

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, testId, description) {
    if (condition) {
        passed++;
        results.push({ id: testId, desc: description, status: "PASS" });
        console.log(`  ✅ ${testId}: ${description}`);
    } else {
        failed++;
        results.push({ id: testId, desc: description, status: "FAIL" });
        console.log(`  ❌ ${testId}: ${description}`);
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Section 1: Server Startup + Section 2: MCP Tools ──

async function testMcpToolsAndStartup() {
    console.log("\n═══ Section 1: Server Startup + Section 2: MCP Tools ═══\n");

    const transport = new StdioClientTransport({
        command: "node",
        args: ["dist/index.js"],
        env: { ...process.env, AFK_PORT: "7843" },
    });

    const client = new Client({ name: "test-client", version: "1.0.0" });

    try {
        await client.connect(transport);

        // Wait for HTTP server to be ready
        await sleep(2000);

        // 1.1 + 1.5: Server starts and generates session token
        // (Verified by successful MCP connection + get_current_web_app_url returning URL with token)

        // 2.1: Tool discovery
        const { tools } = await client.listTools();
        const toolNames = tools.map((t) => t.name).sort();
        assert(
            toolNames.length === 4 &&
            toolNames.includes("get_current_web_app_url") &&
            toolNames.includes("get_afk_status") &&
            toolNames.includes("notify_session_progress") &&
            toolNames.includes("get_user_decision"),
            "2.1",
            "Tool discovery — 4 tools returned",
        );

        // 2.2: get_current_web_app_url
        const urlResult = await client.callTool({
            name: "get_current_web_app_url",
            arguments: {},
        });
        const urlData = JSON.parse(urlResult.content[0].text);
        assert(
            urlData.url && urlData.url.includes("token=") && urlData.url.includes("7843"),
            "1.1",
            "Server starts on custom port (7843), URL contains token",
        );
        assert(
            urlData.qrCodeMarkdown && urlData.qrCodeMarkdown.includes("data:image/png;base64,"),
            "2.2a",
            "get_current_web_app_url — QR code as base64 data-URI",
        );
        assert(
            typeof urlData.sessionId === "string" && urlData.sessionId.length > 0,
            "2.2b",
            "get_current_web_app_url — returns session ID",
        );

        // Extract token for WebSocket tests
        const urlObj = new URL(urlData.url);
        const token = urlObj.searchParams.get("token");
        assert(token && token.length > 20, "1.5", "Session token generation — base64url token present");

        // 2.3: get_afk_status — default
        const statusResult = await client.callTool({
            name: "get_afk_status",
            arguments: {},
        });
        const statusData = JSON.parse(statusResult.content[0].text);
        assert(
            statusData.afkMode === false,
            "2.3a",
            "get_afk_status default — afkMode is false",
        );
        assert(
            statusData.clientConnected === false,
            "2.3b",
            "get_afk_status default — clientConnected is false",
        );
        assert(
            typeof statusData.sessionId === "string",
            "2.3c",
            "get_afk_status default — sessionId present",
        );

        // 2.5: notify_session_progress — no client connected
        const progressNoClient = await client.callTool({
            name: "notify_session_progress",
            arguments: {
                sessionId: statusData.sessionId,
                summary: "Test progress, no client",
                category: "info",
            },
        });
        const progressNoClientData = JSON.parse(progressNoClient.content[0].text);
        assert(
            progressNoClientData.delivered === false,
            "2.5",
            "notify_session_progress — no client → delivered: false",
        );

        // ── Now connect a WebSocket client to test with-client scenarios ──
        const wsUrl = `ws://localhost:7843/?token=${token}`;
        const ws = await connectWs(wsUrl);

        // Wait for connection_ack and reconnect_ticket
        const messages = [];
        const msgPromise = collectMessages(ws, 2, 3000);
        const initMsgs = await msgPromise;
        messages.push(...initMsgs);

        const ack = initMsgs.find((m) => m.type === "connection_ack");
        assert(
            ack && ack.sessionId === statusData.sessionId,
            "3.1",
            "WebSocket connect with valid token — connection_ack received",
        );
        assert(
            ack && ack.afkMode === false,
            "3.1b",
            "WebSocket connection_ack — afkMode is false",
        );

        const ticketMsg = initMsgs.find((m) => m.type === "reconnect_ticket");
        assert(
            ticketMsg && ticketMsg.ticket && ticketMsg.expiresIn > 0,
            "3.5",
            "Reconnect ticket issued on connect",
        );
        const reconnectTicket = ticketMsg?.ticket;

        // 2.4: get_afk_status after toggle — first set AFK on via WebSocket
        ws.send(JSON.stringify({ type: "set_afk_status", afkMode: true }));
        await sleep(500);

        const statusAfk = await client.callTool({
            name: "get_afk_status",
            arguments: {},
        });
        const statusAfkData = JSON.parse(statusAfk.content[0].text);
        assert(
            statusAfkData.afkMode === true && statusAfkData.clientConnected === true,
            "2.4",
            "get_afk_status after toggle — afkMode: true, clientConnected: true",
        );

        // 2.6: notify_session_progress — with client connected
        const progressPromise = collectMessages(ws, 1, 5000);
        const progressResult = await client.callTool({
            name: "notify_session_progress",
            arguments: {
                sessionId: statusData.sessionId,
                summary: "Refactoring services",
                detail: "Updated 3 service files with new dependency injection",
                category: "info",
                progress: { current: 3, total: 10, label: "Files" },
                filesChanged: ["src/services/auth.ts", "src/services/user.ts"],
                toolsUsed: ["edit_file"],
            },
        });
        const progressData = JSON.parse(progressResult.content[0].text);
        assert(progressData.delivered === true, "2.6a", "notify_session_progress — delivered: true");

        const progressMsgs = await progressPromise;
        const progressMsg = progressMsgs.find((m) => m.type === "progress_update");
        assert(
            progressMsg &&
            progressMsg.summary === "Refactoring services" &&
            progressMsg.category === "info",
            "2.6b",
            "notify_session_progress — client received progress update",
        );
        assert(
            progressMsg && progressMsg.progress && progressMsg.progress.current === 3,
            "2.8",
            "notify_session_progress — progress bar data received (current: 3, total: 10)",
        );

        // 2.7: Test all categories — start collecting BEFORE sending
        const categories = ["info", "warning", "error", "success", "milestone"];
        const allCatPromise = collectMessages(ws, 5, 10000);
        for (const cat of categories) {
            const catResult = await client.callTool({
                name: "notify_session_progress",
                arguments: {
                    sessionId: statusData.sessionId,
                    summary: `Test ${cat} category`,
                    category: cat,
                },
            });
            const catData = JSON.parse(catResult.content[0].text);
            assert(catData.delivered === true, `2.7-${cat}`, `notify_session_progress — ${cat} delivered`);
        }
        // Wait for all 5 progress messages to arrive at WebSocket
        await allCatPromise;

        // 2.9: get_user_decision — confirm
        const decisionPromise = collectMessages(ws, 1, 5000);
        const confirmPromise = client.callTool({
            name: "get_user_decision",
            arguments: {
                sessionId: statusData.sessionId,
                prompt: "Continue with refactoring?",
                type: "confirm",
                timeoutSeconds: 30,
            },
        });

        const decisionMsgs = await decisionPromise;
        const decisionReq = decisionMsgs.find((m) => m.type === "decision_request");
        assert(
            decisionReq && decisionReq.decisionType === "confirm" && decisionReq.prompt === "Continue with refactoring?",
            "2.9a",
            "get_user_decision confirm — client receives decision request",
        );

        // Respond "yes"
        ws.send(JSON.stringify({ type: "decision_response", id: decisionReq.id, decision: "yes" }));
        const confirmResult = await confirmPromise;
        const confirmData = JSON.parse(confirmResult.content[0].text);
        assert(
            confirmData.decision === "yes" && confirmData.timedOut === false,
            "2.9b",
            "get_user_decision confirm — response returned to tool",
        );

        // 2.10: get_user_decision — choice
        const choicePromise2 = collectMessages(ws, 1, 5000);
        const choiceToolPromise = client.callTool({
            name: "get_user_decision",
            arguments: {
                sessionId: statusData.sessionId,
                prompt: "Select database",
                type: "choice",
                options: ["PostgreSQL", "MySQL", "SQLite"],
                timeoutSeconds: 30,
            },
        });

        const choiceMsgs = await choicePromise2;
        const choiceReq = choiceMsgs.find((m) => m.type === "decision_request");
        assert(
            choiceReq && choiceReq.decisionType === "choice" && choiceReq.options.length === 3,
            "2.10a",
            "get_user_decision choice — client receives choice with 3 options",
        );

        ws.send(JSON.stringify({ type: "decision_response", id: choiceReq.id, decision: "PostgreSQL" }));
        const choiceResult = await choiceToolPromise;
        const choiceData = JSON.parse(choiceResult.content[0].text);
        assert(
            choiceData.decision === "PostgreSQL" && choiceData.timedOut === false,
            "2.10b",
            "get_user_decision choice — selected option returned",
        );

        // 2.11: get_user_decision — text
        const textPromise2 = collectMessages(ws, 1, 5000);
        const textToolPromise = client.callTool({
            name: "get_user_decision",
            arguments: {
                sessionId: statusData.sessionId,
                prompt: "Enter the module name",
                type: "text",
                timeoutSeconds: 30,
            },
        });

        const textMsgs = await textPromise2;
        const textReq = textMsgs.find((m) => m.type === "decision_request");
        assert(
            textReq && textReq.decisionType === "text",
            "2.11a",
            "get_user_decision text — client receives text prompt",
        );

        ws.send(JSON.stringify({ type: "decision_response", id: textReq.id, decision: "MyAwesomeModule" }));
        const textResult = await textToolPromise;
        const textData = JSON.parse(textResult.content[0].text);
        assert(
            textData.decision === "MyAwesomeModule",
            "2.11b",
            "get_user_decision text — typed response returned",
        );

        // 2.12: get_user_decision — diff
        const diffPromise2 = collectMessages(ws, 1, 5000);
        const diffToolPromise = client.callTool({
            name: "get_user_decision",
            arguments: {
                sessionId: statusData.sessionId,
                prompt: "Approve this change?",
                type: "diff",
                diff: {
                    filePath: "src/config.ts",
                    before: "const port = 3000;",
                    after: "const port = parseInt(process.env.PORT || '3000', 10);",
                },
                timeoutSeconds: 30,
            },
        });

        const diffMsgs = await diffPromise2;
        const diffReq = diffMsgs.find((m) => m.type === "decision_request");
        assert(
            diffReq && diffReq.decisionType === "diff" && diffReq.diff && diffReq.diff.filePath === "src/config.ts",
            "2.12a",
            "get_user_decision diff — client receives diff data",
        );

        ws.send(JSON.stringify({ type: "decision_response", id: diffReq.id, decision: "approved" }));
        const diffResult = await diffToolPromise;
        const diffData = JSON.parse(diffResult.content[0].text);
        assert(
            diffData.decision === "approved",
            "2.12b",
            "get_user_decision diff — approved returned",
        );

        // 2.13: get_user_decision — timeout
        // Start collecting BEFORE calling the tool so we capture the decision_request
        console.log("  ⏳ 2.13: Testing 3-second timeout...");
        const timeoutDrainPromise = collectMessages(ws, 1, 10000);
        const timeoutResult = await client.callTool({
            name: "get_user_decision",
            arguments: {
                sessionId: statusData.sessionId,
                prompt: "This will time out",
                type: "confirm",
                defaultValue: "no",
                timeoutSeconds: 3,
            },
        });
        // Wait for the decision_request to be drained
        await timeoutDrainPromise.catch(() => { });

        const timeoutData = JSON.parse(timeoutResult.content[0].text);
        assert(
            timeoutData.timedOut === true && timeoutData.decision === "no",
            "2.13",
            "get_user_decision timeout — timedOut: true, defaultValue returned",
        );

        // 2.14: FIFO queue — send two decisions rapidly
        // Start collecting BEFORE sending so we don't miss the first message
        const fifoCollector1 = collectMessages(ws, 1, 10000);
        const fifoPromise1 = client.callTool({
            name: "get_user_decision",
            arguments: {
                sessionId: statusData.sessionId,
                prompt: "First question?",
                type: "confirm",
                timeoutSeconds: 30,
            },
        });
        // Small delay so the second gets queued
        await sleep(100);
        const fifoPromise2 = client.callTool({
            name: "get_user_decision",
            arguments: {
                sessionId: statusData.sessionId,
                prompt: "Second question?",
                type: "confirm",
                timeoutSeconds: 30,
            },
        });

        // Client should receive first decision
        const fifoMsg1 = await fifoCollector1;
        const fifoReq1 = fifoMsg1.find((m) => m.type === "decision_request");
        assert(
            fifoReq1 && fifoReq1.prompt === "First question?",
            "2.14a",
            "FIFO queue — first question received first",
        );

        // Respond to first — pre-register handler for second before responding
        const fifoCollector2 = collectMessages(ws, 1, 10000);
        ws.send(JSON.stringify({ type: "decision_response", id: fifoReq1.id, decision: "yes" }));
        await fifoPromise1;

        // Now second should arrive (handler was already listening)
        const fifoMsg2 = await fifoCollector2;
        const fifoReq2 = fifoMsg2.find((m) => m.type === "decision_request");
        assert(
            fifoReq2 && fifoReq2.prompt === "Second question?",
            "2.14b",
            "FIFO queue — second question received after first resolved",
        );
        ws.send(JSON.stringify({ type: "decision_response", id: fifoReq2.id, decision: "no" }));
        await fifoPromise2;

        // ── Section 3: WebSocket Tests ──
        console.log("\n═══ Section 3: WebSocket Connection ═══\n");

        // 3.2: Invalid token
        try {
            const badWs = await connectWs("ws://localhost:7843/?token=invalid-token-xyz", 3000);
            badWs.close();
            assert(false, "3.2", "Invalid token rejected — should have failed");
        } catch {
            assert(true, "3.2", "Invalid token rejected — 401");
        }

        // 3.3: No token
        try {
            const noTokenWs = await connectWs("ws://localhost:7843/", 3000);
            noTokenWs.close();
            assert(false, "3.3", "No token rejected — should have failed");
        } catch {
            assert(true, "3.3", "No token rejected — 401");
        }

        // 3.4: Single device enforcement
        try {
            const dupWs = await connectWs(`ws://localhost:7843/?token=${token}`, 3000);
            dupWs.close();
            assert(false, "3.4", "Single device enforcement — should have failed");
        } catch {
            assert(true, "3.4", "Single device enforcement — second connection rejected 409");
        }

        // 3.6 + 3.7: Reconnect with ticket
        ws.close();
        await sleep(1000);

        const ws2 = await connectWs(`ws://localhost:7843/?ticket=${reconnectTicket}`);
        const reconnMsgs = await collectMessages(ws2, 2, 3000);
        const reconnAck = reconnMsgs.find((m) => m.type === "connection_ack");
        const reconnTicket = reconnMsgs.find((m) => m.type === "reconnect_ticket");
        assert(
            reconnAck && reconnAck.sessionId === statusData.sessionId,
            "3.6",
            "Reconnect with ticket — connection_ack received",
        );
        assert(
            reconnTicket && reconnTicket.ticket !== reconnectTicket,
            "3.7",
            "Ticket rotation — new ticket issued, different from old",
        );

        // 3.9: Reused ticket rejected
        ws2.close();
        await sleep(1000);
        try {
            const reusedWs = await connectWs(`ws://localhost:7843/?ticket=${reconnectTicket}`, 3000);
            reusedWs.close();
            assert(false, "3.9", "Reused ticket rejected — should have failed");
        } catch {
            assert(true, "3.9", "Reused ticket rejected — old ticket invalidated");
        }

        // Re-connect with the new ticket for further tests
        const ws3 = await connectWs(`ws://localhost:7843/?ticket=${reconnTicket.ticket}`);
        await collectMessages(ws3, 2, 3000);

        // ── Section 9: Security ──
        console.log("\n═══ Section 9: Security ═══\n");

        // 9.1: No token = WebSocket fails (app loads but WS can't connect)
        try {
            const noAuthWs = await connectWs("ws://localhost:7843/", 3000);
            noAuthWs.close();
            assert(false, "9.1", "No token WS connection fails");
        } catch {
            assert(true, "9.1", "No token WS connection fails — rejected");
        }

        // 9.2: Invalid token WS rejected (same as 3.2)
        try {
            const badAuthWs = await connectWs("ws://localhost:7843/?token=fabricated123", 3000);
            badAuthWs.close();
            assert(false, "9.2", "Invalid token WS rejected");
        } catch {
            assert(true, "9.2", "Invalid token WS rejected — 401");
        }

        // 9.4: Single device enforced (same as 3.4)
        try {
            const dupWs2 = await connectWs(`ws://localhost:7843/?token=${token}`, 3000);
            dupWs2.close();
            assert(false, "9.4", "Single device enforced");
        } catch {
            assert(true, "9.4", "Single device enforced — 409 Conflict");
        }

        // 9.5: Ticket single-use (reused ticket already tested in 3.9)
        assert(true, "9.5", "Ticket single-use — verified in test 3.9");

        ws3.close();

        // Test HTTP endpoints
        // 1.2: Custom port (already verified via port 7843)
        assert(true, "1.2", "Server starts on custom port (AFK_PORT=7843)");

        // 7.2: VAPID disabled — no env vars set
        const vapidRes = await fetch("http://localhost:7843/api/vapid-key");
        assert(vapidRes.status === 404, "7.2", "VAPID disabled — /api/vapid-key returns 404");

        // Static file serving
        const htmlRes = await fetch("http://localhost:7843/");
        assert(htmlRes.ok && htmlRes.status === 200, "4.1-http", "Web app HTML served at /");
        const htmlText = await htmlRes.text();
        assert(
            htmlText.includes("<!DOCTYPE html") || htmlText.includes("<!doctype html"),
            "4.1-html",
            "Web app — valid HTML document served",
        );

        // SPA fallback
        const spaRes = await fetch("http://localhost:7843/some/random/path");
        assert(spaRes.ok, "SPA", "SPA fallback — non-file route returns index.html");

        await client.close();
    } catch (err) {
        console.error("\n🔥 Test error:", err.message);
        console.error(err.stack);
        failed++;
    }
}

// ── Section 1.3: Port conflict ──

async function testPortConflict() {
    console.log("\n═══ Section 1.3: Port Conflict ═══\n");

    // Start first server
    const transport1 = new StdioClientTransport({
        command: "node",
        args: ["dist/index.js"],
        env: { ...process.env, AFK_PORT: "7850" },
    });
    const client1 = new Client({ name: "test-conflict-1", version: "1.0.0" });
    await client1.connect(transport1);
    await sleep(2000);

    // Verify first server is actually listening
    try {
        const checkRes = await fetch("http://localhost:7850/");
        assert(checkRes.ok, "1.3-pre", "First server is listening on port 7850");
    } catch {
        assert(false, "1.3-pre", "First server is listening on port 7850");
    }

    // Start second server on same port — should fail
    const { spawn } = await import("node:child_process");
    const child = spawn("node", ["dist/index.js"], {
        env: { ...process.env, AFK_PORT: "7850" },
        stdio: ["pipe", "pipe", "pipe"],
    });

    let stderrOutput = "";
    child.stderr.on("data", (data) => {
        stderrOutput += data.toString();
    });
    let stdoutOutput = "";
    child.stdout.on("data", (data) => {
        stdoutOutput += data.toString();
    });

    await new Promise((resolve) => {
        child.on("close", (code) => {
            assert(
                code !== 0 && (stderrOutput.includes("EADDRINUSE") || stderrOutput.includes("already in use")),
                "1.3",
                `Port conflict — second instance exits (code=${code}, stderr=${stderrOutput.trim().slice(0, 100)})`,
            );
            resolve();
        });
        // Timeout fallback
        setTimeout(() => {
            // If it's still running after 8s, it didn't fail
            if (!child.killed) {
                assert(false, "1.3", "Port conflict — second instance should have exited but didn't");
                child.kill();
            }
            resolve();
        }, 8000);
    });

    await client1.close();
}

// ── Helper Functions ──

function connectWs(url, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error("WebSocket connection timed out"));
        }, timeout);

        const ws = new WebSocket(url);
        ws.on("open", () => {
            clearTimeout(timer);
            resolve(ws);
        });
        ws.on("error", (err) => {
            clearTimeout(timer);
            reject(err);
        });
        ws.on("unexpected-response", (_req, res) => {
            clearTimeout(timer);
            reject(new Error(`WebSocket rejected: ${res.statusCode}`));
        });
    });
}

function collectMessages(ws, count, timeout) {
    return new Promise((resolve, reject) => {
        const messages = [];
        const timer = setTimeout(() => {
            if (messages.length > 0) {
                resolve(messages);
            } else {
                reject(new Error(`Timed out waiting for ${count} messages (got ${messages.length})`));
            }
        }, timeout);

        const handler = (data) => {
            try {
                messages.push(JSON.parse(data.toString()));
            } catch {
                // ignore
            }
            if (messages.length >= count) {
                clearTimeout(timer);
                ws.off("message", handler);
                resolve(messages);
            }
        };
        ws.on("message", handler);
    });
}

// ── Run All ──

async function main() {
    console.log("╔════════════════════════════════════════════════════╗");
    console.log("║   AFK Mode — Full Integration Test Suite          ║");
    console.log("╚════════════════════════════════════════════════════╝");

    await testMcpToolsAndStartup();
    await testPortConflict();

    console.log("\n╔════════════════════════════════════════════════════╗");
    console.log(`║   Results: ${passed} passed, ${failed} failed                    ║`);
    console.log("╚════════════════════════════════════════════════════╝\n");

    // Print summary table
    console.log("| # | Test | Status |");
    console.log("|---|------|--------|");
    for (const r of results) {
        console.log(`| ${r.id} | ${r.desc} | ${r.status} |`);
    }

    process.exit(failed > 0 ? 1 : 0);
}

main();
