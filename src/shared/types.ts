// ── WebSocket Message Types ──
// Shared between server and webapp for type safety.

// Messages from server → client
export type ServerMessage =
    | ProgressUpdateMessage
    | DecisionRequestMessage
    | ConnectionAckMessage
    | ReconnectTicketMessage;

export interface ProgressUpdateMessage {
    type: "progress_update";
    id: string;
    timestamp: string;
    summary: string;
    detail: string | null;
    category: ProgressCategory;
    progress: ProgressInfo | null;
    filesChanged: string[];
    toolsUsed: string[];
}

export interface DecisionRequestMessage {
    type: "decision_request";
    id: string;
    timestamp: string;
    prompt: string;
    decisionType: DecisionType;
    options: string[] | null;
    diff: DiffInfo | null;
    defaultValue: string | null;
    timeoutSeconds: number;
}

export interface ConnectionAckMessage {
    type: "connection_ack";
    sessionId: string;
    afkMode: boolean;
}

export interface ReconnectTicketMessage {
    type: "reconnect_ticket";
    ticket: string;
    expiresIn: number; // seconds
}

// Messages from client → server
export type ClientMessage =
    | SetAfkStatusMessage
    | DecisionResponseMessage
    | PushSubscriptionMessage
    | PingMessage;

export interface SetAfkStatusMessage {
    type: "set_afk_status";
    afkMode: boolean;
}

export interface DecisionResponseMessage {
    type: "decision_response";
    id: string;
    decision: string;
}

export interface PushSubscriptionData {
    endpoint: string;
    keys?: Record<string, string>;
}

export interface PushSubscriptionMessage {
    type: "push_subscription";
    subscription: PushSubscriptionData;
}

export interface PingMessage {
    type: "ping";
}

// ── Shared Data Types ──

export type ProgressCategory = "info" | "warning" | "error" | "success" | "milestone";
export type DecisionType = "confirm" | "choice" | "text" | "diff";

export interface ProgressInfo {
    current: number;
    total: number;
    label: string;
}

export interface DiffInfo {
    filePath: string;
    before: string;
    after: string;
}

// ── MCP Tool Input/Output Types ──

export interface NotifyProgressInput {
    sessionId: string;
    summary: string;
    detail?: string | null;
    category: ProgressCategory;
    progress?: ProgressInfo | null;
    filesChanged?: string[];
    toolsUsed?: string[];
}

export interface GetUserDecisionInput {
    sessionId: string;
    prompt: string;
    type: DecisionType;
    options?: string[] | null;
    diff?: DiffInfo | null;
    defaultValue?: string | null;
    timeoutSeconds?: number;
}

export interface ProgressHistoryEntry {
    id: string;
    timestamp: string;
    summary: string;
    detail: string | null;
    category: ProgressCategory;
    progress: ProgressInfo | null;
    filesChanged: string[];
    toolsUsed: string[];
}

// Settings stored in localStorage on the client
export interface AppSettings {
    verbosity: "simple" | "detailed";
    soundEnabled: boolean;
    soundVolume: number;
    vibrationEnabled: boolean;
    theme: "light" | "dark" | "system";
}

export const DEFAULT_SETTINGS: AppSettings = {
    verbosity: "simple",
    soundEnabled: true,
    soundVolume: 0.7,
    vibrationEnabled: true,
    theme: "system",
};
