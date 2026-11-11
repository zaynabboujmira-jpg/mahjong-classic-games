import { useEffect, useRef, useState } from 'preact/hooks';
import { randomSeed } from '../../engines/core/rng';
import { readJson, writeJson } from '../../engines/core/storage';
import { Cell, LEVELS, Minesweeper, type LevelId } from '../../engines/minesweeper/game';
import { MinesRenderer, cellAtPoint, displayOf, fitMines, indexAt, type MinesLayout } from '../../engines/minesweeper/render';

interface Props {
  level: LevelId;
  levels: { id: LevelId; name: string }[];
  otherGame: { name: string; href: string };
}

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const LONG_PRESS_MS = 450;
const DOUBLE_TAP_MS = 400;
const KEY_HELP =
  'Arrow keys move between cells, Enter or Space opens a cell, F places or removes a flag, Enter on a number with all its flags placed opens the cells around it.';

interface Press {
  x: number;
  y: number;
  cell: number;
  touch: boolean;
  moved: boolean;
  handled: boolean;
  timer: number;
}

export default function MinesweeperGame({ level, levels, otherGame }: Props) {
  const spec = LEVELS[level];
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<MinesRenderer | null>(null);
  const game = useRef<Minesweeper>(new Minesweeper(spec, 'ssr'));
  const layout = useRef<MinesLayout | null>(null);
  const cursor = useRef(-1);
  const pressed = useRef(new Set<number>());
  const presses = useRef(new Map<number, Press>());
  const twoFinger = useRef<number>(-1);
  const lastTap = useRef({ cell: -1, time: 0 });
  const timer = useRef({ startedAt: 0, banked: 0 });

  const [, setVersion] = useState(0);
  const [flagMode, setFlagMode] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [best, setBest] = useState<number | null>(null);
  const [announce, setAnnounce] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const flagModeRef = useRef(false);

  const bestKey = `mines:best:${level}`;
  const now = () => timer.current.banked + (timer.current.startedAt ? performance.now() - timer.current.startedAt : 0);

  const paint = () => {
    const l = layout.current;
    if (!l || !renderer.current) return;
    renderer.current.draw(game.current, l, { cursor: cursor.current, pressed: pressed.current });
  };

  const fit = () => {
    const el = scrollRef.current;
    if (!el || !renderer.current) return;
    const style = getComputedStyle(el);
    const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const coarse = matchMedia('(pointer: coarse)').matches;
    const l = fitMines(el.clientWidth - padX, el.clientHeight - padY, spec.width, spec.height, coarse ? 28 : 20);
    const prev = layout.current;
    if (!prev || prev.cell !== l.cell || prev.rotated !== l.rotated) renderer.current.resize(l, Math.min(window.devicePixelRatio || 1, 3));
    layout.current = l;
    paint();
  };

  const refresh = () => {
    setVersion((v) => v + 1);
    paint();
  };

  const newGame = () => {
    game.current = new Minesweeper(spec, randomSeed());
    timer.current = { startedAt: 0, banked: 0 };
    cursor.current = -1;
    pressed.current.clear();
    setElapsed(0);
    setRunning(false);
    setDismissed(false);
    setAnnounce(`New ${spec.name} game: ${spec.width} by ${spec.height}, ${spec.mines} mines.`);
    refresh();
  };

  const describe = (i: number) => {
    const g = game.current;
    const { x, y } = { x: (i % g.width) + 1, y: Math.floor(i / g.width) + 1 };
    const st = g.state[i];
    const what = st === Cell.Flagged ? 'flagged' : st === Cell.Hidden ? 'hidden' : g.mines[i] ? 'mine' : g.counts[i] ? String(g.counts[i]) : 'empty';
    return `Row ${y}, column ${x}: ${what}`;
  };

  /** After any action: timer, win or loss, best time, announcement. */
  const after = (msg: string) => {
    const g = game.current;
    if (g.status === 'playing' && !timer.current.startedAt) {
      timer.current.startedAt = performance.now();
      setRunning(true);
    }
    if (g.isOver && timer.current.startedAt) {
      timer.current.banked = now();
      timer.current.startedAt = 0;
      setRunning(false);
      setElapsed(timer.current.banked);
      if (g.status === 'won') {
        const prev = readJson<number | null>(bestKey, null);
        if (prev === null || timer.current.banked < prev) {
          writeJson(bestKey, timer.current.banked);
          setBest(timer.current.banked);
        }
      }
    }
    setAnnounce(g.status === 'won' ? `Cleared! ${fmt(timer.current.banked)}.` : g.status === 'lost' ? 'Boom! You hit a mine.' : msg);
    refresh();
  };

  const reveal = (i: number) => {
    const g = game.current;
    if (g.state[i] === Cell.Revealed) {
      chord(i);
      return;
    }
    const opened = g.reveal(i);
    if (opened.length) after(opened.length > 1 ? `Opened ${opened.length} cells.` : describe(i));
  };

  const flag = (i: number) => {
    const g = game.current;
    if (g.toggleFlag(i)) {
      navigator.vibrate?.(15);
      after(`${g.state[i] === Cell.Flagged ? 'Flagged' : 'Unflagged'}. ${g.minesLeft} mines left.`);
    }
  };

  const chord = (i: number) => {
    const g = game.current;
    if (g.canChord(i)) {
      const opened = g.chord(i);
      after(`Opened ${opened.length} ${opened.length === 1 ? 'cell' : 'cells'} around it.`);
    } else if (g.state[i] === Cell.Revealed && g.counts[i]) {
      setAnnounce(`${describe(i)}. ${g.flagsAround(i)} of ${g.counts[i]} flags placed.`);
    }
  };

  /** A primary tap or click on a cell. */
  const tap = (i: number) => {
    const g = game.current;
    if (g.isOver) return;
    if (g.state[i] === Cell.Revealed) {
      // Double-click / double-tap on a number chords. Only taps on cells that
      // were already open count, so a quick second tap after opening does not.
      const t = performance.now();
      const double = lastTap.current.cell === i && t - lastTap.current.time < DOUBLE_TAP_MS;
      lastTap.current = double ? { cell: -1, time: 0 } : { cell: i, time: t };
      if (double) chord(i);
      return;
    }
    lastTap.current = { cell: -1, time: 0 };
    if (flagModeRef.current) flag(i);
    else if (g.state[i] === Cell.Hidden) reveal(i);
  };

  const cellOf = (e: PointerEvent) => {
    const b = canvasRef.current!.getBoundingClientRect();
    return layout.current ? cellAtPoint(layout.current, game.current, e.clientX - b.left, e.clientY - b.top) : -1;
  };

  const onPointerDown = (e: PointerEvent) => {
    const i = cellOf(e);
    if (i < 0 || game.current.isOver) return;
    cursor.current = -1;
    if (e.pointerType === 'mouse' && e.button === 2) {
      flag(i);
      return;
    }
    const touch = e.pointerType !== 'mouse';
    const press: Press = { x: e.clientX, y: e.clientY, cell: i, touch, moved: false, handled: false, timer: 0 };
    // A second finger shortly after the first: two-finger tap chords the first finger's cell.
    if (touch && presses.current.size === 1) {
      const first = [...presses.current.values()][0]!;
      window.clearTimeout(first.timer);
      if (!first.moved) twoFinger.current = first.cell;
      press.handled = true;
      first.handled = true;
    } else if (touch) {
      press.timer = window.setTimeout(() => {
        if (press.moved || press.handled) return;
        press.handled = true;
        pressed.current.clear();
        const g = game.current;
        if (g.state[i] === Cell.Revealed) chord(i);
        else flag(i);
      }, LONG_PRESS_MS);
    }
    presses.current.set(e.pointerId, press);
    if (e.button === 0 && game.current.state[i] === Cell.Hidden && !flagModeRef.current) {
      pressed.current = new Set([i]);
      paint();
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    const p = presses.current.get(e.pointerId);
    if (!p || p.moved) return;
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) {
      p.moved = true;
      window.clearTimeout(p.timer);
      pressed.current.clear();
      paint();
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    const p = presses.current.get(e.pointerId);
    presses.current.delete(e.pointerId);
    pressed.current.clear();
    if (!p) return;
    window.clearTimeout(p.timer);
    if (twoFinger.current >= 0) {
      const cell = twoFinger.current;
      twoFinger.current = -1;
      chord(cell);
      paint();
      return;
    }
    if (p.handled || p.moved) {
      paint();
      return;
    }
    if (e.pointerType === 'mouse' && e.button === 1) chord(p.cell);
    else if (e.button === 0 || p.touch) tap(p.cell);
    paint();
  };

  const onPointerCancel = (e: PointerEvent) => {
    const p = presses.current.get(e.pointerId);
    if (p) window.clearTimeout(p.timer);
    presses.current.delete(e.pointerId);
    twoFinger.current = -1;
    pressed.current.clear();
    paint();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const g = game.current;
    const l = layout.current;
    if (!l || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    const cur = cursor.current < 0 ? indexAt(l, g, Math.floor(l.cols / 2), Math.floor(l.rows / 2)) : cursor.current;
    const { col, row } = displayOf(l, g, cur);
    const moveTo = (c: number, r: number) => {
      e.preventDefault();
      cursor.current = indexAt(l, g, Math.min(l.cols - 1, Math.max(0, c)), Math.min(l.rows - 1, Math.max(0, r)));
      setAnnounce(describe(cursor.current));
      paint();
    };
    if (k === 'ArrowLeft') moveTo(col - 1, row);
    else if (k === 'ArrowRight') moveTo(col + 1, row);
    else if (k === 'ArrowUp') moveTo(col, row - 1);
    else if (k === 'ArrowDown') moveTo(col, row + 1);
    else if (k === 'Enter' || k === ' ') {
      e.preventDefault();
      cursor.current = cur;
      if (!g.isOver) reveal(cur);
      paint();
    } else if (k === 'f' || k === 'F') {
      cursor.current = cur;
      flag(cur);
    } else if (k === 'c' || k === 'C') {
      cursor.current = cur;
      chord(cur);
      paint();
    }
  };

  useEffect(() => {
    renderer.current = new MinesRenderer(canvasRef.current!);
    setBest(readJson<number | null>(bestKey, null));
    const settings = readJson<{ flagMode?: boolean }>('mines:settings', {});
    if (settings.flagMode) {
      flagModeRef.current = true;
      setFlagMode(true);
    }
    game.current = new Minesweeper(spec, randomSeed());
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(scrollRef.current!);
    window.addEventListener('resize', fit);
    const onVisibility = () => {
      const g = game.current;
      if (document.hidden && timer.current.startedAt) {
        timer.current.banked = now();
        timer.current.startedAt = 0;
      } else if (!document.hidden && g.status === 'playing' && !timer.current.startedAt) {
        timer.current.startedAt = performance.now();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', fit);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setElapsed(now()), 250);
    return () => window.clearInterval(id);
  }, [running]);

  const toggleFlagMode = () => {
    const on = !flagModeRef.current;
    flagModeRef.current = on;
    setFlagMode(on);
    writeJson('mines:settings', { flagMode: on });
    setAnnounce(on ? 'Flag mode on: taps place flags.' : 'Flag mode off: taps open cells.');
  };

  const g = game.current;
  return (
    <section class="game" aria-label={`Minesweeper, ${spec.name}`}>
      <div class="toolbar" role="toolbar" aria-label="Game controls">
        <button type="button" class="btn" onClick={newGame}>
          New game
        </button>
        <button type="button" class="btn" aria-pressed={flagMode} onClick={toggleFlagMode} title="When on, a tap places a flag instead of opening">
          Flag mode {flagMode ? 'on' : 'off'}
        </button>
        <nav class="segmented" aria-label="Difficulty">
          {levels.map((l) => (
            <a key={l.id} class="seg" href={`/minesweeper/${l.id}/`} aria-current={l.id === level ? 'page' : undefined}>
              {l.name}
            </a>
          ))}
        </nav>
        <dl class="stats">
          <div>
            <dt>Mines</dt>
            <dd class="mines-counter">{g.minesLeft}</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd class="tabular-nums">{fmt(elapsed)}</dd>
          </div>
        </dl>
      </div>

      <div class="mines-area">
        <div ref={scrollRef} class="mines-scroll">
          <canvas
            ref={canvasRef}
            class="board mines-board"
            tabIndex={0}
            role="application"
            aria-roledescription="Minefield"
            aria-label={`Minefield, ${spec.width} by ${spec.height} with ${spec.mines} mines. ${KEY_HELP}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onContextMenu={(e) => e.preventDefault()}
            onKeyDown={onKeyDown}
          />
        </div>
        {g.isOver && !dismissed && (
          <div class="overlay overlay-soft" role="dialog" aria-modal="false" aria-labelledby="end-title">
            <div class="panel">
              <h2 id="end-title">{g.status === 'won' ? 'Field cleared!' : 'Boom!'}</h2>
              <p>
                {g.status === 'won' ? (
                  <>
                    {spec.name} in <strong>{fmt(elapsed)}</strong>
                    {best !== null && <> · Best {fmt(best)}</>}
                  </>
                ) : (
                  'You opened a mine. Wrong flags are crossed out.'
                )}
              </p>
              <div class="panel-actions">
                <button type="button" class="btn btn-primary" onClick={newGame}>
                  {g.status === 'won' ? 'Play again' : 'Try again'}
                </button>
                <button type="button" class="btn" onClick={() => setDismissed(true)}>
                  View board
                </button>
                <a class="btn" href={otherGame.href}>
                  {otherGame.name}
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
      <p class="sr-only" aria-live="polite">
        {announce}
      </p>
      {/* Raw HTML: browsers with JS never parse noscript children, so hydration must not diff them. */}
      <noscript dangerouslySetInnerHTML={{ __html: '<p class="noscript">Minesweeper needs JavaScript to run. Please enable it to play.</p>' }} />
    </section>
  );
}
