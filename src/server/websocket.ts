import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "node:http";
import type { Server as HttpServer } from "node:http";
import {
  getSession,
  setAfkMode,
  setClientConnected,
  setPushSubscription,
  generateReconnectTicket,
  validateReconnectTicket,
  resolvePendingDecision,
} from "./session.js";
import type {
  ServerMessage,
  ClientMessage,
  DecisionRequestMessage,
  ProgressUpdateMessage,
  ReconnectTicketMessage,
  ConnectionAckMessage,
} from "../shared/types.js";

let activeSocket: WebSocket | null = null;
let wss: WebSocketServer | null = null;

// Queue of decision requests waiting to be sent to the client.
// We send one at a time; when the client responds, we send the next.
const decisionSendQueue: DecisionRequestMessage[] = [];
let currentDecisionId: string | null = null;

export function initWebSocket(server: HttpServer): WebSocketServer {
  wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req: IncomingMessage, socket, head) => {
    const url = new URL(req.url ?? "", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");
    const ticket = url.searchParams.get("ticket");
    const session = getSession();

    // Auth: validate token or reconnect ticket
    let authenticated = false;
    if (token && token === session.sessionToken && !session.clientConnected) {
      authenticated = true;
    } else if (ticket && validateReconnectTicket(ticket)) {
      authenticated = true;
    }

    if (!authenticated) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    // Reject if already connected (single device)
    if (activeSocket && activeSocket.readyState === WebSocket.OPEN) {
      socket.write("HTTP/1.1 409 Conflict\r\n\r\n");
      socket.destroy();
      return;
    }

    wss!.handleUpgrade(req, socket, head, (ws) => {
      wss!.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws: WebSocket) => {
    activeSocket = ws;
    setClientConnected(true);

    const session = getSession();

    // Send connection ack
    const ack: ConnectionAckMessage = {
      type: "connection_ack",
      sessionId: session.sessionId,
      afkMode: session.afkMode,
    };
    ws.send(JSON.stringify(ack));

    // Issue reconnect ticket
    sendReconnectTicket(ws);

    // Set up keepalive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 30_000);

    ws.on("message", (data) => {
      try {
        const msg: ClientMessage = JSON.parse(data.toString());
        handleClientMessage(msg, ws);
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on("close", () => {
      clearInterval(pingInterval);
      if (activeSocket === ws) {
        activeSocket = null;
        setClientConnected(false);
      }
    });

    ws.on("error", () => {
      clearInterval(pingInterval);
      if (activeSocket === ws) {
        activeSocket = null;
        setClientConnected(false);
      }
    });
  });

  return wss;
}

function handleClientMessage(msg: ClientMessage, ws: WebSocket): void {
  switch (msg.type) {
    case "set_afk_status":
      setAfkMode(msg.afkMode);
      break;

    case "decision_response":
      resolvePendingDecision(msg.id, msg.decision);
      currentDecisionId = null;
      // Send next queued decision if any
      sendNextQueuedDecision();
      break;

    case "push_subscription":
      setPushSubscription(msg.subscription);
      break;

    case "ping":
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "pong" }));
      }
      break;
  }
}

function sendReconnectTicket(ws: WebSocket): void {
  const ticket = generateReconnectTicket();
  const msg: ReconnectTicketMessage = {
    type: "reconnect_ticket",
    ticket,
    expiresIn: 300,
  };
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export function sendToClient(message: ServerMessage): boolean {
  if (activeSocket && activeSocket.readyState === WebSocket.OPEN) {
    activeSocket.send(JSON.stringify(message));
    return true;
  }
  return false;
}

export function sendProgressUpdate(update: ProgressUpdateMessage): boolean {
  return sendToClient(update);
}

export function sendDecisionRequest(request: DecisionRequestMessage): void {
  // Queue the decision. If nothing is currently being shown, send immediately.
  decisionSendQueue.push(request);
  if (!currentDecisionId) {
    sendNextQueuedDecision();
  }
}

function sendNextQueuedDecision(): void {
  const next = decisionSendQueue.shift();
  if (!next) {
    currentDecisionId = null;
    return;
  }
  currentDecisionId = next.id;
  sendToClient(next);
}
