import crypto from "node:crypto";
import type { ProgressHistoryEntry, PushSubscriptionData } from "../shared/types.js";

export interface PendingDecision {
  id: string;
  resolve: (decision: { decision: string | null; timedOut: boolean }) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface Session {
  sessionId: string;
  sessionToken: string;
  afkMode: boolean;
  clientConnected: boolean;
  progressHistory: ProgressHistoryEntry[];
  pendingDecisions: Map<string, PendingDecision>;
  pushSubscription: PushSubscriptionData | null;
  reconnectTicket: string | null;
  reconnectTicketExpiry: number | null;
}

let session: Session | null = null;

export function initSession(): Session {
  session = {
    sessionId: crypto.randomUUID(),
    sessionToken: crypto.randomBytes(32).toString("base64url"),
    afkMode: false,
    clientConnected: false,
    progressHistory: [],
    pendingDecisions: new Map(),
    pushSubscription: null,
    reconnectTicket: null,
    reconnectTicketExpiry: null,
  };
  return session;
}

export function getSession(): Session {
  if (!session) {
    throw new Error("Session not initialized. Call initSession() first.");
  }
  return session;
}

export function setAfkMode(enabled: boolean): void {
  getSession().afkMode = enabled;
}

export function setClientConnected(connected: boolean): void {
  getSession().clientConnected = connected;
}

export function addProgressEntry(entry: ProgressHistoryEntry): void {
  getSession().progressHistory.push(entry);
}

export function setPushSubscription(sub: PushSubscriptionData | null): void {
  getSession().pushSubscription = sub;
}

export function generateReconnectTicket(): string {
  const s = getSession();
  s.reconnectTicket = crypto.randomBytes(32).toString("base64url");
  s.reconnectTicketExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes
  return s.reconnectTicket;
}

export function validateReconnectTicket(ticket: string): boolean {
  const s = getSession();
  if (
    s.reconnectTicket &&
    s.reconnectTicketExpiry &&
    s.reconnectTicket === ticket &&
    Date.now() < s.reconnectTicketExpiry
  ) {
    // Invalidate after use
    s.reconnectTicket = null;
    s.reconnectTicketExpiry = null;
    return true;
  }
  return false;
}

export function addPendingDecision(pending: PendingDecision): void {
  getSession().pendingDecisions.set(pending.id, pending);
}

export function resolvePendingDecision(id: string, decision: string): boolean {
  const s = getSession();
  const pending = s.pendingDecisions.get(id);
  if (!pending) return false;
  clearTimeout(pending.timer);
  s.pendingDecisions.delete(id);
  pending.resolve({ decision, timedOut: false });
  return true;
}

export function getNextPendingDecisionId(): string | null {
  const s = getSession();
  const firstKey = s.pendingDecisions.keys().next().value;
  return firstKey ?? null;
}
