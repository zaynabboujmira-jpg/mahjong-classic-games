import { useEffect, useRef, useState } from 'preact/hooks';
import { readJson, writeJson } from '../../engines/core/storage';
import { recordWin } from '../../engines/core/progress';
import { CROSSED, EMPTY, FILLED, NONO_SIZES, NonogramGame as Nonogram, type Cell, type NonoSize } from '../../engines/puzzles/nonogram';

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const newNumber = () => String(1 + Math.floor(Math.random() * 99999));
const validNumber = (s: string | null) => !!s && /^[a-z0-9]{1,12}$/i.test(s);

export default function NonogramGame() {
  const game = useRef<Nonogram>(new Nonogram(5, '1'));
  const [size, setSize] = useState<NonoSize>(5);
  const [, setTick] = useState(0);
  const [mode, setMode] = useState<'fill' | 'cross'>('fill');
  const [ms, setMs] = useState(0);
  const [best, setBest] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);
  const [wrong, setWrong] = useState<Set<number>>(new Set());
  const [cursor, setCursor] = useState(0);
  const [announce, setAnnounce] = useState('');
  const startedAt = useRef(0);
  const timer = useRef(0);
  const flash = useRef(0);
  const drag = useRef<{ target: Cell; from: Cell; r0: number; c0: number; axis: 'r' | 'c' | null; id: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const bestKey = (s: NonoSize) => `nonogram:best:${s}`;
  const refresh = () => setTick((n) => n + 1);

  const start = (s: NonoSize = size, seed = newNumber()) => {
    window.clearInterval(timer.current);
    game.current = new Nonogram(s, seed);
    startedAt.current = 0;
    setSize(s);
    setMs(0);
    setSolved(false);
    setWrong(new Set());
    setCursor(0);
    setBest(readJson<number | null>(bestKey(s), null));
    writeJson('nonogram:size', s);
    const url = new URL(location.href);
    url.searchParams.set('size', String(s));
    url.searchParams.set('puzzle', seed);
    history.replaceState(null, '', url);
    setAnnounce(`Puzzle ${seed}, ${s} by ${s}. Fill cells to match the clues.`);
    refresh();
  };

  const tickClock = () => {
    if (startedAt.current) return;
    startedAt.current = performance.now();
    timer.current = window.setInterval(() => setMs(performance.now() - startedAt.current), 500);
  };

  const finishIfSolved = () => {
    const g = game.current;
    if (!g.solved) return;
    window.clearInterval(timer.current);
    const time = Math.round(performance.now() - startedAt.current);
    setMs(time);
    setSolved(true);
    recordWin('nonogram');
    const prev = readJson<number | null>(bestKey(g.size), null);
    if (prev === null || time < prev) {
      writeJson(bestKey(g.size), time);
      setBest(time);
    }
    // Cross the remaining cells so the picture stands out.
    g.cells.forEach((row, r) => row.forEach((v, c) => v === EMPTY && g.set(r, c, CROSSED)));
    setAnnounce(`Solved in ${fmt(time)}!`);
  };

  const paint = (r: number, c: number) => {
    const d = drag.current;
    const g = game.current;
    if (!d || solved) return;
    if (g.cells[r]![c] !== d.from) return;
    g.set(r, c, d.target);
    if (wrong.size) setWrong(new Set());
    refresh();
  };

  /** Starting a stroke decides what it does: fill (or cross) cells like the first one, or clear them. */
  const begin = (r: number, c: number, crossing: boolean, id: number) => {
    if (solved) return;
    tickClock();
    const v = game.current.cells[r]![c]!;
    const want: Cell = crossing ? CROSSED : FILLED;
    drag.current = { target: v === want ? EMPTY : want, from: v, r0: r, c0: c, axis: null, id };
    paint(r, c);
  };

  const cellAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const r = el?.dataset.r;
    const c = el?.dataset.c;
    return r !== undefined && c !== undefined ? [Number(r), Number(c)] as const : null;
  };

  const onPointerDown = (e: PointerEvent) => {
    const t = e.target as HTMLElement;
    if (t.dataset.r === undefined) return;
    e.preventDefault();
    try {
      gridRef.current!.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic pointer */
    }
    const r = Number(t.dataset.r);
    const c = Number(t.dataset.c);
    setCursor(r * size + c);
    begin(r, c, mode === 'cross' || e.button === 2, e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const hit = cellAt(e.clientX, e.clientY);
    if (!hit) return;
    let [r, c] = hit;
    // Lock a stroke to its row or column, so a shaky finger stays in line.
    if (!d.axis && (r !== d.r0 || c !== d.c0)) d.axis = Math.abs(r - d.r0) >= Math.abs(c - d.c0) ? 'c' : 'r';
    if (d.axis === 'r') r = d.r0;
    if (d.axis === 'c') c = d.c0;
    paint(r, c);
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    drag.current = null;
    finishIfSolved();
    refresh();
  };

  const toggleAt = (i: number, crossing: boolean) => {
    begin(Math.floor(i / size), i % size, crossing, -1);
    onPointerUp();
  };

  const check = () => {
    const m = game.current.mistakes();
    setWrong(new Set(m.map(([r, c]) => r * size + c)));
    window.clearTimeout(flash.current);
    flash.current = window.setTimeout(() => setWrong(new Set()), 2500);
    setAnnounce(m.length ? `${m.length} ${m.length === 1 ? 'mistake' : 'mistakes'} shown in red.` : 'No mistakes so far.');
  };

  const clear = () => {
    const g = game.current;
    g.cells.forEach((row, r) => row.forEach((_, c) => g.set(r, c, EMPTY)));
    setWrong(new Set());
    refresh();
  };

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const qs = Number(q.get('size')) as NonoSize;
    const s = NONO_SIZES.includes(qs) ? qs : (readJson<number>('nonogram:size', 5) as NonoSize);
    start(NONO_SIZES.includes(s) ? s : 5, validNumber(q.get('puzzle')) ? q.get('puzzle')! : newNumber());
    return () => {
      window.clearInterval(timer.current);
      window.clearTimeout(flash.current);
    };
  }, []);

  const onKeyDown = (e: KeyboardEvent) => {
    const n = size;
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -n, ArrowDown: n };
    if (e.key in moves) {
      e.preventDefault();
      const d = moves[e.key]!;
      const next = cursor + d;
      if (next < 0 || next >= n * n || (Math.abs(d) === 1 && Math.floor(next / n) !== Math.floor(cursor / n))) return;
      setCursor(next);
    } else if (e.key === ' ' || e.key === 'Enter' || e.key === 'f') {
      e.preventDefault();
      toggleAt(cursor, mode === 'cross');
    } else if (e.key === 'x') {
      e.preventDefault();
      toggleAt(cursor, true);
    }
  };

  const g = game.current;
  const { rows, cols } = g.puzzle;
  const cw = Math.max(...rows.map((x) => x.length));
  const ch = Math.max(...cols.map((x) => x.length));
  const cr = Math.floor(cursor / size);
  const cc = cursor % size;
  const stateName = (v: Cell) => (v === FILLED ? 'filled' : v === CROSSED ? 'crossed' : 'empty');

  return (
    <section class="game" aria-label="Nonogram">
      <div class="toolbar" role="toolbar" aria-label="Game controls">
        <button type="button" class="btn btn-primary" onClick={() => start()}>
          New puzzle
        </button>
        <div class="segmented" role="radiogroup" aria-label="Size">
          {NONO_SIZES.map((s) => (
            <button key={s} type="button" role="radio" class="seg" aria-checked={size === s} onClick={() => start(s)}>
              {s}×{s}
            </button>
          ))}
        </div>
        <div class="segmented" role="radiogroup" aria-label="Tap mode">
          <button type="button" role="radio" class="seg" aria-checked={mode === 'fill'} onClick={() => setMode('fill')}>
            ■ Fill
          </button>
          <button type="button" role="radio" class="seg" aria-checked={mode === 'cross'} onClick={() => setMode('cross')}>
            ✕ Mark
          </button>
        </div>
        <button type="button" class="btn" onClick={check} disabled={solved}>
          Check
        </button>
        <button type="button" class="btn" onClick={clear} disabled={solved}>
          Clear
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
      <div class="arcade-area nono-area">
        <p class="arcade-message" aria-hidden="true">
          Puzzle #{g.puzzle.seed} · {mode === 'fill' ? 'Tap or drag to fill' : 'Tap or drag to mark empty cells'}
        </p>
        <div class="sq-fit" style={{ '--ratio': (cw + size) / (ch + size) }}>
          <div
            ref={gridRef}
            class={`nono-grid${solved ? ' is-solved' : ''}`}
            style={{ '--n': size, '--cw': cw, '--ch': ch }}
            tabIndex={0}
            role="application"
            aria-roledescription="Nonogram grid"
            aria-label={`Nonogram ${size} by ${size}. Arrow keys move, Space fills, X marks. Row ${cr + 1}, column ${cc + 1}: ${stateName(g.cells[cr]![cc]!)}. Row clue ${rows[cr]!.join(' ')}, column clue ${cols[cc]!.join(' ')}.`}
            onKeyDown={onKeyDown}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div class="nono-corner" />
            <div class="nono-cols">
              {cols.map((clue, c) => (
                <div key={c} class={`nono-clue nono-col${g.colDone(c) ? ' is-done' : ''}${c === cc ? ' is-cur' : ''}`}>
                  {clue.map((x, i) => (
                    <span key={i}>{x}</span>
                  ))}
                </div>
              ))}
            </div>
            <div class="nono-rows">
              {rows.map((clue, r) => (
                <div key={r} class={`nono-clue nono-row${g.rowDone(r) ? ' is-done' : ''}${r === cr ? ' is-cur' : ''}`}>
                  {clue.map((x, i) => (
                    <span key={i}>{x}</span>
                  ))}
                </div>
              ))}
            </div>
            <div class="nono-cells">
              {g.cells.flatMap((row, r) =>
                row.map((v, c) => {
                  const i = r * size + c;
                  const cls = `nono-cell${v === FILLED ? ' is-filled' : v === CROSSED ? ' is-crossed' : ''}${wrong.has(i) ? ' is-wrong' : ''}${i === cursor ? ' is-cursor' : ''}${c % 5 === 4 && c < size - 1 ? ' edge-r' : ''}${r % 5 === 4 && r < size - 1 ? ' edge-b' : ''}`;
                  return <div key={i} class={cls} data-r={r} data-c={c} />;
                }),
              )}
            </div>
          </div>
        </div>
        {solved && (
          <div class="overlay overlay-soft nono-done" role="dialog" aria-labelledby="nono-won">
            <div class="panel">
              <h2 id="nono-won">Solved!</h2>
              <p>
                Puzzle #{g.puzzle.seed} · {size}×{size} in <strong>{fmt(ms)}</strong>
                {best !== null ? ` · Best ${fmt(best)}` : ''}
              </p>
              <div class="panel-actions">
                <button type="button" class="btn btn-primary" onClick={() => start()}>
                  Next puzzle
                </button>
                {size < 15 && (
                  <button type="button" class="btn" onClick={() => start((size === 5 ? 10 : 15) as NonoSize)}>
                    Try {size === 5 ? 10 : 15}×{size === 5 ? 10 : 15}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      <p class="sr-only" aria-live="polite">
        {announce}
      </p>
      <noscript dangerouslySetInnerHTML={{ __html: '<p class="noscript">Nonogram needs JavaScript to run. Please enable it to play.</p>' }} />
    </section>
  );
}
