import type { AppSettings } from "../../shared/types";

interface Props {
  settings: AppSettings;
  onUpdate: (settings: AppSettings) => void;
}

export function Settings({ settings, onUpdate }: Props) {
  const update = (partial: Partial<AppSettings>) => {
    onUpdate({ ...settings, ...partial });
  };

  return (
    <div className="px-4 py-4 space-y-6">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        Settings
      </h2>

      {/* Verbosity */}
      <div>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">
          Verbosity
        </label>
        <div className="flex gap-2">
          {(["simple", "detailed"] as const).map((v) => (
            <button
              key={v}
              onClick={() => update({ verbosity: v })}
              className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${
                settings.verbosity === v
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Sound */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Sound
          </label>
          <button
            role="switch"
            aria-checked={settings.soundEnabled}
            onClick={() => update({ soundEnabled: !settings.soundEnabled })}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              settings.soundEnabled
                ? "bg-blue-600"
                : "bg-slate-300 dark:bg-slate-600"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                settings.soundEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
        {settings.soundEnabled && (
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={settings.soundVolume}
            onChange={(e) =>
              update({ soundVolume: parseFloat(e.target.value) })
            }
            className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-600 bg-slate-200 dark:bg-slate-700"
            aria-label="Volume"
          />
        )}
      </div>

      {/* Vibration */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Vibration
        </label>
        <button
          role="switch"
          aria-checked={settings.vibrationEnabled}
          onClick={() =>
            update({ vibrationEnabled: !settings.vibrationEnabled })
          }
          className={`relative w-11 h-6 rounded-full transition-colors ${
            settings.vibrationEnabled
              ? "bg-blue-600"
              : "bg-slate-300 dark:bg-slate-600"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              settings.vibrationEnabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Theme */}
      <div>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">
          Theme
        </label>
        <div className="flex gap-2">
          {(["light", "dark", "system"] as const).map((t) => (
            <button
              key={t}
              onClick={() => update({ theme: t })}
              className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${
                settings.theme === t
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Clear history */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={() => {
            localStorage.removeItem("afk_progress_history");
            window.location.reload();
          }}
          className="w-full py-2.5 px-3 rounded-lg text-sm font-medium bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
        >
          Clear Session History
        </button>
      </div>
    </div>
  );
}
