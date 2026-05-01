import type { StepProgress } from "../lib/recipe.ts";

interface Props {
  title: string;
  progress: StepProgress[];
  done: boolean;
  error: string | null;
  onClose: () => void;
  onRetry?: () => void;
}

const ICON: Record<StepProgress["status"], string> = {
  pending: "○",
  running: "↻",
  ok: "✓",
  error: "×",
  skipped: "·",
};

const COLOR: Record<StepProgress["status"], string> = {
  pending: "t-tertiary",
  running: "text-accent",
  ok: "text-green",
  error: "text-red",
  skipped: "t-tertiary",
};

export function SeedProgress({ title, progress, done, error, onClose, onRetry }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-black/40 backdrop-blur-sm">
      <div className="glass rounded-2xl p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold t-primary">{title}</h2>
          {done && (
            <button
              onClick={onClose}
              className="text-xs t-secondary hover:t-primary transition-colors"
            >
              Close
            </button>
          )}
        </div>

        <ol className="space-y-1.5 text-sm">
          {progress.map((p, i) => (
            <li key={i} className="flex items-baseline gap-2">
              <span className={`w-4 inline-block ${COLOR[p.status]}`}>{ICON[p.status]}</span>
              <span className="flex-1 t-primary">{p.step.label}</span>
              {p.summary && <span className="text-xs t-tertiary">{p.summary}</span>}
            </li>
          ))}
        </ol>

        {error && (
          <div className="text-xs text-red bg-red-light rounded-lg px-3 py-2 break-words">
            {error}
          </div>
        )}

        {done && error && onRetry && (
          <div className="flex gap-2 justify-end">
            <button
              onClick={onRetry}
              className="px-3 py-1.5 text-xs rounded-lg bg-accent text-white hover:opacity-90"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
