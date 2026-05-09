import type { ComponentType } from "react";
import { Check, Circle, CircleSlash, Loader2, X } from "lucide-react";
import type { StepProgress } from "../lib/recipe.ts";

interface Props {
 title: string;
 progress: StepProgress[];
 done: boolean;
 error: string | null;
 onClose: () => void;
 onRetry?: () => void;
}

const ICON: Record<StepProgress["status"], ComponentType<{ className?: string }>> = {
 pending: Circle,
 running: Loader2,
 ok: Check,
 error: X,
 skipped: CircleSlash,
};

const COLOR: Record<StepProgress["status"], string> = {
 pending: "text-text-dim",
 running: "text-accent",
 ok: "text-success",
 error: "text-error",
 skipped: "text-text-dim",
};

export function SeedProgress({ title, progress, done, error, onClose, onRetry }: Props) {
 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-black/40 backdrop-blur-sm">
 <div className="bg-bg-card border border-border shadow-card rounded-2xl p-6 w-full max-w-md space-y-4">
 <div className="flex items-center justify-between">
 <h2 className="text-base font-semibold text-text">{title}</h2>
 {done && (
 <button
 onClick={onClose}
 className="text-xs text-text-muted hover:text-text transition-colors"
 >
 Close
 </button>
 )}
 </div>

 <ol className="space-y-1.5 text-sm">
 {progress.map((p, i) => (
 <li key={i} className="flex items-baseline gap-2">
 <span className={`w-4 inline-flex items-center ${COLOR[p.status]}`}>{(() => { const Ico = ICON[p.status]; return <Ico className={`w-3.5 h-3.5${p.status === "running" ? " animate-spin" :""}`} />; })()}</span>
 <span className="flex-1 text-text">{p.step.label}</span>
 {p.summary && <span className="text-xs text-text-dim">{p.summary}</span>}
 </li>
 ))}
 </ol>

 {error && (
 <div className="text-xs text-error bg-error/10 rounded-lg px-3 py-2 break-words">
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
