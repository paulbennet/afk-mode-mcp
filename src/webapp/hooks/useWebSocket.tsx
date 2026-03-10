import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type {
  ServerMessage,
  ClientMessage,
  ProgressUpdateMessage,
  DecisionRequestMessage,
} from "../../shared/types";

type ConnectionState = "connecting" | "connected" | "disconnected";

interface WebSocketContextValue {
  connectionState: ConnectionState;
  sessionId: string | null;
  afkMode: boolean;
  setAfkMode: (enabled: boolean) => void;
  progressUpdates: ProgressUpdateMessage[];
  pendingDecision: DecisionRequestMessage | null;
  respondToDecision: (id: string, decision: string) => void;
  sendMessage: (msg: ClientMessage) => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTicketRef = useRef<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [afkMode, setAfkModeState] = useState(false);
  const [progressUpdates, setProgressUpdates] = useState<ProgressUpdateMessage[]>([]);
  const [pendingDecision, setPendingDecision] = useState<DecisionRequestMessage | null>(null);

  const sendMessage = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  const setAfkMode = useCallback(
    (enabled: boolean) => {
      setAfkModeState(enabled);
      sendMessage({ type: "set_afk_status", afkMode: enabled });
    },
    [sendMessage],
  );

  const respondToDecision = useCallback(
    (id: string, decision: string) => {
      sendMessage({ type: "decision_response", id, decision });
      setPendingDecision(null);
    },
    [sendMessage],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      setConnectionState("disconnected");
      return;
    }

    let closed = false;

    function connect(authParam: string) {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/?${authParam}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionState("connected");
      };

      ws.onmessage = (event) => {
        const msg: ServerMessage = JSON.parse(event.data);
        handleServerMessage(msg);
      };

      ws.onclose = () => {
        if (closed) return;
        setConnectionState("disconnected");
        wsRef.current = null;

        // Try reconnect with ticket after 2s
        if (reconnectTicketRef.current) {
          const ticket = reconnectTicketRef.current;
          reconnectTicketRef.current = null;
          setTimeout(() => {
            if (!closed) {
              setConnectionState("connecting");
              connect(`ticket=${ticket}`);
            }
          }, 2000);
        }
      };

      ws.onerror = () => {
        // onclose will fire after this
      };
    }

    function handleServerMessage(msg: ServerMessage) {
      switch (msg.type) {
        case "connection_ack":
          setSessionId(msg.sessionId);
          setAfkModeState(msg.afkMode);
          break;

        case "reconnect_ticket":
          reconnectTicketRef.current = msg.ticket;
          break;

        case "progress_update": {
          setProgressUpdates((prev) => [msg, ...prev]);
          // Persist to localStorage
          const history = JSON.parse(localStorage.getItem("afk_progress_history") || "[]");
          history.unshift(msg);
          localStorage.setItem("afk_progress_history", JSON.stringify(history.slice(0, 500)));
          break;
        }

        case "decision_request":
          setPendingDecision(msg);
          break;
      }
    }

    connect(`token=${token}`);

    return () => {
      closed = true;
      wsRef.current?.close();
    };
  }, []);

  // Load persisted progress on mount
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("afk_progress_history") || "[]");
      if (stored.length > 0) {
        setProgressUpdates(stored);
      }
    } catch {
      // ignore
    }
  }, []);

  return (
    <WebSocketContext.Provider
      value={{
        connectionState,
        sessionId,
        afkMode,
        setAfkMode,
        progressUpdates,
        pendingDecision,
        respondToDecision,
        sendMessage,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket(): WebSocketContextValue {
  const ctx = useContext(WebSocketContext);
  if (!ctx) {
    throw new Error("useWebSocket must be used within WebSocketProvider");
  }
  return ctx;
}
