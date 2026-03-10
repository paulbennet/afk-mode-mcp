import type { DiffInfo } from "../../shared/types";

interface Props {
  diff: DiffInfo;
}

export function DiffViewer({ diff }: Props) {
  const beforeLines = diff.before.split("\n");
  const afterLines = diff.after.split("\n");

  // Simple unified diff: show removed lines, then added lines
  // A proper diff algorithm could be used here, but for v1 this is sufficient
  return (
    <div className="rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden">
      <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-xs font-mono text-slate-600 dark:text-slate-400 border-b border-slate-300 dark:border-slate-600 truncate">
        {diff.filePath}
      </div>
      <div className="overflow-x-auto">
        <pre className="text-xs leading-5 font-mono">
          {beforeLines.map((line, i) => (
            <div
              key={`before-${i}`}
              className="px-3 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400"
            >
              <span className="select-none text-red-400 dark:text-red-600 mr-2">-</span>
              {line}
            </div>
          ))}
          {afterLines.map((line, i) => (
            <div
              key={`after-${i}`}
              className="px-3 bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-400"
            >
              <span className="select-none text-green-400 dark:text-green-600 mr-2">+</span>
              {line}
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
