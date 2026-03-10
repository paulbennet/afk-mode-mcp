import type { ProgressUpdateMessage } from "../../shared/types";
import { useState } from "react";

const categoryConfig: Record<
  string,
  { icon: string; color: string; bgColor: string }
> = {
  info: {
    icon: "ℹ️",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950",
  },
  warning: {
    icon: "⚠️",
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "bg-yellow-50 dark:bg-yellow-950",
  },
  error: {
    icon: "❌",
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950",
  },
  success: {
    icon: "✅",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-950",
  },
  milestone: {
    icon: "🎯",
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-950",
  },
};

interface Props {
  entry: ProgressUpdateMessage;
  verbosity: "simple" | "detailed";
}

export function ProgressEntry({ entry, verbosity }: Props) {
  const config = categoryConfig[entry.category] ?? categoryConfig.info;
  const [expanded, setExpanded] = useState(entry.category === "error");
  const hasDetail =
    entry.detail || entry.filesChanged.length > 0 || entry.toolsUsed.length > 0;

  const time = new Date(entry.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div
      className={`rounded-lg border p-3 ${config.bgColor} border-slate-200 dark:border-slate-700`}
    >
      <div className="flex items-start gap-2">
        <span className="text-lg flex-shrink-0" aria-hidden="true">
          {config.icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={`font-medium text-sm ${config.color}`}>
              {entry.summary}
            </p>
            <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">
              {time}
            </span>
          </div>

          {/* Progress bar */}
          {entry.progress && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                <span>{entry.progress.label}</span>
                <span>
                  {entry.progress.current} / {entry.progress.total}
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{
                    width: `${(entry.progress.current / entry.progress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Expandable detail section */}
          {hasDetail && verbosity === "detailed" && (
            <>
              <button
                onClick={() => setExpanded(!expanded)}
                className="mt-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1 min-h-[28px]"
                aria-expanded={expanded}
              >
                <span
                  className={`transition-transform ${expanded ? "rotate-90" : ""}`}
                >
                  ▶
                </span>
                Details
              </button>
              {expanded && (
                <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                  {entry.detail && <p>{entry.detail}</p>}
                  {entry.filesChanged.length > 0 && (
                    <p>
                      <span className="font-medium">Files:</span>{" "}
                      {entry.filesChanged.join(", ")}
                    </p>
                  )}
                  {entry.toolsUsed.length > 0 && (
                    <p>
                      <span className="font-medium">Tools:</span>{" "}
                      {entry.toolsUsed.join(", ")}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
