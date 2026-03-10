import { useWebSocket } from "../hooks/useWebSocket";
import { ProgressEntry } from "./ProgressEntry";
import type { AppSettings } from "../../shared/types";

interface Props {
  settings: AppSettings;
}

export function Dashboard({ settings }: Props) {
  const { afkMode, setAfkMode, progressUpdates, connectionState } = useWebSocket();

  return (
    <div className="flex flex-col h-full">
      {/* AFK Toggle */}
      <div className="px-4 py-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">AFK Mode</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {afkMode ? "Copilot will route interactions here" : "Copilot uses VS Code chat"}
            </p>
          </div>
          <button
            role="switch"
            aria-checked={afkMode}
            aria-label="Toggle AFK mode"
            onClick={() => setAfkMode(!afkMode)}
            disabled={connectionState !== "connected"}
            className={`relative w-14 h-8 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
              afkMode ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600"
            } ${connectionState !== "connected" ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <span
              className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${
                afkMode ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Progress Feed */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {progressUpdates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-600">
            <span className="text-4xl mb-3">📋</span>
            <p className="text-sm">No progress updates yet</p>
            <p className="text-xs mt-1">
              {afkMode
                ? "Updates will appear here as Copilot works"
                : "Enable AFK mode to start receiving updates"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {progressUpdates.map((entry) => (
              <ProgressEntry key={entry.id} entry={entry} verbosity={settings.verbosity} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
