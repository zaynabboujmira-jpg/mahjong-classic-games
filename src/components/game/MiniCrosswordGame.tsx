import { useEffect, useRef, useState } from 'preact/hooks';
import { readJson, writeJson } from '../../engines/core/storage';
import { recordWin } from '../../engines/core/progress';
import { dayNumber } from '../../engines/core/day';
import { randomSeed } from '../../engines/core/rng';
import { CW_SIZES, CrosswordGame, type CwSize, type Dir, type Entry } from '../../engines/puzzles/crossword';

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
type Kind = 'daily' | 'unlimited';

export default function MiniCrosswordGame() {
  const game = useRef(new CrosswordGame(5, 'preview'));
  const [, setTick] = useState(0);
  const [kind, setKind] = useState<Kind>('daily');
  const [size, setSize] = useState<CwSize>(5);
  const [cell, setCell] = useState<[number, number]>([0, 0]);
  const [dir, setDir] = useState<Dir>('across');
  const [ms, setMs] = useState(0);
  const [solved, setSolved] = useState(false);
  const [announce, setAnnounce] = useState('');
  const startedAt = useRef(0);
  const timer = useRef(0);
  const gridRef = useRef<HTMLDivElement>(null);
  const refresh = () => setTick((n) => n + 1);
  const bestKey = (s: CwSize) => `crossword:best:${s}`;
  const [best, setBest] = useState<number | null>(null);

  const start = (k: Kind = kind, s: CwSize = size) => {
    window.clearInterval(timer.current);
    const day = dayNumber(new Date());
    game.current = new CrosswordGame(s, k === 'daily' ? `daily${day}` : randomSeed());
    const first = game.current.puzzle.entries[0]!;
    startedAt.current = 0;
    setKind(k);
    setSize(s);
    setCell([first.r, first.c]);
    setDir(first.dir);
    setMs(0);
    setSolved(false);
    setBest(readJson<number | null>(bestKey(s), null));
    writeJson('crossword:settings', { kind: k, size: s });
    setAnnounce(`${k === 'daily' ? `Daily mini crossword number ${day}` : 'New mini crossword'}, ${s} by ${s}. ${first.num} ${first.dir}: ${first.clue}.`);
    refresh();
  };

  const tickClock = () => {
    if (startedAt.current) return;
    startedAt.current = performance.now();
    timer.current = window.setInterval(() => setMs(performance.now() - startedAt.current), 500);
  };

  const entry = (): Entry | null => game.current.entryAt(cell[0], cell[1], dir);

  const select = (r: number, c: number) => {
    const g = game.current;
    if (!g.isOpen(r, c)) return;
    if (r === cell[0] && c === cell[1]) {
      const other = dir === 'across' ? 'down' : 'across';
      if (g.entryAt(r, c, other)?.dir === other) setDir(other);
    } else {
      const e = g.entryAt(r, c, dir);
      if (e) setDir(e.dir);
    }
    setCell([r, c]);
    gridRef.current?.focus();
  };

  const moveInWord = (step: 1 | -1) => {
    const e = entry();
    if (!e) return;
    const cells = game.current.cellsOf(e);
    const i = cells.findIndex(([r, c]) => r === cell[0] && c === cell[1]);
    const n = cells[i + step];
    if (n) setCell(n);
  };

  const jumpEntry = (step: 1 | -1) => {
    const list = game.current.puzzle.entries;
    const e = entry();
    const i = e ? list.indexOf(e) : -1;
    const next = list[(i + step + list.length) % list.length]!;
    setDir(next.dir);
    // Go to the first empty cell of the next word, or its start.
    const cells = game.current.cellsOf(next);
    const empty = cells.find(([r, c]) => !game.current.letters[r]![c]);
    setCell(empty ?? cells[0]!);
  };

  const checkSolved = () => {
    const g = game.current;
    if (!g.solved) return;
    window.clearInterval(timer.current);
    const time = Math.round(performance.now() - (startedAt.current || performance.now()));
    setMs(time);
    setSolved(true);
    recordWin('mini-crossword');
    if (!g.revealed.size) {
      const prev = readJson<number | null>(bestKey(g.size), null);
      if (prev === null || time < prev) {
        writeJson(bestKey(g.size), time);
        setBest(time);
      }
    }
    if (kind === 'daily') writeJson(`crossword:daily:${g.size}`, dayNumber(new Date()));
    setAnnounce(`Solved in ${fmt(time)}!`);
  };

  const type = (ch: string) => {
    if (solved) return;
    tickClock();
    const g = game.current;
    g.set(cell[0], cell[1], ch);
    // Advance to the next cell of the word.
    const e = entry();
    if (e) {
      const cells = g.cellsOf(e);
      const i = cells.findIndex(([r, c]) => r === cell[0] && c === cell[1]);
      const rest = cells.slice(i + 1);
      const next = rest.find(([r, c]) => !g.letters[r]![c]) ?? rest[0];
      if (next) setCell(next);
      else if (cells.every(([r, c]) => g.letters[r]![c])) jumpEntry(1);
    }
    checkSolved();
    refresh();
  };

  const backspace = () => {
    const g = game.current;
    if (g.letters[cell[0]]![cell[1]] && !g.revealed.has(`${cell[0]},${cell[1]}`)) g.set(cell[0], cell[1], '');
    else {
      moveInWord(-1);
      const e = entry();
      if (e) {
        const cells = g.cellsOf(e);
        const i = cells.findIndex(([r, c]) => r === cell[0] && c === cell[1]);
        const prev = cells[i - 1];
        if (prev) g.set(prev[0], prev[1], '');
      }
    }
    refresh();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (/^[a-zA-Z]$/.test(k)) {
      e.preventDefault();
      type(k);
    } else if (k === 'Backspace') {
      e.preventDefault();
      backspace();
    } else if (k === 'Tab' || k === 'Enter') {
      e.preventDefault();
      jumpEntry(e.shiftKey ? -1 : 1);
    } else if (k.startsWith('Arrow')) {
      e.preventDefault();
      const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[k]!;
      const want: Dir = d[0] ? 'down' : 'across';
      if (want !== dir && game.current.entryAt(cell[0], cell[1], want)?.dir === want) {
        setDir(want);
        return;
      }
      let r = cell[0] + d[0]!;
      let c = cell[1] + d[1]!;
      while (r >= 0 && c >= 0 && r < size && c < size && !game.current.isOpen(r, c)) {
        r += d[0]!;
        c += d[1]!;
      }
      if (game.current.isOpen(r, c)) setCell([r, c]);
    }
  };

  const check = () => {
    const n = game.current.check();
    setAnnounce(n ? `${n} ${n === 1 ? 'letter is' : 'letters are'} wrong, shown in red.` : 'Everything filled in so far is right.');
    refresh();
  };
  const reveal = () => {
    tickClock();
    game.current.reveal(cell[0], cell[1]);
    checkSolved();
    refresh();
  };

  useEffect(() => {
    const s = readJson<{ kind: Kind; size: CwSize }>('crossword:settings', { kind: 'daily', size: 5 });
    start(s.kind === 'unlimited' ? 'unlimited' : 'daily', CW_SIZES.includes(s.size) ? s.size : 5);
    return () => window.clearInterval(timer.current);
  }, []);

  const g = game.current;
  const cur = entry();
  const inWord = new Set(cur ? g.cellsOf(cur).map(([r, c]) => `${r},${c}`) : []);

  return (
    <section class="game" aria-label="Mini Crossword">
      <div class="toolbar" role="toolbar" aria-label="Game controls">
        <div class="segmented" role="radiogroup" aria-label="Puzzle">
          <button type="button" role="radio" class="seg" aria-checked={kind === 'daily'} onClick={() => start('daily', size)}>
            Daily
          </button>
          <button type="button" role="radio" class="seg" aria-checked={kind === 'unlimited'} onClick={() => start('unlimited', size)}>
            {kind === 'unlimited' ? 'New' : 'Unlimited'}
          </button>
        </div>
        <div class="segmented" role="radiogroup" aria-label="Size">
          {CW_SIZES.map((s) => (
            <button key={s} type="button" role="radio" class="seg" aria-checked={size === s} onClick={() => start(kind, s)}>
              {s}×{s}
            </button>
          ))}
        </div>
        <button type="button" class="btn" onClick={check} disabled={solved}>
          Check
        </button>
        <button type="button" class="btn" onClick={reveal} disabled={solved}>
          Reveal
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
      <div class="arcade-area cw-area">
        <div class="sq-fit">
          <div
            ref={gridRef}
            class="cw-grid"
            style={{ '--n': size }}
            tabIndex={0}
            role="application"
            aria-roledescription="Crossword grid"
            aria-label={`Crossword ${size} by ${size}. Type letters; arrows move; Tab goes to the next clue. ${cur ? `${cur.num} ${cur.dir}: ${cur.clue}` : ''}`}
            onKeyDown={onKeyDown}
          >
            {g.puzzle.grid.flatMap((row, r) =>
              row.map((ch, c) => {
                if (!ch) return <span key={`${r}-${c}`} class="cw-block" />;
                const k = `${r},${c}`;
                const cls = `cw-cell${inWord.has(k) ? ' in-word' : ''}${cell[0] === r && cell[1] === c ? ' is-cur' : ''}${g.wrong.has(k) ? ' is-wrong' : ''}${g.revealed.has(k) ? ' is-revealed' : ''}`;
                return (
                  <span key={`${r}-${c}`} class={cls} onPointerDown={(e) => (e.preventDefault(), select(r, c))}>
                    {g.puzzle.numbers[r]![c] ? <span class="cw-num">{g.puzzle.numbers[r]![c]}</span> : null}
                    {g.letters[r]![c]!.toUpperCase()}
                  </span>
                );
              }),
            )}
          </div>
        </div>
        <div class="cw-clue">
          <button type="button" class="cw-arrow" aria-label="Previous clue" onClick={() => jumpEntry(-1)}>
            ‹
          </button>
          <p aria-live="polite">
            {cur ? (
              <>
                <strong>
                  {cur.num} {cur.dir === 'across' ? 'Across' : 'Down'}
                </strong>{' '}
                {cur.clue}
              </>
            ) : null}
          </p>
          <button type="button" class="cw-arrow" aria-label="Next clue" onClick={() => jumpEntry(1)}>
            ›
          </button>
        </div>
        <div class="word-keys cw-keys" aria-label="Keyboard">
          {ROWS.map((row, i) => (
            <div key={row} class="word-row">
              {[...row].map((k) => (
                <button key={k} type="button" class="word-key" onPointerDown={(e) => e.preventDefault()} onClick={() => type(k)}>
                  {k.toUpperCase()}
                </button>
              ))}
              {i === 2 && (
                <button type="button" class="word-key word-key-wide" aria-label="Delete" onPointerDown={(e) => e.preventDefault()} onClick={backspace}>
                  ⌫
                </button>
              )}
            </div>
          ))}
        </div>
        {solved && (
          <div class="overlay overlay-soft nono-done" role="dialog" aria-labelledby="cw-done">
            <div class="panel">
              <h2 id="cw-done">Solved!</h2>
              <p>
                {kind === 'daily' ? 'Today’s' : 'This'} {size}×{size} in <strong>{fmt(ms)}</strong>
                {g.revealed.size ? ` · ${g.revealed.size} revealed` : best !== null ? ` · Best ${fmt(best)}` : ''}
              </p>
              <div class="panel-actions">
                <button type="button" class="btn btn-primary" onClick={() => start('unlimited', size)}>
                  Play another
                </button>
                {kind === 'daily' && size === 5 && (
                  <button type="button" class="btn" onClick={() => start('daily', 7)}>
                    Daily 7×7
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
      <noscript dangerouslySetInnerHTML={{ __html: '<p class="noscript">Mini Crossword needs JavaScript to run. Please enable it to play.</p>' }} />
    </section>
  );
}
