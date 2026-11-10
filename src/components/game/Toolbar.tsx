import { formatTime } from '@/engines/core/storage';

interface Props {
  onNew: () => void;
  onDaily: () => void;
  onHint: () => void;
  onUndo: () => void;
  onShuffle: () => void;
  onSettings: () => void;
  canUndo: boolean;
  elapsed: number;
  moves: number;
  remaining: number;
  best: number | null;
  seed: string;
}

const btn =
  'inline-flex min-h-11 items-center gap-1 rounded-md border border-border bg-bg-elev px-3 text-sm font-medium hover:bg-bg disabled:opacity-40 disabled:cursor-not-allowed';

export function Toolbar(p: Props) {
  return (
    <div class="flex flex-wrap items-center gap-2 py-2" role="toolbar" aria-label="Game controls">
      <button class={btn} onClick={p.onNew}>
        <span aria-hidden="true">✦</span> New game
      </button>
      <button class={btn} onClick={p.onDaily} title="Everyone gets the same board today">
        <span aria-hidden="true">📅</span> Daily
      </button>
      <button class={btn} onClick={p.onHint} accessKey="h">
        <span aria-hidden="true">💡</span> Hint
      </button>
      <button class={btn} onClick={p.onUndo} disabled={!p.canUndo} accessKey="u">
        <span aria-hidden="true">↶</span> Undo
      </button>
      <button class={btn} onClick={p.onShuffle}>
        <span aria-hidden="true">⇄</span> Shuffle
      </button>
      <button class={btn} onClick={p.onSettings} aria-haspopup="dialog">
        <span aria-hidden="true">⚙</span> Settings
      </button>
      <dl class="ml-auto flex items-center gap-4 text-sm tabular-nums">
        <div class="flex gap-1">
          <dt class="text-muted">Time</dt>
          <dd class="font-semibold" aria-live="off">
            {formatTime(p.elapsed)}
          </dd>
        </div>
        <div class="flex gap-1">
          <dt class="text-muted">Tiles</dt>
          <dd class="font-semibold">{p.remaining}</dd>
        </div>
        <div class="hidden gap-1 sm:flex">
          <dt class="text-muted">Moves</dt>
          <dd class="font-semibold">{p.moves}</dd>
        </div>
        {p.best !== null && (
          <div class="hidden gap-1 sm:flex">
            <dt class="text-muted">Best</dt>
            <dd class="font-semibold">{formatTime(p.best)}</dd>
          </div>
        )}
        <div class="hidden gap-1 md:flex">
          <dt class="text-muted">Seed</dt>
          <dd class="font-mono">{p.seed}</dd>
        </div>
      </dl>
    </div>
  );
}
