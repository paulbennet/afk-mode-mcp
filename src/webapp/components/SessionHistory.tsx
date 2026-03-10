import { useState, useMemo } from "react";
import type { ProgressUpdateMessage } from "../../shared/types";
import type { AppSettings } from "../../shared/types";
import { ProgressEntry } from "./ProgressEntry";

interface Props {
  settings: AppSettings;
}

export function SessionHistory({ settings }: Props) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const history: ProgressUpdateMessage[] = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("afk_progress_history") || "[]");
    } catch {
      return [];
    }
  }, []);

  const filtered = useMemo(() => {
    return history.filter((entry) => {
      const matchesSearch =
        !search ||
        entry.summary.toLowerCase().includes(search.toLowerCase()) ||
        (entry.detail ?? "").toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === "all" || entry.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [history, search, categoryFilter]);

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 space-y-2">
        <input
          type="text"
          placeholder="Search history..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-1.5 overflow-x-auto">
          {["all", "info", "warning", "error", "success", "milestone"].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                categoryFilter === cat
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* History list */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-600">
            <span className="text-4xl mb-3">📜</span>
            <p className="text-sm">No history entries</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((entry) => (
              <ProgressEntry key={entry.id} entry={entry} verbosity={settings.verbosity} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
