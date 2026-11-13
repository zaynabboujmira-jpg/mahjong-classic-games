import { useEffect, useRef, useState } from 'preact/hooks';
import { randomSeed } from '../../engines/core/rng';
import { readJson, writeJson } from '../../engines/core/storage';
import { recordWin } from '../../engines/core/progress';
import { swipeOf } from '../../engines/arcade/input';
import { MergeGame, SIZES, type Dir, type MergeSize, type Tile } from '../../engines/puzzles/merge';

const KEYS: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
};
const SLIDE_MS = 110;

/** Original palette: cool greens and blues for small tiles, warm golds and corals for big ones. */
function tileStyle(v: number) {
  const k = Math.log2(v);
  const hues = [0, 0, 168, 176, 190, 205, 220, 262, 290, 320, 345, 18, 38, 48];
  const hue = hues[Math.min(k, hues.length - 1)] ?? 48;
  const light = k <= 2 ? 88 - k * 4 : Math.max(38, 62 - (k % 4) * 4);
  return { background: `hsl(${hue} ${k <= 2 ? 45 : 70}% ${light}%)`, color: light > 70 ? '#12332b' : '#ffffff' };
}

export default function NumberMergeGame() {
  const game = useRef<MergeGame>(new MergeGame(4, 'preview'));
  const [size, setSize] = useState<MergeSize>(4);
  const [, setTick] = useState(0);
  const [ghosts, setGhosts] = useState<Tile[]>([]);
  const [best, setBest] = useState(0);
  const [panel, setPanel] = useState<'none' | 'won' | 'over'>('none');
  const [kept, setKept] = useState(false);
  const [announce, setAnnounce] = useState('');
  const boardRef = useRef<HTMLDivElement>(null);
  const down = useRef<{ x: number; y: number; id: number } | null>(null);
  const busy = useRef(0);

  const bestKey = (s: MergeSize) => `merge:best:${s}`;
  const refresh = () => setTick((n) => n + 1);

  const start = (s: MergeSize = size) => {
    game.current = new MergeGame(s, randomSeed());
    setSize(s);
    setBest(readJson<number>(bestKey(s), 0));
    setPanel('none');
    setKept(false);
    setGhosts([]);
    writeJson('merge:size', s);
    setAnnounce(`New ${s} by ${s} game. Swipe or use the arrow keys to slide the tiles.`);
    refresh();
    boardRef.current?.focus();
  };

  const move = (d: Dir) => {
    const g = game.current;
    if (panel !== 'none') return;
    const wasWon = g.won;
    const res = g.move(d);
    if (!res.moved) return;
    setGhosts(res.gone);
    window.clearTimeout(busy.current);
    busy.current = window.setTimeout(() => setGhosts([]), SLIDE_MS + 20);
    if (g.score > readJson<number>(bestKey(g.size), 0)) {
      writeJson(bestKey(g.size), g.score);
      setBest(g.score);
    }
    if (!wasWon && g.won && !kept) {
      recordWin('number-merge');
      setPanel('won');
      setAnnounce(`You made the ${g.target} tile! Score ${g.score}.`);
    } else if (g.over) {
      setPanel('over');
      setAnnounce(`No moves left. Final score ${g.score}. Highest tile ${g.best}.`);
    } else if (res.merges) setAnnounce(`Score ${g.score}. Highest tile ${g.best}.`);
    refresh();
  };

  const undo = () => {
    if (game.current.undo()) {
      setPanel('none');
      setGhosts([]);
      setAnnounce('Move taken back.');
      refresh();
    }
  };

  useEffect(() => {
    const s = readJson<number>('merge:size', 4) as MergeSize;
    start(SIZES.includes(s) ? s : 4);
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const d = KEYS[k];
      if (d) {
        e.preventDefault();
        moveRef.current(d);
      } else if (k === 'z' || k === 'u') undoRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // Keep the key handler pointing at the latest closures.
  const moveRef = useRef(move);
  const undoRef = useRef(undo);
  moveRef.current = move;
  undoRef.current = undo;

  const g = game.current;
  const n = g.size;
  const all = [...ghosts.map((t) => ({ ...t, ghost: true })), ...g.tiles.map((t) => ({ ...t, ghost: false }))];

  return (
    <section class="game" aria-label="Number Merge">
      <div class="toolbar" role="toolbar" aria-label="Game controls">
        <button type="button" class="btn btn-primary" onClick={() => start()}>
          New game
        </button>
        <button type="button" class="btn" onClick={undo} disabled={!g.canUndo}>
          Undo
        </button>
        <div class="segmented" role="radiogroup" aria-label="Board size">
          {SIZES.map((s) => (
            <button key={s} type="button" role="radio" class="seg" aria-checked={size === s} onClick={() => start(s)}>
              {s}×{s}
            </button>
          ))}
        </div>
        <dl class="stats">
          <div>
            <dt>Score</dt>
            <dd class="tabular-nums">{g.score}</dd>
          </div>
          <div>
            <dt>Best</dt>
            <dd class="tabular-nums">{Math.max(best, g.score)}</dd>
          </div>
        </dl>
      </div>
      <div class="arcade-area">
        <p class="arcade-message" aria-hidden="true">
          Join the numbers to reach <strong>{g.target}</strong>
        </p>
        <div class="sq-fit">
          <div
            ref={boardRef}
            class="merge-board"
            style={{ '--n': n }}
            tabIndex={0}
            role="application"
            aria-roledescription="Number Merge board"
            aria-label={`Number Merge, ${n} by ${n}. Arrow keys or WASD slide the tiles; Z undoes. Rows: ${g
              .grid()
              .map((r) => r.map((v) => v || 'empty').join(' '))
              .join('; ')}.`}
            onPointerDown={(e) => {
              down.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
              try {
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              } catch {
                /* synthetic pointer */
              }
            }}
            onPointerUp={(e) => {
              const d = down.current;
              down.current = null;
              if (!d || d.id !== e.pointerId) return;
              const sw = swipeOf(d.x, d.y, e.clientX, e.clientY, 20);
              if (sw) move(sw);
            }}
            onPointerCancel={() => (down.current = null)}
          >
            {Array.from({ length: n * n }, (_, i) => (
              <div key={`c${i}`} class="merge-cell" style={{ '--r': Math.floor(i / n), '--c': i % n }} />
            ))}
            {all.map((t) => (
              <div
                key={t.id}
                class={`merge-tile${t.isNew ? ' is-new' : ''}${t.merged ? ' is-merged' : ''}${t.value >= 1000 ? ' is-long' : ''}`}
                style={{ '--r': t.r, '--c': t.c, ...tileStyle(t.value), zIndex: t.ghost ? 1 : 2 }}
              >
                {t.value}
              </div>
            ))}
          </div>
        </div>
        {panel !== 'none' && (
          <div class="overlay overlay-soft" role="dialog" aria-labelledby="merge-panel">
            <div class="panel">
              <h2 id="merge-panel">{panel === 'won' ? `You made ${g.target}!` : 'No moves left'}</h2>
              <p>
                Score <strong>{g.score}</strong> · Highest tile {g.best} · Best {Math.max(best, g.score)}
              </p>
              <div class="panel-actions">
                {panel === 'won' ? (
                  <button
                    type="button"
                    class="btn btn-primary"
                    onClick={() => {
                      setKept(true);
                      setPanel('none');
                      boardRef.current?.focus();
                    }}
                  >
                    Keep going
                  </button>
                ) : (
                  <button type="button" class="btn" onClick={undo} disabled={!g.canUndo}>
                    Undo last move
                  </button>
                )}
                <button type="button" class={panel === 'won' ? 'btn' : 'btn btn-primary'} onClick={() => start()}>
                  New game
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <p class="sr-only" aria-live="polite">
        {announce}
      </p>
      <noscript dangerouslySetInnerHTML={{ __html: '<p class="noscript">Number Merge needs JavaScript to run. Please enable it to play.</p>' }} />
    </section>
  );
}
