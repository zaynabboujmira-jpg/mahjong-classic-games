import { useEffect, useRef, useState } from 'preact/hooks';
import { randomSeed } from '../../engines/core/rng';
import { readJson, writeJson } from '../../engines/core/storage';
import { recordWin } from '../../engines/core/progress';
import { VARIANT_LEVELS, generateVariant, makeShape, type Variant, type VariantLevel, type VariantPuzzle } from '../../engines/sudoku/variants';
import { VariantGame, variantCellName, type VariantHint } from '../../engines/sudoku/variant-game';
import { VariantRenderer } from '../../engines/sudoku/variant-render';

const NAMES: Record<VariantLevel, string> = { easy: 'Easy', medium: 'Medium' };
const TITLES: Record<Variant, string> = { '6x6': '6×6 Sudoku', diagonal: 'Diagonal Sudoku', jigsaw: 'Jigsaw Sudoku', '16x16': '16×16 Sudoku' };
const validSeed = (s: unknown): s is string => typeof s === 'string' && /^[a-z0-9]{1,16}$/i.test(s);
const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
interface Saved {
  seed: string;
  state: ReturnType<VariantGame['serialize']>;
  elapsed: number;
}

export default function VariantSudokuGame({ variant }: { variant: Variant }) {
  const fitRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<VariantRenderer | null>(null);
  const game = useRef<VariantGame | null>(null);
  const puzzle = useRef<VariantPuzzle | null>(null);
  const levelRef = useRef<VariantLevel>('easy');
  const selRef = useRef(-1);
  const hint = useRef<VariantHint | null>(null);
  const checkRef = useRef(true);
  const keyboard = useRef(false);
  const wonRef = useRef(false);
  const timer = useRef({ startedAt: 0, banked: 0 });
  const [level, setLevel] = useState<VariantLevel>('easy');
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

  const n = makeShape(variant).n;
  const key = (k: string) => `variant:${variant}:${k}:${levelRef.current}`;
  const now = () => timer.current.banked + (timer.current.startedAt ? performance.now() - timer.current.startedAt : 0);

  const paint = () => {
    const g = game.current;
    const r = renderer.current;
    if (!r || !r.size || !g) return;
    const bad = new Set<number>(g.conflicts());
    if (checkRef.current) for (let c = 0; c < g.size; c++) if (g.isWrong(c)) bad.add(c);
    r.draw({
      values: g.values,
      notes: g.notes,
      isGiven: (c) => g.isGiven(c),
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
    const size = Math.floor(Math.min(el.clientWidth, el.clientHeight || el.clientWidth, n > 9 ? 760 : 560));
    if (size > 0 && size !== r.size) r.resize(size, Math.min(window.devicePixelRatio || 1, 3));
    paint();
  };

  const save = () => {
    const g = game.current;
    if (!g || wonRef.current || !puzzle.current) return;
    writeJson(key('progress'), { seed: puzzle.current.seed, state: g.serialize(), elapsed: now() } satisfies Saved);
  };

  const begin = (seed: string, resume: Saved | null) => {
    setLoading(true);
    window.setTimeout(() => {
      const p = generateVariant(variant, levelRef.current, seed);
      puzzle.current = p;
      const shape = makeShape(variant, p.region);
      const g = new VariantGame(shape, p.givens, p.solution);
      let banked = 0;
      if (resume && g.restore(resume.state) && !g.isWon) banked = resume.elapsed;
      game.current = g;
      if (renderer.current) renderer.current.setShape(shape);
      else renderer.current = new VariantRenderer(canvasRef.current!, shape);
      hint.current = null;
      wonRef.current = false;
      timer.current = { startedAt: performance.now(), banked };
      selRef.current = -1;
      setSelected(-1);
      setWon(false);
      setElapsed(banked);
      setBest(readJson<number | null>(key('best'), null));
      setMessage(banked ? 'Welcome back: your progress was restored.' : '');
      const url = new URL(location.href);
      url.searchParams.set('puzzle', p.seed);
      url.searchParams.set('level', p.level);
      history.replaceState(null, '', url);
      setLoading(false);
      setVersion((v) => v + 1);
      fit();
      paint();
    }, 20);
  };

  const newGame = () => {
    writeJson(key('progress'), null);
    begin(randomSeed(), null);
  };

  const switchLevel = (l: VariantLevel) => {
    if (l === levelRef.current) return;
    save();
    levelRef.current = l;
    setLevel(l);
    writeJson(`variant:${variant}:level`, l);
    const saved = readJson<Saved | null>(key('progress'), null);
    begin(saved && validSeed(saved.seed) ? saved.seed : randomSeed(), saved);
  };

  const select = (c: number) => {
    selRef.current = c;
    setSelected(c);
    const g = game.current;
    if (g && c >= 0) {
      const v = g.values[c]!;
      setAnnounce(`${variantCellName(g.shape, c)}: ${v ? `${v}${g.isGiven(c) ? ', given' : ''}` : 'empty'}`);
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
      const prev = readJson<number | null>(key('best'), null);
      if (prev === null || t < prev) {
        writeJson(key('best'), t);
        setBest(t);
      }
      writeJson(key('progress'), null);
      recordWin('sudoku-variants');
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
      return after(`Note ${d} ${g.notes[c]! & (1 << (d - 1)) ? 'added' : 'removed'}.`);
    }
    const had = g.values[c] === d;
    g.setValue(c, d);
    after(had ? 'Cleared.' : `${d} at ${variantCellName(g.shape, c)}${checkRef.current && g.isWrong(c) ? ', which is not right' : ''}.`);
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
    writeJson('variant:settings', { check: on });
    paint();
  };

  // Two-digit entry for 16×16 from the keyboard: "1" then "2" within a second makes 12.
  const pending = useRef<{ d: number; at: number } | null>(null);
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
      const base = selRef.current < 0 ? 0 : selRef.current;
      select(((Math.floor(base / n) + dr + n) % n) * n + (((base % n) + dc + n) % n));
    };
    if (k === 'ArrowUp') move(-1, 0);
    else if (k === 'ArrowDown') move(1, 0);
    else if (k === 'ArrowLeft') move(0, -1);
    else if (k === 'ArrowRight') move(0, 1);
    else if (/^(Digit|Numpad)[0-9]$/.test(e.code)) {
      e.preventDefault();
      const d = Number(e.code.slice(-1));
      const t = performance.now();
      if (n > 9 && pending.current && pending.current.d === 1 && t - pending.current.at < 1000 && d <= n - 10) {
        pending.current = null;
        return input(10 + d, notesMode || e.shiftKey);
      }
      if (d === 0) return erase();
      if (d > n) return;
      pending.current = { d, at: t };
      input(d, notesMode || e.shiftKey);
    } else if (k === 'Delete' || k === 'Backspace') {
      e.preventDefault();
      erase();
    } else if (k === 'n' || k === 'N') setNotesMode(!notesMode);
    else if (k === 'h' || k === 'H') showHint();
  };

  useEffect(() => {
    if (readJson<{ check?: boolean }>('variant:settings', {}).check === false) {
      checkRef.current = false;
      setCheck(false);
    }
    const params = new URLSearchParams(location.search);
    const isLevel = (x: unknown): x is VariantLevel => VARIANT_LEVELS.includes(x as VariantLevel);
    const urlLevel = params.get('level');
    const stored = readJson<unknown>(`variant:${variant}:level`, null);
    const lvl = isLevel(urlLevel) ? urlLevel : isLevel(stored) ? stored : 'easy';
    levelRef.current = lvl;
    setLevel(lvl);
    const saved = readJson<Saved | null>(key('progress'), null);
    const urlSeed = params.get('puzzle');
    const seed = validSeed(urlSeed) ? urlSeed : saved && validSeed(saved.seed) ? saved.seed : randomSeed();
    begin(seed, saved && saved.seed === seed ? saved : null);
    const ro = new ResizeObserver(fit);
    ro.observe(fitRef.current!);
    const onHide = () => document.hidden && save();
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
  const left = g?.remaining() ?? new Array<number>(n + 1).fill(n);
  const sel = selected >= 0 && g ? selected : -1;
  const hintActive = !!hint.current && hint.current.kind !== 'none';

  return (
    <section class="game" aria-label={`${TITLES[variant]}, ${level}`} onKeyDown={onKeyDown}>
      <div class="toolbar" role="toolbar" aria-label="Game controls">
        <button type="button" class="btn" onClick={newGame}>
          New game
        </button>
        <div class="segmented" role="radiogroup" aria-label="Difficulty">
          {VARIANT_LEVELS.map((l) => (
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
      <div class="sudoku-area">
        <div ref={fitRef} class={`sudoku-fit${n > 9 ? ' samurai-fit' : ''}`}>
          <canvas
            ref={canvasRef}
            class="board sudoku-board"
            tabIndex={0}
            role="application"
            aria-roledescription={`${TITLES[variant]} grid`}
            aria-label={`${TITLES[variant]} grid. Arrow keys move, digits enter a number${n > 9 ? ' (type 1 then 0 to 6 for 10 to 16)' : ''}, Shift with a digit adds a note, Delete erases, H gives a hint, Control+Z undoes.`}
            onPointerDown={(e) => {
              keyboard.current = false;
              const b = canvasRef.current!.getBoundingClientRect();
              const c = renderer.current?.cellAt(e.clientX - b.left, e.clientY - b.top) ?? -1;
              if (c >= 0) select(c);
            }}
          />
          {loading && (
            <div class="overlay overlay-soft" aria-live="polite">
              <div class="panel">
                <p>Building a {level} puzzle…</p>
              </div>
            </div>
          )}
          {won && (
            <div class="overlay" role="dialog" aria-modal="false" aria-labelledby="var-win">
              <div class="panel">
                <h2 id="var-win">Solved!</h2>
                <p>
                  {NAMES[level]} {TITLES[variant]} in <strong>{fmt(elapsed)}</strong>
                  {g && g.hintsUsed > 0 && <> · {g.hintsUsed} hints</>}
                  {best !== null && <> · Best {fmt(best)}</>}
                </p>
                <div class="panel-actions">
                  <button type="button" class="btn btn-primary" onClick={newGame}>
                    New puzzle
                  </button>
                  <a class="btn" href="/sudoku/">
                    More Sudoku
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
          <div class={`digits digits-${n}`} role="group" aria-label={notesMode ? 'Add a note' : 'Enter a digit'}>
            {Array.from({ length: n }, (_, k) => k + 1).map((d) => (
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
      <noscript dangerouslySetInnerHTML={{ __html: '<p class="noscript">This Sudoku needs JavaScript to run. Please enable it to play.</p>' }} />
    </section>
  );
}
