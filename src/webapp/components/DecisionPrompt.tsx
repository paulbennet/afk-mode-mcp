import { useState, useEffect, useRef } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { DiffViewer } from "./DiffViewer";

export function DecisionPrompt() {
  const { pendingDecision, respondToDecision } = useWebSocket();
  const [textValue, setTextValue] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    if (!pendingDecision) return;
    setTextValue("");
    setTimeLeft(pendingDecision.timeoutSeconds);

    // Vibrate
    if ("vibrate" in navigator) {
      navigator.vibrate([200, 100, 200]);
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [pendingDecision]);

  if (!pendingDecision) return null;

  const { id, prompt, decisionType, options, diff, timeoutSeconds } = pendingDecision;
  const progressPct = (timeLeft / timeoutSeconds) * 100;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Decision needed"
    >
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Timeout bar */}
        <div className="h-1 bg-slate-200 dark:bg-slate-700 rounded-t-2xl overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ease-linear ${
              timeLeft < 30 ? "bg-red-500" : "bg-blue-500"
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="p-5">
          {/* Timer */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Decision Needed
            </span>
            <span
              className={`text-sm font-mono ${
                timeLeft < 30 ? "text-red-500" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {formatTime(timeLeft)}
            </span>
          </div>

          {/* Prompt */}
          <p className="text-base font-medium text-slate-900 dark:text-slate-100 mb-5">{prompt}</p>

          {/* Decision UI based on type */}
          {decisionType === "confirm" && (
            <div className="flex gap-3">
              <button
                onClick={() => respondToDecision(id, "yes")}
                className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-base transition-colors"
              >
                Yes
              </button>
              <button
                onClick={() => respondToDecision(id, "no")}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 font-medium text-base transition-colors"
              >
                No
              </button>
            </div>
          )}

          {decisionType === "choice" && options && (
            <div className="space-y-2">
              {options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => respondToDecision(id, opt)}
                  className="w-full py-3 px-4 rounded-xl text-left bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 text-sm font-medium transition-colors"
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {decisionType === "text" && (
            <div className="space-y-3">
              <textarea
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                className="w-full h-24 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Type your response..."
                autoFocus
              />
              <button
                onClick={() => respondToDecision(id, textValue)}
                disabled={!textValue.trim()}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white disabled:text-slate-500 font-medium text-base transition-colors"
              >
                Submit
              </button>
            </div>
          )}

          {decisionType === "diff" && diff && (
            <div className="space-y-4">
              <DiffViewer diff={diff} />
              <div className="flex gap-3">
                <button
                  onClick={() => respondToDecision(id, "approved")}
                  className="flex-1 py-3 px-4 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium text-base transition-colors"
                >
                  Approve
                </button>
                <button
                  onClick={() => respondToDecision(id, "rejected")}
                  className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-base transition-colors"
                >
                  Reject
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
