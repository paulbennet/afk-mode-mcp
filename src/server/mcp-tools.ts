import crypto from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getSession, addProgressEntry, addPendingDecision } from "./session.js";
import { generateQrMarkdown } from "./qr.js";
import { sendProgressUpdate, sendDecisionRequest, clearCurrentDecision } from "./websocket.js";
import { sendPushNotification } from "./push.js";
import type {
  ProgressUpdateMessage,
  DecisionRequestMessage,
  ProgressHistoryEntry,
} from "../shared/types.js";

export function registerTools(server: McpServer, getWebAppUrl: () => string): void {
  // ── get_current_web_app_url ──
  server.tool(
    "get_current_web_app_url",
    "Returns the connection URL and QR code for the AFK Mode web app. Call this when the user asks for the AFK app link or QR code.",
    {},
    async () => {
      const session = getSession();
      const url = getWebAppUrl();
      const qrCodeMarkdown = await generateQrMarkdown(url);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                url,
                qrCodeMarkdown,
                sessionId: session.sessionId,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ── get_afk_status ──
  server.tool(
    "get_afk_status",
    "Returns the current AFK mode status. Call this before every interaction to decide whether to route through AFK MCP tools or native chat. If afkMode is true and clientConnected is true, route through notify_session_progress / get_user_decision. If afkMode is true but clientConnected is false, fall back to native chat and warn the user. If afkMode is false, use native VS Code chat as usual.",
    {},
    async () => {
      const session = getSession();
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              afkMode: session.afkMode,
              clientConnected: session.clientConnected,
              sessionId: session.sessionId,
            }),
          },
        ],
      };
    },
  );

  // ── notify_session_progress ──
  server.tool(
    "notify_session_progress",
    "Sends a progress update to the connected mobile client. Only call this when AFK mode is active (afkMode: true and clientConnected: true). Returns immediately. Use category 'milestone' for significant steps, 'error' for failures, 'info' for routine updates.",
    {
      sessionId: z.string().describe("The session ID"),
      summary: z.string().describe("Short human-readable summary"),
      detail: z
        .string()
        .nullable()
        .optional()
        .describe("Extended detail (shown in detailed verbosity)"),
      category: z
        .enum(["info", "warning", "error", "success", "milestone"])
        .describe("Category of the progress update"),
      progress: z
        .object({
          current: z.number(),
          total: z.number(),
          label: z.string(),
        })
        .nullable()
        .optional()
        .describe("Optional structured progress"),
      filesChanged: z.array(z.string()).optional().describe("Optional list of files touched"),
      toolsUsed: z.array(z.string()).optional().describe("Optional list of tools called"),
    },
    async (args) => {
      const id = crypto.randomUUID();
      const timestamp = new Date().toISOString();

      const entry: ProgressHistoryEntry = {
        id,
        timestamp,
        summary: args.summary,
        detail: args.detail ?? null,
        category: args.category,
        progress: args.progress ?? null,
        filesChanged: args.filesChanged ?? [],
        toolsUsed: args.toolsUsed ?? [],
      };
      addProgressEntry(entry);

      const msg: ProgressUpdateMessage = {
        type: "progress_update",
        ...entry,
      };
      const delivered = sendProgressUpdate(msg);

      // Push notification for critical updates
      if (args.category === "error" || args.category === "milestone") {
        await sendPushNotification(
          args.category === "error" ? "⚠️ Error" : "🎯 Milestone",
          args.summary,
        );
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ delivered }),
          },
        ],
      };
    },
  );

  // ── get_user_decision ──
  server.tool(
    "get_user_decision",
    "Sends a decision request to the mobile client and blocks until the user responds or timeout expires. Only call when AFK mode is active. Use type 'confirm' for yes/no, 'choice' for selecting from options, 'text' for free-text input, 'diff' for approving code changes.",
    {
      sessionId: z.string().describe("The session ID"),
      prompt: z.string().describe("The question for the user"),
      type: z.enum(["confirm", "choice", "text", "diff"]).describe("The type of decision"),
      options: z
        .array(z.string())
        .nullable()
        .optional()
        .describe('For "choice" type: list of options'),
      diff: z
        .object({
          filePath: z.string(),
          before: z.string(),
          after: z.string(),
        })
        .nullable()
        .optional()
        .describe('For "diff" type: file diff information'),
      defaultValue: z
        .string()
        .nullable()
        .optional()
        .describe("Default value used if timeout fires"),
      timeoutSeconds: z
        .number()
        .optional()
        .default(300)
        .describe("Timeout in seconds (default: 300)"),
    },
    async (args) => {
      const id = crypto.randomUUID();
      const timestamp = new Date().toISOString();
      const timeoutMs = (args.timeoutSeconds ?? 300) * 1000;

      const result = await new Promise<{
        decision: string | null;
        timedOut: boolean;
      }>((resolve) => {
        const timer = setTimeout(() => {
          const session = getSession();
          session.pendingDecisions.delete(id);
          clearCurrentDecision(id);
          resolve({ decision: args.defaultValue ?? null, timedOut: true });
        }, timeoutMs);

        addPendingDecision({ id, resolve, timer });

        const request: DecisionRequestMessage = {
          type: "decision_request",
          id,
          timestamp,
          prompt: args.prompt,
          decisionType: args.type,
          options: args.options ?? null,
          diff: args.diff ?? null,
          defaultValue: args.defaultValue ?? null,
          timeoutSeconds: args.timeoutSeconds ?? 300,
        };

        sendDecisionRequest(request);

        // Push notification for decision requests
        sendPushNotification("🔔 Decision Needed", args.prompt);
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result),
          },
        ],
      };
    },
  );
}
