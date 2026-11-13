import { useEffect, useRef, useState } from 'preact/hooks';
import { randomSeed } from '../../engines/core/rng';
import { readJson, writeJson } from '../../engines/core/storage';
import { recordWin } from '../../engines/core/progress';
import { BOARDS, BOARD_IDS, MatchGame, better, type BoardId } from '../../engines/puzzles/match';

/** Fifteen original symbols (24 × 24), each with its own colour and name for screen readers. */
const SYMBOLS: { name: string; color: string; svg: string }[] = [
  { name: 'Sun', color: '#f59e0b', svg: '<circle cx="12" cy="12" r="5"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>' },
  { name: 'Moon', color: '#6366f1', svg: '<path d="M20 15.5A8.5 8.5 0 0 1 8.5 4a8.5 8.5 0 1 0 11.5 11.5z"/>' },
  { name: 'Star', color: '#eab308', svg: '<path d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 16.9 5.9 20.4l1.5-6.8L2.2 9l6.9-.7z"/>' },
  { name: 'Leaf', color: '#16a34a', svg: '<path d="M20 4C9 4 4 9 4 17c0 1 .1 2 .3 3C6 13 10 10 15 8c-4 3-7 6-8.5 11.5C16 20 20 14 20 4z"/>' },
  { name: 'Drop', color: '#0ea5e9', svg: '<path d="M12 2s7 7.6 7 12.5A7 7 0 0 1 5 14.5C5 9.6 12 2 12 2z"/>' },
  { name: 'Bolt', color: '#f97316', svg: '<path d="M13.5 1.5 4 13.5h6.5L9 22.5l10-13h-6.5z"/>' },
  { name: 'Flower', color: '#ec4899', svg: '<circle cx="12" cy="6" r="4"/><circle cx="18" cy="12" r="4"/><circle cx="12" cy="18" r="4"/><circle cx="6" cy="12" r="4"/><circle cx="12" cy="12" r="3" fill="#fde68a"/>' },
  { name: 'Diamond', color: '#14b8a6', svg: '<path d="M12 2l9 10-9 10-9-10z"/>' },
  { name: 'Cloud', color: '#64748b', svg: '<path d="M7 19a5 5 0 0 1-.6-10A6.5 6.5 0 0 1 19 8.5a5.3 5.3 0 0 1-.5 10.5z"/>' },
  { name: 'Note', color: '#8b5cf6', svg: '<path d="M9 17.5V5l11-2.5v12.5" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="6.5" cy="17.5" r="3"/><circle cx="17.5" cy="15" r="3"/>' },
  { name: 'Crown', color: '#ca8a04', svg: '<path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5z"/>' },
  { name: 'Fish', color: '#06b6d4', svg: '<path d="M2 12c3-5 9-6.5 13.5-2.5L21 6v12l-5.5-3.5C11 18.5 5 17 2 12z"/><circle cx="7.5" cy="11" r="1.3" fill="#fff"/>' },
  { name: 'Key', color: '#a16207', svg: '<circle cx="7.5" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="3"/><path d="M12 12h10M18.5 12v4M21.5 12v3" stroke="currentColor" stroke-width="3"/>' },
  { name: 'Heart', color: '#e11d48', svg: '<path d="M12 21C5 15.5 2 12.3 2 8.4 2 5.4 4.4 3 7.3 3c1.9 0 3.6 1 4.7 2.6C13.1 4 14.8 3 16.7 3 19.6 3 22 5.4 22 8.4c0 3.9-3 7.1-10 12.6z"/>' },
  { name: 'Shell', color: '#fb7185', svg: '<path d="M12 3C6 3 2 8 2 13l10 8 10-8c0-5-4-10-10-10z"/><path d="M12 6v14M7 8l5 12M17 8l-5 12" stroke="#fff" stroke-width="1.3" opacity=".7"/>' },
];

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
type Best = { moves: number; ms: number } | null;

