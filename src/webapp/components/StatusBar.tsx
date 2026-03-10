import { useWebSocket } from "../hooks/useWebSocket";

export function StatusBar() {
  const { connectionState, afkMode, sessionId } = useWebSocket();

  const isConnected = connectionState === "connected";

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-sm">
      {/* Connection indicator */}
      <div className="flex items-center gap-1.5">
        <span
          className={`inline-block w-2.5 h-2.5 rounded-full ${
            isConnected
              ? "bg-green-500"
              : connectionState === "connecting"
                ? "bg-yellow-500 animate-pulse"
                : "bg-red-500"
          }`}
          aria-label={`Connection: ${connectionState}`}
        />
        <span className="text-slate-600 dark:text-slate-400">
          {isConnected
            ? "Connected"
            : connectionState === "connecting"
              ? "Connecting…"
              : "Disconnected"}
        </span>
      </div>

      {/* AFK indicator */}
      {afkMode && (
        <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-medium animate-pulse-afk">
          AFK
        </span>
      )}

      {/* Session ID */}
      {sessionId && (
        <span className="ml-auto text-slate-400 dark:text-slate-600 text-xs font-mono truncate max-w-[120px]">
          {sessionId.slice(0, 8)}
        </span>
      )}
    </div>
  );
}
