import { useEffect, useRef, useState } from 'preact/hooks';
import { randomSeed } from '../../engines/core/rng';
import { readJson, writeJson } from '../../engines/core/storage';
import { recordWin } from '../../engines/core/progress';
import { bit, digitsOf } from '../../engines/sudoku/grid';
import { ACTIVE, SAMURAI_LEVELS, SIDE, SamuraiGame, generateSamurai, samuraiCellName, type SamuraiHint, type SamuraiLevel, type SamuraiPuzzle } from '../../engines/sudoku/samurai';
import { SamuraiRenderer } from '../../engines/sudoku/samurai-render';

const NAMES: Record<SamuraiLevel, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const MAX_BOARD = 820;
const validSeed = (s: unknown): s is string => typeof s === 'string' && /^[a-z0-9]{1,16}$/i.test(s);
const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
interface Saved {
  seed: string;
  state: ReturnType<SamuraiGame['serialize']>;
  elapsed: number;
}
const KEY_HELP = 'Five overlapping Sudoku grids. Arrow keys move, 1 to 9 enter a digit, Shift with a digit adds a note, 0 or Delete erases, H gives a hint, Control+Z undoes.';

export default function SamuraiSudokuGame() {
  const fitRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<SamuraiRenderer | null>(null);
  const game = useRef<SamuraiGame | null>(null);
  const puzzle = useRef<SamuraiPuzzle | null>(null);
  const levelRef = useRef<SamuraiLevel>('easy');
  const selRef = useRef(-1);
  const hint = useRef<SamuraiHint | null>(null);
  const checkRef = useRef(true);
  const keyboard = useRef(false);
  const wonRef = useRef(false);
  const timer = useRef({ startedAt: 0, banked: 0 });
  const [level, setLevel] = useState<SamuraiLevel>('easy');
  const [selected, setSelected] = useState(-1);
  const [notesMode, setNotesMode] = useState(false);
  const [check, setCheck] = useState(true);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [announce, setAnnounce] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [won, setWon] = useState(false);
  const [best, setBest] = useState<number | null>(null);
  const [, setVersion] = useState(0);

  const progressKey = () => `samurai:progress:${levelRef.current}`;
  const bestKey = () => `samurai:best:${levelRef.current}`;
  const now = () => timer.current.banked + (timer.current.startedAt ? performance.now() - timer.current.startedAt : 0);

  const paint = () => {
    const g = game.current;
    const r = renderer.current;
    if (!r || !r.size) return;
    const bad = new Set<number>();
    if (g) {
      for (const c of g.conflicts()) bad.add(c);
      if (checkRef.current) for (let c = 0; c < SIDE * SIDE; c++) if (ACTIVE[c] && g.isWrong(c)) bad.add(c);
    }
    r.draw({
      values: g?.values ?? [],
      notes: g?.notes ?? [],
      isGiven: (c) => !!g?.isGiven(c),
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
    const size = Math.floor(Math.min(el.clientWidth, el.clientHeight || el.clientWidth, MAX_BOARD));
    if (size > 0 && size !== r.size) r.resize(size, Math.min(window.devicePixelRatio || 1, 3));
    paint();
  };

  const save = () => {
    const g = game.current;
    if (!g || wonRef.current || !puzzle.current) return;
    writeJson(progressKey(), { seed: puzzle.current.seed, state: g.serialize(), elapsed: now() } satisfies Saved);
  };

  const begin = (seed: string, resume: Saved | null) => {
    setLoading(true);
    // Let the "Building" message paint, then generate (a fraction of a second).
    window.setTimeout(() => {
      const p = generateSamurai(levelRef.current, seed);
      puzzle.current = p;
      const g = new SamuraiGame(p.givens, p.solution);
      let banked = 0;
      if (resume && g.restore(resume.state) && !g.isWon) banked = resume.elapsed;
      game.current = g;
      hint.current = null;
      wonRef.current = false;
      timer.current = { startedAt: performance.now(), banked };
      selRef.current = -1;
      setSelected(-1);
      setWon(false);
      setElapsed(banked);
      setBest(readJson<number | null>(bestKey(), null));
      setMessage(banked ? 'Welcome back: your progress was restored.' : '');
      const url = new URL(location.href);
      url.searchParams.set('puzzle', p.seed);
      url.searchParams.set('level', p.level);
      history.replaceState(null, '', url);
      setLoading(false);
      setVersion((v) => v + 1);
      fit();
      paint();
    }, 30);
  };

  const newGame = () => {
    writeJson(progressKey(), null);
    begin(randomSeed(), null);
  };

  const switchLevel = (l: SamuraiLevel) => {
    if (l === levelRef.current) return;
    save();
    levelRef.current = l;
    setLevel(l);
    writeJson('samurai:level', l);
    const saved = readJson<Saved | null>(progressKey(), null);
    begin(saved && validSeed(saved.seed) ? saved.seed : randomSeed(), saved);
  };

  const select = (c: number) => {
    selRef.current = c;
    setSelected(c);
    const g = game.current;
    if (g && c >= 0) {
      const v = g.values[c]!;
      const notes = g.notes[c] ? `, notes ${digitsOf(g.notes[c]!).join(' ')}` : '';
      setAnnounce(`${samuraiCellName(c)}: ${v ? `${v}${g.isGiven(c) ? ', given' : ''}` : 'empty'}${notes}`);
    }
    paint();
  };

  const after = (msg: string) => {
    const g = game.current!;
    hint.current = null;
    setMessage('');
    setAnnounce(msg);
    if (g.isWon && !wonRef.current) {
      wonRef.current = true;
      timer.current.banked = now();
      timer.current.startedAt = 0;
      const t = timer.current.banked;
      setElapsed(t);
      const prev = readJson<number | null>(bestKey(), null);
      if (prev === null || t < prev) {
        writeJson(bestKey(), t);
        setBest(t);
      }
      writeJson(progressKey(), null);
      recordWin('samurai-sudoku');
      setWon(true);
      setAnnounce(`Solved in ${fmt(t)}!`);
    } else save();
    setVersion((v) => v + 1);
    paint();
  };

  const input = (d: number, asNote = notesMode) => {
    const g = game.current;
    const c = selRef.current;
    if (!g || loading || wonRef.current) return;
    if (c < 0) return setMessage('Select a cell first.');
    if (g.isGiven(c)) return setAnnounce('That cell is a given clue.');
    if (asNote) {
      if (g.values[c]) return setAnnounce('Erase the digit before adding notes.');
      g.toggleNote(c, d);
      return after(`${g.notes[c]! & bit(d) ? 'Added' : 'Removed'} note ${d}.`);
    }
    const had = g.values[c] === d;
    g.setValue(c, d);
    after(had ? 'Cleared.' : `${d} at ${samuraiCellName(c)}${checkRef.current && g.isWrong(c) ? ', which is not right' : ''}.`);
  };

  const erase = () => {
    const g = game.current;
    const c = selRef.current;
    if (g && c >= 0 && !wonRef.current && g.erase(c)) after('Erased.');
  };
  const undo = () => {
    const g = game.current;
    if (g && !wonRef.current && g.undo()) after('Undone.');
  };
  const fillNotes = () => {
    const g = game.current;
    if (g && !wonRef.current && g.fillNotes()) after('Notes filled in for every empty cell.');
  };

  const showHint = () => {
    const g = game.current;
    if (!g || loading || wonRef.current) return;
    const h = hint.current;
    if (h && h.kind !== 'none') {
      g.applyHint(h);
      select(h.cell);
      return after(h.kind === 'wrong' ? 'Cleared the wrong digit.' : `Placed ${h.digit}.`);
    }
    const next = g.hint();
    hint.current = next;
    if (next.kind !== 'none') select(next.cell);
    setMessage(`${next.message}${next.kind !== 'none' ? ' Press Fill to apply it.' : ''}`);
    setAnnounce(`Hint: ${next.message}`);
    setVersion((v) => v + 1);
    paint();
  };

  const toggleCheck = (on: boolean) => {
    checkRef.current = on;
    setCheck(on);
    writeJson('samurai:settings', { check: on });
    paint();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const k = e.key;
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'z') {
      e.preventDefault();
      return undo();
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const move = (dr: number, dc: number) => {
      e.preventDefault();
      keyboard.current = true;
      let c = selRef.current < 0 ? 10 * SIDE + 10 : selRef.current;
      // Step in the direction, skipping the gaps between grids.
      for (let n = 0; n < SIDE; n++) {
        const r = (Math.floor(c / SIDE) + dr + SIDE) % SIDE;
        const col = ((c % SIDE) + dc + SIDE) % SIDE;
        c = r * SIDE + col;
        if (ACTIVE[c]) break;
      }
      select(c);
    };
    if (k === 'ArrowUp') move(-1, 0);
    else if (k === 'ArrowDown') move(1, 0);
    else if (k === 'ArrowLeft') move(0, -1);
    else if (k === 'ArrowRight') move(0, 1);
    else if (/^(Digit|Numpad)[1-9]$/.test(e.code)) {
      e.preventDefault();
      input(Number(e.code.slice(-1)), notesMode || e.shiftKey);
    } else if (k === '0' || k === 'Delete' || k === 'Backspace') {
      e.preventDefault();
      erase();
    } else if (k === 'n' || k === 'N') setNotesMode(!notesMode);
    else if (k === 'h' || k === 'H') showHint();
  };

  useEffect(() => {
    renderer.current = new SamuraiRenderer(canvasRef.current!);
    if (readJson<{ check?: boolean }>('samurai:settings', {}).check === false) {
      checkRef.current = false;
      setCheck(false);
    }
    const params = new URLSearchParams(location.search);
    const isLevel = (x: unknown): x is SamuraiLevel => SAMURAI_LEVELS.includes(x as SamuraiLevel);
    const urlLevel = params.get('level');
    const lvl = isLevel(urlLevel) ? urlLevel : isLevel(readJson('samurai:level', null)) ? readJson<SamuraiLevel>('samurai:level', 'easy') : 'easy';
    levelRef.current = lvl;
    setLevel(lvl);
    const saved = readJson<Saved | null>(progressKey(), null);
    const urlSeed = params.get('puzzle');
    const seed = validSeed(urlSeed) ? urlSeed : saved && validSeed(saved.seed) ? saved.seed : randomSeed();
    begin(seed, saved && saved.seed === seed ? saved : null);
    const ro = new ResizeObserver(fit);
    ro.observe(fitRef.current!);
    const onHide = () => {
      if (document.hidden) save();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', save);
    const tick = window.setInterval(() => {
      if (!wonRef.current && game.current && !document.hidden) setElapsed(now());
    }, 1000);
    return () => {
      ro.disconnect();
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', save);
      window.clearInterval(tick);
    };
  }, []);

  const g = game.current;
  const left = g?.remaining() ?? new Array<number>(10).fill(41);
  const sel = selected >= 0 && g ? selected : -1;
  const selNotes = sel >= 0 && g && !g.values[sel] && g.notes[sel] ? digitsOf(g.notes[sel]!).join(' ') : '';
  const hintActive = !!hint.current && hint.current.kind !== 'none';

  return (
    <section class="game" aria-label={`Samurai Sudoku, ${level}`} onKeyDown={onKeyDown}>
      <div class="toolbar" role="toolbar" aria-label="Game controls">
        <button type="button" class="btn" onClick={newGame}>
          New game
        </button>
        <div class="segmented" role="radiogroup" aria-label="Difficulty">
          {SAMURAI_LEVELS.map((l) => (
            <button key={l} type="button" role="radio" class="seg" aria-checked={l === level} onClick={() => switchLevel(l)}>
              {NAMES[l]}
            </button>
          ))}
        </div>
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
      <div class="sudoku-area samurai-area">
        <div ref={fitRef} class="sudoku-fit samurai-fit">
          <canvas
            ref={canvasRef}
            class="board sudoku-board"
            tabIndex={0}
            role="application"
            aria-roledescription="Samurai Sudoku grid"
            aria-label={`Samurai Sudoku grid. ${KEY_HELP}`}
            onPointerDown={(e) => {
              keyboard.current = false;
              const b = canvasRef.current!.getBoundingClientRect();
              const c = renderer.current!.cellAt(e.clientX - b.left, e.clientY - b.top);
              if (c >= 0) select(c);
            }}
          />
          {loading && (
            <div class="overlay overlay-soft" aria-live="polite">
              <div class="panel">
                <p>Building a {level} Samurai Sudoku…</p>
              </div>
            </div>
          )}
          {won && (
            <div class="overlay" role="dialog" aria-modal="false" aria-labelledby="sam-win">
              <div class="panel">
                <h2 id="sam-win">All five grids solved!</h2>
                <p>
                  {NAMES[level]} in <strong>{fmt(elapsed)}</strong>
                  {g && g.hintsUsed > 0 && <> · {g.hintsUsed} hints</>}
                  {best !== null && <> · Best {fmt(best)}</>}
                </p>
                <div class="panel-actions">
                  <button type="button" class="btn btn-primary" onClick={newGame}>
                    New puzzle
                  </button>
                  <a class="btn" href="/sudoku/killer/">
                    Killer Sudoku
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
            {message || (selNotes ? `Notes in this cell: ${selNotes}` : '')}
          </p>
          <div class="digits" role="group" aria-label={notesMode ? 'Add a note' : 'Enter a digit'}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
              <button key={d} type="button" class={`digit${left[d]! <= 0 ? ' digit-done' : ''}`} onClick={() => input(d)} aria-label={`${notesMode ? 'Note' : 'Digit'} ${d}, ${Math.max(0, left[d]!)} left`}>
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
          </div>
        </div>
      </div>
      <p class="sr-only" aria-live="polite">
        {announce}
      </p>
      <noscript dangerouslySetInnerHTML={{ __html: '<p class="noscript">Samurai Sudoku needs JavaScript to run. Please enable it to play.</p>' }} />
    </section>
  );
}
