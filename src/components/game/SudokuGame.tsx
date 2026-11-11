import { useEffect, useRef, useState } from 'preact/hooks';
import { randomSeed } from '../../engines/core/rng';
import { readJson, writeJson } from '../../engines/core/storage';
import { SudokuGame as Game, type HintResult } from '../../engines/sudoku/game';
import type { Difficulty, Puzzle } from '../../engines/sudoku/generator';
import { CELLS, CellName, bit, cellName, colOf, digitsOf, rowOf } from '../../engines/sudoku/grid';
import { SudokuRenderer } from '../../engines/sudoku/render';
import { PuzzleSource } from '../../engines/sudoku/source';

interface Props {
  difficulty: Difficulty;
  levels: { id: Difficulty; name: string }[];
  otherGame: { name: string; href: string };
}

interface Saved {
  seed: string;
  state: ReturnType<Game['serialize']>;
  elapsed: number;
}

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const validSeed = (s: string) => /^[a-z0-9]{1,16}$/i.test(s);
const MAX_BOARD = 560;

const KEY_HELP =
  'Arrow keys move between cells, 1 to 9 enter a digit, Shift with a digit or N for notes mode adds pencil marks, 0 or Delete erases, H gives a hint, Control+Z undoes.';

export default function SudokuGame({ difficulty, levels, otherGame }: Props) {
  const fitRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<SudokuRenderer | null>(null);
  const source = useRef<PuzzleSource | null>(null);
  const game = useRef<Game | null>(null);
  const puzzle = useRef<Puzzle | null>(null);
  const nextSeed = useRef('');
  const loadingSeed = useRef('');
  const timer = useRef({ startedAt: 0, banked: 0 });
  const hint = useRef<HintResult | null>(null);
  const keyboard = useRef(false);
  const wonRef = useRef(false);

  const [selected, setSelected] = useState(-1);
  const [notesMode, setNotesMode] = useState(false);
  const [check, setCheck] = useState(true);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [announce, setAnnounce] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [won, setWon] = useState(false);
  const [best, setBest] = useState<number | null>(null);
  const [, setVersion] = useState(0);
  const selRef = useRef(-1);
  const checkRef = useRef(true);

  const progressKey = `sudoku:progress:${difficulty}`;
  const bestKey = `sudoku:best:${difficulty}`;
  const now = () => timer.current.banked + (timer.current.startedAt ? performance.now() - timer.current.startedAt : 0);

  const paint = () => {
    const g = game.current;
    const r = renderer.current;
    if (!r || !r.size) return;
    const bad = new Set<number>();
    if (g) {
      for (const i of g.conflicts()) bad.add(i);
      if (checkRef.current) for (let i = 0; i < CELLS; i++) if (g.isWrong(i)) bad.add(i);
    }
    r.draw({
      values: g?.values ?? new Array<number>(CELLS).fill(0),
      notes: g?.notes ?? new Array<number>(CELLS).fill(0),
      isGiven: (i) => !!g?.isGiven(i),
      bad,
      selected: selRef.current,
      hint: hint.current && hint.current.kind !== 'none' ? hint.current.cell : -1,
      focusRing: keyboard.current,
    });
  };

  const fit = () => {
    const el = fitRef.current;
    const r = renderer.current;
    if (!el || !r) return;
    const size = Math.floor(Math.min(el.clientWidth, el.clientHeight, MAX_BOARD));
    if (size > 0 && size !== r.size) r.resize(size, Math.min(window.devicePixelRatio || 1, 3));
    paint();
  };

  const save = () => {
    const g = game.current;
    if (!g || wonRef.current || !puzzle.current) return;
    writeJson(progressKey, { seed: puzzle.current.seed, state: g.serialize(), elapsed: now() } satisfies Saved);
  };

  const select = (i: number) => {
    selRef.current = i;
    setSelected(i);
    const g = game.current;
    if (g && i >= 0) {
      const v = g.values[i]!;
      const notes = g.notes[i] ? `, notes ${digitsOf(g.notes[i]!).join(' ')}` : '';
      setAnnounce(`${CellName(i)}: ${v ? `${v}${g.isGiven(i) ? ', given' : ''}` : 'empty'}${notes}`);
    }
    paint();
  };

  const startClock = () => {
    if (!timer.current.startedAt) timer.current.startedAt = performance.now();
    setRunning(true);
  };

  const begin = (p: Puzzle, resume: Saved | null) => {
    puzzle.current = p;
    const g = new Game(p.givens, p.solution);
    let banked = 0;
    if (resume && g.restore(resume.state) && !g.isWon) banked = resume.elapsed;
    game.current = g;
    hint.current = null;
    wonRef.current = false;
    timer.current = { startedAt: 0, banked };
    setWon(false);
    setElapsed(banked);
    setMessage(banked ? 'Welcome back: your progress was restored.' : '');
    setBest(readJson<number | null>(bestKey, null));
    selRef.current = -1;
    setSelected(-1);
    const url = new URL(location.href);
    url.searchParams.set('puzzle', p.seed);
    history.replaceState(null, '', url);
    setLoading(false);
    startClock();
    setVersion((v) => v + 1);
    paint();
    // Prepare the next puzzle in the background so "New game" is instant.
    nextSeed.current = randomSeed();
    void source.current?.get(difficulty, nextSeed.current);
  };

  const load = (seed: string, resume: Saved | null) => {
    loadingSeed.current = seed;
    setLoading(true);
    setRunning(false);
    void source.current!.get(difficulty, seed).then((p) => {
      if (loadingSeed.current === seed) begin(p, resume);
    });
  };

  const newGame = () => {
    writeJson(progressKey, null);
    load(nextSeed.current || randomSeed(), null);
  };

  const restart = () => {
    if (!puzzle.current) return;
    writeJson(progressKey, null);
    begin(puzzle.current, null);
    setAnnounce('Puzzle restarted.');
  };

  /** Call after every change to the grid. */
  const after = (msg: string) => {
    const g = game.current!;
    hint.current = null;
    setMessage('');
    setAnnounce(msg);
    if (g.isWon && !wonRef.current) {
      wonRef.current = true;
      timer.current.banked = now();
      timer.current.startedAt = 0;
      setRunning(false);
      const time = timer.current.banked;
      setElapsed(time);
      const prev = readJson<number | null>(bestKey, null);
      if (prev === null || time < prev) {
        writeJson(bestKey, time);
        setBest(time);
      }
      writeJson(progressKey, null);
      setWon(true);
      setAnnounce(`Solved in ${fmt(time)}!`);
    } else save();
    setVersion((v) => v + 1);
    paint();
  };

  const input = (digit: number, asNote = notesMode) => {
    const g = game.current;
    const i = selRef.current;
    if (!g || loading || wonRef.current) return;
    if (i < 0) {
      setAnnounce('Select a cell first.');
      setMessage('Select a cell first.');
      return;
    }
    if (g.isGiven(i)) {
      setAnnounce('That cell is a given clue.');
      return;
    }
    if (asNote) {
      if (g.values[i]) {
        setAnnounce('Erase the digit before adding notes.');
        return;
      }
      g.toggleNote(i, digit);
      after(`${g.notes[i]! & bit(digit) ? 'Added' : 'Removed'} note ${digit}.`);
      return;
    }
    const had = g.values[i] === digit;
    g.setValue(i, digit);
    const wrong = checkRef.current && g.isWrong(i);
    after(had ? `Cleared ${cellName(i)}.` : `${digit} at ${cellName(i)}${wrong ? ', which is not right' : ''}.`);
  };

  const erase = () => {
    const g = game.current;
    const i = selRef.current;
    if (!g || i < 0 || wonRef.current) return;
    if (g.erase(i)) after(`Erased ${cellName(i)}.`);
  };

  const undo = () => {
    const g = game.current;
    if (!g || wonRef.current) return;
    if (g.undo()) after('Undone.');
  };

  const showHint = () => {
    const g = game.current;
    if (!g || loading || wonRef.current) return;
    const h = hint.current;
    if (h && h.kind !== 'none') {
      g.applyHint(h);
      selRef.current = h.cell;
      setSelected(h.cell);
      after(h.kind === 'wrong' ? `Cleared the wrong digit at ${cellName(h.cell)}.` : `Placed ${h.digit} at ${cellName(h.cell)}.`);
      return;
    }
    const next = g.hint();
    hint.current = next;
    if (next.kind !== 'none') {
      selRef.current = next.cell;
      setSelected(next.cell);
    }
    setMessage(`${next.message}${next.kind !== 'none' ? ' Press Fill to apply it.' : ''}`);
    setAnnounce(`Hint: ${next.message}`);
    setVersion((v) => v + 1);
    paint();
  };

  const fillNotes = () => {
    const g = game.current;
    if (!g || wonRef.current) return;
    if (g.fillNotes()) after('Notes filled in for every empty cell.');
  };

  const toggleCheck = (on: boolean) => {
    checkRef.current = on;
    setCheck(on);
    writeJson('sudoku:settings', { check: on });
    paint();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    const k = e.key;
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const i = selRef.current;
    const move = (dr: number, dc: number) => {
      e.preventDefault();
      keyboard.current = true;
      const base = i < 0 ? 40 : i;
      const r = (rowOf(base) + dr + 9) % 9;
      const c = (colOf(base) + dc + 9) % 9;
      select(i < 0 ? 40 : r * 9 + c);
    };
    if (k === 'ArrowUp') move(-1, 0);
    else if (k === 'ArrowDown') move(1, 0);
    else if (k === 'ArrowLeft') move(0, -1);
    else if (k === 'ArrowRight') move(0, 1);
    else if (/^Digit[1-9]$/.test(e.code) || /^Numpad[1-9]$/.test(e.code)) {
      e.preventDefault();
      input(Number(e.code.slice(-1)), notesMode || e.shiftKey);
    } else if (k === '0' || k === 'Delete' || k === 'Backspace') {
      e.preventDefault();
      erase();
    } else if (k === 'n' || k === 'N') {
      setNotesMode(!notesMode);
      setAnnounce(`Notes mode ${notesMode ? 'off' : 'on'}.`);
    } else if (k === 'h' || k === 'H') showHint();
  };

  useEffect(() => {
    renderer.current = new SudokuRenderer(canvasRef.current!);
    source.current = new PuzzleSource();
    const settings = readJson<{ check?: boolean }>('sudoku:settings', {});
    if (settings.check === false) {
      checkRef.current = false;
      setCheck(false);
    }
    const urlSeed = new URLSearchParams(location.search).get('puzzle');
    const saved = readJson<Saved | null>(progressKey, null);
    const seed = urlSeed && validSeed(urlSeed) ? urlSeed : saved && validSeed(saved.seed) ? saved.seed : randomSeed();
    load(seed, saved && saved.seed === seed ? saved : null);

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(fitRef.current!);
    window.addEventListener('resize', fit);
    const onVisibility = () => {
      if (document.hidden && timer.current.startedAt) {
        timer.current.banked = now();
        timer.current.startedAt = 0;
        save();
      } else if (!document.hidden && game.current && !wonRef.current && !timer.current.startedAt) {
        timer.current.startedAt = performance.now();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', save);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', fit);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', save);
      source.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setElapsed(now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const g = game.current;
  const left = g?.remaining() ?? new Array<number>(10).fill(9);
  const hintActive = !!hint.current && hint.current.kind !== 'none';
  const sel = selected >= 0 && g ? selected : -1;
  const selDigit = sel >= 0 ? g!.values[sel]! : 0;

  return (
    <section class="game" aria-label={`Sudoku, ${difficulty}`} onKeyDown={onKeyDown}>
      <div class="toolbar" role="toolbar" aria-label="Game controls">
        <button type="button" class="btn" onClick={newGame}>
          New game
        </button>
        <nav class="segmented" aria-label="Difficulty">
          {levels.map((l) => (
            <a key={l.id} class="seg" href={`/sudoku/${l.id}/`} aria-current={l.id === difficulty ? 'page' : undefined}>
              {l.name}
            </a>
          ))}
        </nav>
        <dl class="stats">
          {check && (
            <div>
              <dt>Mistakes</dt>
              <dd class="tabular-nums">{g?.mistakes ?? 0}</dd>
            </div>
          )}
          <div>
            <dt>Time</dt>
            <dd class="tabular-nums">{fmt(elapsed)}</dd>
          </div>
        </dl>
      </div>

      <div class="sudoku-area">
        <div ref={fitRef} class="sudoku-fit">
          <canvas
            ref={canvasRef}
            class="board sudoku-board"
            tabIndex={0}
            role="application"
            aria-roledescription="Sudoku grid"
            aria-label={`Sudoku grid. ${KEY_HELP}`}
            onPointerDown={(e) => {
              keyboard.current = false;
              const b = canvasRef.current!.getBoundingClientRect();
              const i = renderer.current!.cellAt(e.clientX - b.left, e.clientY - b.top);
              if (i >= 0) select(i);
            }}
          />
          {loading && (
            <div class="overlay overlay-soft" aria-live="polite">
              <div class="panel">
                <p>Preparing a {difficulty} puzzle…</p>
              </div>
            </div>
          )}
          {won && (
            <div class="overlay" role="dialog" aria-modal="false" aria-labelledby="win-title">
              <div class="panel">
                <h2 id="win-title">Solved!</h2>
                <p>
                  {levels.find((l) => l.id === difficulty)?.name} in <strong>{fmt(elapsed)}</strong>
                  {g && g.hintsUsed > 0 && <> · {g.hintsUsed} hints</>}
                  {best !== null && <> · Best {fmt(best)}</>}
                </p>
                <div class="panel-actions">
                  <button type="button" class="btn btn-primary" onClick={newGame}>
                    New puzzle
                  </button>
                  <a class="btn" href={otherGame.href}>
                    {otherGame.name}
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        <div class="sudoku-pad">
          <div class="pad-actions">
            <button type="button" class="btn" onClick={undo} disabled={!g?.canUndo || won}>
              Undo
            </button>
            <button type="button" class="btn" onClick={erase} disabled={sel < 0 || !!g?.isGiven(sel) || won}>
              Erase
            </button>
            <button type="button" class="btn" aria-pressed={notesMode} onClick={() => setNotesMode(!notesMode)}>
              Notes {notesMode ? 'on' : 'off'}
            </button>
            <button type="button" class={`btn${hintActive ? ' btn-primary' : ''}`} onClick={showHint} disabled={loading || won}>
              {hintActive ? 'Fill' : 'Hint'}
            </button>
          </div>
          <p class="pad-message" aria-hidden="true">
            {message}
          </p>
          <div class="digits" role="group" aria-label={notesMode ? 'Add a note' : 'Enter a digit'}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
              <button
                key={d}
                type="button"
                class={`digit${left[d]! <= 0 ? ' digit-done' : ''}${selDigit === d ? ' digit-same' : ''}`}
                onClick={() => input(d)}
                aria-label={`${notesMode ? 'Note' : 'Digit'} ${d}, ${Math.max(0, left[d]!)} left`}
              >
                <span class="digit-num">{d}</span>
                <span class="digit-left">{Math.max(0, left[d]!)}</span>
              </button>
            ))}
          </div>
          <div class="pad-extra">
            <label class="toggle">
              <input type="checkbox" checked={check} onChange={(e) => toggleCheck((e.currentTarget as HTMLInputElement).checked)} />
              Show mistakes
            </label>
            <button type="button" class="link-btn" onClick={fillNotes} disabled={won}>
              Fill notes
            </button>
            <button type="button" class="link-btn" onClick={restart} disabled={loading}>
              Restart
            </button>
          </div>
        </div>
      </div>
      <p class="sr-only" aria-live="polite">
        {announce}
      </p>
      {/* Raw HTML: browsers with JS never parse noscript children, so hydration must not diff them. */}
      <noscript dangerouslySetInnerHTML={{ __html: '<p class="noscript">Sudoku needs JavaScript to run. Please enable it to play.</p>' }} />
    </section>
  );
}