export default function MemoryMatchGame() {
  const game = useRef<MatchGame>(new MatchGame('medium', 'preview'));
  const [board, setBoard] = useState<BoardId>('medium');
  const [, setTick] = useState(0);
  const [ms, setMs] = useState(0);
  const [best, setBest] = useState<Best>(null);
  const [won, setWon] = useState(false);
  const [announce, setAnnounce] = useState('');
  const startedAt = useRef(0);
  const timer = useRef(0);
  const hideTimer = useRef(0);
  const focusIdx = useRef(0);
  const gridRef = useRef<HTMLDivElement>(null);

  const bestKey = (b: BoardId) => `match:best:${b}`;
  const refresh = () => setTick((n) => n + 1);

  const stopClock = () => window.clearInterval(timer.current);

  const start = (b: BoardId = board) => {
    stopClock();
    window.clearTimeout(hideTimer.current);
    game.current = new MatchGame(b, randomSeed());
    startedAt.current = 0;
    setBoard(b);
    setMs(0);
    setWon(false);
    setBest(readJson<Best>(bestKey(b), null));
    writeJson('match:board', b);
    setAnnounce(`New ${BOARDS[b].name} game: ${game.current.pairs} pairs.`);
    refresh();
  };

  const flip = (i: number) => {
    const g = game.current;
    if (won) return;
    window.clearTimeout(hideTimer.current);
    const res = g.flip(i);
    if (res === 'ignored') return;
    if (!startedAt.current) {
      startedAt.current = performance.now();
      timer.current = window.setInterval(() => setMs(performance.now() - startedAt.current), 250);
    }
    const name = SYMBOLS[g.cards[i]!.symbol]!.name;
    if (res === 'first') setAnnounce(`${name}.`);
    else if (res === 'match') setAnnounce(`${name}: a pair! ${g.found} of ${g.pairs} found.`);
    else if (res === 'miss') {
      setAnnounce(`${name}: no match.`);
      hideTimer.current = window.setTimeout(() => {
        g.hideMiss();
        refresh();
      }, 900);
    } else if (res === 'won') {
      stopClock();
      const time = performance.now() - startedAt.current;
      setMs(time);
      setWon(true);
      recordWin('memory-match');
      const result = { moves: g.moves, ms: Math.round(time) };
      const prev = readJson<Best>(bestKey(g.board), null);
      if (better(result, prev)) {
        writeJson(bestKey(g.board), result);
        setBest(result);
      }
      setAnnounce(`All pairs found in ${g.moves} moves and ${fmt(time)}.`);
    }
    refresh();
  };

  useEffect(() => {
    const b = readJson<BoardId>('match:board', 'medium');
    start(BOARD_IDS.includes(b) ? b : 'medium');
    return () => {
      stopClock();
      window.clearTimeout(hideTimer.current);
    };
  }, []);

  /** Arrow keys move between cards (roving focus); Enter or Space flips. */
  const onKeyDown = (e: KeyboardEvent) => {
    const g = game.current;
    const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -g.cols, ArrowDown: g.cols }[e.key];
    if (d === undefined) return;
    e.preventDefault();
    const next = Math.min(g.cards.length - 1, Math.max(0, focusIdx.current + d));
    focusIdx.current = next;
    (gridRef.current?.children[next] as HTMLElement | undefined)?.focus();
  };

  const g = game.current;
  const { cols, rows } = BOARDS[board];
  return (
    <section class="game" aria-label="Memory Match">
      <div class="toolbar" role="toolbar" aria-label="Game controls">
        <button type="button" class="btn btn-primary" onClick={() => start()}>
          New game
        </button>
        <div class="segmented" role="radiogroup" aria-label="Board size">
          {BOARD_IDS.map((b) => (
            <button key={b} type="button" role="radio" class="seg" aria-checked={board === b} onClick={() => start(b)}>
              {BOARDS[b].cols}×{BOARDS[b].rows}
            </button>
          ))}
        </div>
        <dl class="stats">
          <div>
            <dt>Moves</dt>
            <dd class="tabular-nums">{g.moves}</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd class="tabular-nums">{fmt(ms)}</dd>
          </div>
          <div>
            <dt>Best</dt>
            <dd class="tabular-nums">{best ? `${best.moves} · ${fmt(best.ms)}` : '–'}</dd>
          </div>
        </dl>
      </div>
      <div class="arcade-area">
        <p class="arcade-message" aria-hidden="true">
          {g.found} of {g.pairs} pairs found
        </p>
        <div class="sq-fit" style={{ '--ratio': cols / rows }}>
          <div ref={gridRef} class="match-grid" style={{ '--cols': cols, '--rows': rows }} role="group" aria-label={`${cols} by ${rows} cards; arrow keys move between them`} onKeyDown={onKeyDown}>
            {g.cards.map((c, i) => {
              const sym = SYMBOLS[c.symbol]!;
              const up = c.up || c.matched;
              return (
                <button
                  key={i}
                  type="button"
                  class={`match-card${up ? ' is-up' : ''}${c.matched ? ' is-matched' : ''}`}
                  aria-label={up ? `${sym.name}${c.matched ? ', matched' : ''}` : `Card ${i + 1}, face down`}
                  aria-disabled={c.matched}
                  tabIndex={i === focusIdx.current ? 0 : -1}
                  onFocus={() => (focusIdx.current = i)}
                  onClick={() => flip(i)}
                >
                  <span class="match-inner" aria-hidden="true">
                    <span class="match-back" />
                    <span class="match-face" style={{ color: sym.color }}>
                      <svg viewBox="0 0 24 24" fill="currentColor" dangerouslySetInnerHTML={{ __html: sym.svg }} />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {won && (
          <div class="overlay overlay-soft" role="dialog" aria-labelledby="match-won">
            <div class="panel">
              <h2 id="match-won">All pairs found!</h2>
              <p>
                <strong>{g.moves}</strong> moves · {fmt(ms)}
                {best ? ` · Best ${best.moves} moves, ${fmt(best.ms)}` : ''}
              </p>
              <p class="text-sm text-muted mt-1">A perfect memory needs {g.pairs} moves.</p>
              <div class="panel-actions">
                <button type="button" class="btn btn-primary" onClick={() => start()}>
                  Play again
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <p class="sr-only" aria-live="polite">
        {announce}
      </p>
      <noscript dangerouslySetInnerHTML={{ __html: '<p class="noscript">Memory Match needs JavaScript to run. Please enable it to play.</p>' }} />
    </section>
  );
}
