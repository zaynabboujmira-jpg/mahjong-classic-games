import { useEffect, useRef, useState } from 'preact/hooks';
import { formatTime, type BestRecord } from '@/engines/core/storage';

interface Props {
  timeMs: number;
  moves: number;
  shuffles: number;
  best: BestRecord;
  layoutName: string;
  seed: string;
  onNew: () => void;
}

export function WinDialog(p: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const isBest = p.best.bestTimeMs !== null && p.best.bestTimeMs >= p.timeMs;
  const shareText = `Mahjong ${p.layoutName} cleared in ${formatTime(p.timeMs)} (${p.moves} moves${p.shuffles ? `, ${p.shuffles} shuffle${p.shuffles > 1 ? 's' : ''}` : ''}). Seed ${p.seed}`;

  async function share() {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      if (navigator.share) {
        await navigator.share({ text: shareText, url });
        return;
      }
      await navigator.clipboard.writeText(`${shareText}\n${url}`);
      setCopied(true);
    } catch {
      /* user cancelled or clipboard blocked */
    }
  }

  return (
    <dialog ref={ref} class="m-auto w-[min(92vw,26rem)] rounded-xl border border-border bg-bg-elev p-6 text-fg shadow-2xl backdrop:bg-black/50">
      <h2 class="text-2xl font-bold">You cleared the board!</h2>
      <dl class="mt-4 grid grid-cols-2 gap-2 text-sm">
        <dt class="text-muted">Time</dt>
        <dd class="font-semibold tabular-nums">
          {formatTime(p.timeMs)} {isBest && <span class="ml-1 rounded bg-accent px-1.5 py-0.5 text-xs text-accent-fg">Best</span>}
        </dd>
        <dt class="text-muted">Moves</dt>
        <dd class="font-semibold">{p.moves}</dd>
        <dt class="text-muted">Shuffles</dt>
        <dd class="font-semibold">{p.shuffles}</dd>
        <dt class="text-muted">Wins on this layout</dt>
        <dd class="font-semibold">{p.best.wins}</dd>
      </dl>
      <div class="mt-5 flex flex-wrap gap-2">
        <button class="min-h-11 rounded-md bg-accent px-4 font-medium text-accent-fg" onClick={p.onNew}>
          Play again
        </button>
        <button class="min-h-11 rounded-md border border-border px-4 font-medium" onClick={share}>
          {copied ? 'Copied!' : 'Share result'}
        </button>
      </div>
    </dialog>
  );
}
