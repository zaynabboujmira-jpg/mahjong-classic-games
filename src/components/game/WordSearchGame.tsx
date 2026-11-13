import { useEffect, useRef, useState } from 'preact/hooks';
import { readJson, writeJson } from '../../engines/core/storage';
import { recordWin } from '../../engines/core/progress';
import { randomSeed } from '../../engines/core/rng';
import { THEMES } from '../../data/word-themes';
import { WS_SIZES, WordSearchGame as Engine, lineBetween, type WsSize } from '../../engines/puzzles/wordsearch';

const COLORS = ['#f59e0b', '#22c55e', '#38bdf8', '#f472b6', '#a78bfa', '#fb7185', '#34d399', '#facc15'];
const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export default function WordSearchGame() {
  const game = useRef(new Engine(10, THEMES[0]!.id, 'preview'));
  const [size, setSize] = useState<WsSize>(10);
  const [theme, setTheme] = useState(THEMES[0]!.id);
  const [, setTick] = useState(0);
  const [drag, setDrag] = useState<{ a: [number, number]; b: [number, number] } | null>(null);
  const [hintCell, setHintCell] = useState<[number, number] | null>(null);
  const [ms, setMs] = useState(0);
  const [best, setBest] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [announce, setAnnounce] = useState('');
  const startedAt = useRef(0);
  const timer = useRef(0);
  const gridRef = useRef<HTMLDivElement>(null);
  const refresh = () => setTick((n) => n + 1);
  const bestKey = (s: WsSize) => `wordsearch:best:${s}`;

  const start = (s: WsSize = size, t = theme) => {
    window.clearInterval(timer.current);
    game.current = new Engine(s, t, randomSeed());
    startedAt.current = 0;
    setSize(s);
    setTheme(t);
    setMs(0);
    setDone(false);
    setDrag(null);
    setHintCell(null);
    setBest(readJson<number | null>(bestKey(s), null));
    writeJson('wordsearch:settings', { size: s, theme: t });
    const name = THEMES.find((x) => x.id === t)!.name;
    setAnnounce(`New ${name} word search, ${s} by ${s}, ${game.current.puzzle.words.length} words.`);
    refresh();
  };

  const cellFrom = (x: number, y: number): [number, number] | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!el?.dataset.r) return null;
    return [Number(el.dataset.r), Number(el.dataset.c)];
  };

  const finishDrag = (a: [number, number], b: [number, number]) => {
    const g = game.current;
    const word = g.select(a, b);
    setDrag(null);
    if (!word) return;
    setHintCell(null);
    setAnnounce(`Found ${word}. ${g.found.size} of ${g.puzzle.words.length}.`);
    if (g.done) {
      window.clearInterval(timer.current);
      const time = Math.round(performance.now() - startedAt.current);
      setMs(time);
      setDone(true);
      recordWin('word-search');
      const prev = readJson<number | null>(bestKey(g.puzzle.size), null);
      if (prev === null || time < prev) {
        writeJson(bestKey(g.puzzle.size), time);
        setBest(time);
      }
      setAnnounce(`All words found in ${fmt(time)}!`);
    }
    refresh();
  };

  const onPointerDown = (e: PointerEvent) => {
    const cell = cellFrom(e.clientX, e.clientY);
    if (!cell || done) return;
    e.preventDefault();
    try {
      gridRef.current!.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic pointer */
    }
    if (!startedAt.current) {
      startedAt.current = performance.now();
      timer.current = window.setInterval(() => setMs(performance.now() - startedAt.current), 500);
    }
    setDrag({ a: cell, b: cell });
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!drag) return;
    const cell = cellFrom(e.clientX, e.clientY);
    if (cell && lineBetween(drag.a, cell)) setDrag({ a: drag.a, b: cell });
  };
  const onPointerUp = () => {
    if (drag) finishDrag(drag.a, drag.b);
  };

  /** Keyboard: arrows move, Enter marks the first and then the last letter. */
  const [cursor, setCursor] = useState<[number, number]>([0, 0]);
  const [anchor, setAnchor] = useState<[number, number] | null>(null);
  const onKeyDown = (e: KeyboardEvent) => {
    const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
    const n = game.current.puzzle.size;
    if (d) {
      e.preventDefault();
      setCursor(([r, c]) => [Math.max(0, Math.min(n - 1, r + d[0]!)), Math.max(0, Math.min(n - 1, c + d[1]!))]);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!startedAt.current) {
        startedAt.current = performance.now();
        timer.current = window.setInterval(() => setMs(performance.now() - startedAt.current), 500);
      }
      if (!anchor) setAnchor(cursor);
      else {
        finishDrag(anchor, cursor);
        setAnchor(null);
      }
    } else if (e.key === 'Escape') setAnchor(null);
  };

  const hint = () => {
    const h = game.current.hint();
    if (!h) return;
    setHintCell(h.cell);
    setAnnounce(`Hint: ${h.word} starts at row ${h.cell[0] + 1}, column ${h.cell[1] + 1}.`);
  };

  useEffect(() => {
    const s = readJson<{ size: WsSize; theme: string }>('wordsearch:settings', { size: 10, theme: THEMES[0]!.id });
    start(WS_SIZES.includes(s.size) ? s.size : 10, THEMES.some((t) => t.id === s.theme) ? s.theme : THEMES[0]!.id);
    return () => window.clearInterval(timer.current);
  }, []);

  const g = game.current;
  const n = g.puzzle.size;
  const sel = drag ? lineBetween(drag.a, drag.b) : anchor ? lineBetween(anchor, cursor) : null;
  const selSet = new Set((sel ?? []).map(([r, c]) => `${r},${c}`));
  const centre = (r: number, c: number) => [((c + 0.5) / n) * 100, ((r + 0.5) / n) * 100];

  return (
    <section class="game" aria-label="Word Search">
      <div class="toolbar" role="toolbar" aria-label="Game controls">
        <button type="button" class="btn btn-primary" onClick={() => start()}>
          New puzzle
        </button>
        <label class="ws-theme">
          <span class="sr-only">Theme</span>
          <select class="btn" value={theme} onChange={(e) => start(size, (e.target as HTMLSelectElement).value)}>
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <div class="segmented" role="radiogroup" aria-label="Grid size">
          {WS_SIZES.map((s) => (
            <button key={s} type="button" role="radio" class="seg" aria-checked={size === s} onClick={() => start(s)}>
              {s}×{s}
            </button>
          ))}
        </div>
        <button type="button" class="btn" onClick={hint} disabled={done}>
          Hint
        </button>
        <dl class="stats">
          <div>
            <dt>Time</dt>
            <dd class="tabular-nums">{fmt(ms)}</dd>
          </div>
          <div>
            <dt>Best</dt>
            <dd class="tabular-nums">{best === null ? '–' : fmt(best)}</dd>
          </div>
        </dl>
      </div>
      <div class="arcade-area ws-area">
        <div class="sq-fit">
          <div
            ref={gridRef}
            class="ws-grid"
            style={{ '--n': n }}
            tabIndex={0}
            role="application"
            aria-roledescription="Word search grid"
            aria-label={`Word search, ${n} by ${n}. Drag from the first to the last letter of a word. With a keyboard, move with the arrows and press Enter on the first and last letters. Row ${cursor[0] + 1}: ${g.puzzle.grid[cursor[0]]!.join(' ')}.`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => setDrag(null)}
            onKeyDown={onKeyDown}
          >
            <svg class="ws-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {g.lines.map((l, i) => {
                const [x1, y1] = centre(...l.cells[0]!);
                const [x2, y2] = centre(...l.cells[l.cells.length - 1]!);
                return <line key={l.word} x1={x1} y1={y1} x2={x2} y2={y2} stroke={COLORS[i % COLORS.length]} stroke-width={(100 / n) * 0.78} stroke-linecap="round" opacity="0.45" />;
              })}
            </svg>
            {g.puzzle.grid.flatMap((row, r) =>
              row.map((ch, c) => (
                <span
                  key={`${r}-${c}`}
                  data-r={r}
                  data-c={c}
                  class={`ws-cell${selSet.has(`${r},${c}`) ? ' is-sel' : ''}${hintCell && hintCell[0] === r && hintCell[1] === c ? ' is-hint' : ''}${cursor[0] === r && cursor[1] === c ? ' is-cursor' : ''}`}
                >
                  {ch.toUpperCase()}
                </span>
              )),
            )}
          </div>
        </div>
        <ul class="ws-words" aria-label="Words to find">
          {g.puzzle.words.map((w) => (
            <li key={w.word} class={g.found.has(w.word) ? 'is-found' : ''}>
              {w.word}
            </li>
          ))}
        </ul>
        {done && (
          <div class="overlay overlay-soft nono-done" role="dialog" aria-labelledby="ws-done">
            <div class="panel">
              <h2 id="ws-done">All words found!</h2>
              <p>
                {n}×{n} in <strong>{fmt(ms)}</strong>
                {best !== null ? ` · Best ${fmt(best)}` : ''}
                {g.hints ? ` · ${g.hints} ${g.hints === 1 ? 'hint' : 'hints'}` : ''}
              </p>
              <div class="panel-actions">
                <button type="button" class="btn btn-primary" onClick={() => start()}>
                  Next puzzle
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <p class="sr-only" aria-live="polite">
        {announce}
      </p>
      <noscript dangerouslySetInnerHTML={{ __html: '<p class="noscript">Word Search needs JavaScript to run. Please enable it to play.</p>' }} />
    </section>
  );
}
