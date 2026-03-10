import { useState, useEffect } from "react";
import { WebSocketProvider, useWebSocket } from "./hooks/useWebSocket";
import { useNotifications } from "./hooks/useNotifications";
import { StatusBar } from "./components/StatusBar";
import { Dashboard } from "./components/Dashboard";
import { SessionHistory } from "./components/SessionHistory";
import { Settings } from "./components/Settings";
import { DecisionPrompt } from "./components/DecisionPrompt";
import { DEFAULT_SETTINGS, type AppSettings } from "../shared/types";

type Tab = "dashboard" | "history" | "settings";

function AppInner() {
  const { connectionState } = useWebSocket();
  useNotifications();

  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem("afk_settings");
      return stored
        ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
        : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Persist settings
  useEffect(() => {
    localStorage.setItem("afk_settings", JSON.stringify(settings));
  }, [settings]);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "dark") {
      root.classList.add("dark");
    } else if (settings.theme === "light") {
      root.classList.remove("dark");
    } else {
      // System preference
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const apply = () => {
        if (mq.matches) root.classList.add("dark");
        else root.classList.remove("dark");
      };
      apply();
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [settings.theme]);

  // Connection screen
  if (connectionState === "connecting") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Connecting to AFK Mode server…
        </p>
      </div>
    );
  }

  if (connectionState === "disconnected") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6">
        <span className="text-5xl">🔌</span>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Disconnected
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
          Unable to connect to the AFK Mode server. Make sure VS Code is running
          and you&apos;re on the same network.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "history", label: "History", icon: "📜" },
    { id: "settings", label: "Settings", icon: "⚙️" },
  ];

  return (
    <div className="flex flex-col h-screen">
      <StatusBar />

      <main className="flex-1 overflow-hidden">
        {activeTab === "dashboard" && <Dashboard settings={settings} />}
        {activeTab === "history" && <SessionHistory settings={settings} />}
        {activeTab === "settings" && (
          <Settings settings={settings} onUpdate={setSettings} />
        )}
      </main>

      {/* Tab Bar */}
      <nav className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 safe-area-bottom">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
                activeTab === tab.id
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-slate-400 dark:text-slate-500"
              }`}
              aria-current={activeTab === tab.id ? "page" : undefined}
            >
              <span className="text-lg" aria-hidden="true">
                {tab.icon}
              </span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Decision Prompt Overlay */}
      <DecisionPrompt />
    </div>
  );
}

export default function App() {
  return (
    <WebSocketProvider>
      <AppInner />
    </WebSocketProvider>
  );
}
