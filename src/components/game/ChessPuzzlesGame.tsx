import { useEffect, useRef, useState } from 'preact/hooks';
import { readJson, writeJson } from '../../engines/core/storage';
import { dailySeed, recordDaily, recordWin } from '../../engines/core/progress';
import { dayNumber } from '../../engines/core/day';
import { Synth } from '../../engines/arcade/audio';
import { BLACK, Chess, WHITE, colorOf, squareName, typeOf, type Move } from '../../engines/board/chess';
import { bestDefence, dailyIndex, matingMoves, uci, type ChessPuzzle } from '../../engines/board/chess-puzzles';
import PUZZLES from '../../data/chess-puzzles.json';
import { PIECE_NAMES, pieceSvg } from './chess-pieces';

type Mode = 'daily' | 'mate1' | 'mate2';
const MODES: { id: Mode; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'mate1', label: 'Mate in 1' },
  { id: 'mate2', label: 'Mate in 2' },
];
const SETS: Record<'mate1' | 'mate2', ChessPuzzle[]> = { mate1: PUZZLES.mate1 as ChessPuzzle[], mate2: PUZZLES.mate2 as ChessPuzzle[] };
type Stage = 'first' | 'reply' | 'second' | 'solved';

const isMode = (x: unknown): x is Mode => x === 'daily' || x === 'mate1' || x === 'mate2';

export default function ChessPuzzlesGame() {
  const [mode, setMode] = useState<Mode>('daily');
  const [index, setIndex] = useState(0);
  const [day, setDay] = useState(0);
  const game = useRef(new Chess(SETS.mate2[0]!.fen));
  const synth = useRef(new Synth());
  const [stage, setStage] = useState<Stage>('first');
  const [selected, setSelected] = useState(-1);
  const [cursor, setCursor] = useState(12);
  const [wrong, setWrong] = useState(-1);
  const [hint, setHint] = useState(-1);
  const [mistakes, setMistakes] = useState(0);
  const [message, setMessage] = useState('');
  const [announce, setAnnounce] = useState('');
  const [solvedCount, setSolvedCount] = useState({ mate1: 0, mate2: 0 });
  const [streak, setStreak] = useState(0);
  const timer = useRef(0);
  const revealedRef = useRef(false);
  const [, setTick] = useState(0);

  const puzzleFor = (m: Mode, i: number, d: number): ChessPuzzle => (m === 'daily' ? SETS.mate2[dailyIndex(d, SETS.mate2.length)]! : SETS[m][i % SETS[m].length]!);
  const puzzle = puzzleFor(mode, index, day);
  const solver = new Chess(puzzle.fen).turn;
  const sideName = solver === WHITE ? 'White' : 'Black';

  const solvedSet = (m: 'mate1' | 'mate2') => readJson<number[]>(`chesspz:solved:${m}`, []);
  const loadCounts = () => setSolvedCount({ mate1: solvedSet('mate1').length, mate2: solvedSet('mate2').length });

  const open = (m: Mode, i: number, d = day) => {
    window.clearTimeout(timer.current);
    const p = puzzleFor(m, i, d);
    game.current = new Chess(p.fen);
    setMode(m);
    setIndex(i);
    setStage('first');
    setSelected(-1);
    setWrong(-1);
    setHint(-1);
    revealedRef.current = false;
    setMistakes(0);
    const turn = game.current.turn === WHITE ? 'White' : 'Black';
    const msg = `${turn} to move: mate in ${p.mate}.${m === 'daily' ? " Today's daily puzzle, the same for everyone." : ''}`;
    setMessage(msg);
    setAnnounce(msg);
    writeJson('chesspz:mode', m);
    if (m !== 'daily') writeJson(`chesspz:current:${m}`, i);
    const url = new URL(location.href);
    url.searchParams.set('mode', m);
    if (m === 'daily') url.searchParams.delete('n');
    else url.searchParams.set('n', String(i + 1));
    history.replaceState(null, '', url);
  };

  useEffect(() => {
    const d = dayNumber(new Date());
    setDay(d);
    loadCounts();
    setStreak(readJson<number>('chesspz:streak', 0));
    const params = new URLSearchParams(location.search);
    const m = isMode(params.get('mode')) ? (params.get('mode') as Mode) : isMode(readJson('chesspz:mode', null)) ? readJson<Mode>('chesspz:mode', 'daily') : 'daily';
    const n = Number(params.get('n'));
    const i = m === 'daily' ? 0 : Number.isInteger(n) && n >= 1 && n <= SETS[m].length ? n - 1 : readJson<number>(`chesspz:current:${m}`, 0) % SETS[m].length;
    open(m, i, d);
    return () => window.clearTimeout(timer.current);
  }, []);

  const succeed = () => {
    setStage('solved');
    setSelected(-1);
    setHint(-1);
    synth.current.tone(784, 120, 'triangle', 0.08);
    if (revealedRef.current) {
      setMessage('That is the solution. Try the next puzzle.');
      return;
    }
    // The streak counts puzzles solved on the first try in a row.
    if (!mistakes) {
      const s = readJson<number>('chesspz:streak', 0) + 1;
      writeJson('chesspz:streak', s);
      setStreak(s);
    }
    if (mode === 'daily') {
      recordWin('chess-puzzles', dailySeed(dayNumber(new Date())));
      setMessage(`Solved! Today's daily puzzle is done${mistakes ? ` (${mistakes} wrong ${mistakes === 1 ? 'try' : 'tries'})` : ' on the first try'}.`);
    } else {
      const set = solvedSet(mode);
      if (!set.includes(index)) writeJson(`chesspz:solved:${mode}`, [...set, index]);
      loadCounts();
      recordWin('chess-puzzles');
      setMessage(`Checkmate! Solved${mistakes ? ` after ${mistakes} wrong ${mistakes === 1 ? 'try' : 'tries'}` : ' on the first try'}.`);
    }
    setAnnounce('Checkmate. Puzzle solved.');
  };

  const fail = (sq: number) => {
    setMistakes((n) => n + 1);
    setWrong(sq);
    setSelected(-1);
    writeJson('chesspz:streak', 0);
    setStreak(0);
    synth.current.tone(200, 120, 'square', 0.05);
    const msg = stage === 'second' ? 'Not mate. Look for a move that leaves the king no escape.' : 'Not the key move. Try again.';
    setMessage(msg);
    setAnnounce(msg);
    window.setTimeout(() => setWrong(-1), 700);
  };

  /** The answer for the current stage: the key move, or a mating move after the defence. */
  const answer = (): Move | null => {
    const g = game.current;
    if (stage === 'first') return g.moves().find((m) => uci(m) === puzzle.key) ?? null;
    if (stage === 'second') return matingMoves(g, 1)[0] ?? null;
    return null;
  };

  const play = (m: Move) => {
    const g = game.current;
    const san = g.san(m);
    g.play(m);
    synth.current.tone(m.captured ? 330 : 520, 60, 'triangle', 0.08);
    setSelected(-1);
    setHint(-1);
    setTick((n) => n + 1);
    return san;
  };

  const attempt = (m: Move) => {
    const g = game.current;
    if (stage === 'first') {
      if (uci(m) !== puzzle.key) return fail(m.to);
      const san = play(m);
      if (puzzle.mate === 1) return succeed();
      setStage('reply');
      setMessage(`${san}! Good move. Now the defence…`);
      timer.current = window.setTimeout(() => {
        const r = bestDefence(g);
        if (!r) return;
        const rs = play(r);
        setStage('second');
        const msg = `${rs}. Now finish it: mate in 1.`;
        setMessage(msg);
        setAnnounce(`${san}, ${rs}. Mate in 1.`);
        if (revealedRef.current) {
          timer.current = window.setTimeout(() => {
            const mate = matingMoves(g, 1)[0];
            if (mate) {
              play(mate);
              succeed();
            }
          }, 650);
        }
      }, 650);
    } else if (stage === 'second') {
      if (!matingMoves(g).some((x) => uci(x) === uci(m))) return fail(m.to);
      play(m);
      succeed();
    }
  };

  const tapSquare = (s: number) => {
    const g = game.current;
    setCursor(s);
    if (stage !== 'first' && stage !== 'second') return;
    if (selected >= 0) {
      const moves = g.moves(selected).filter((m) => m.to === s);
      if (moves.length) {
        // Promotion: take the promotion the solution needs, otherwise a queen.
        const want = answer();
        attempt(moves.find((m) => want && uci(m) === uci(want)) ?? moves.find((m) => m.promo === 5) ?? moves[0]!);
        return;
      }
    }
    const p = g.board[s]!;
    if (p && colorOf(p) === g.turn && g.moves(s).length) {
      setSelected(s === selected ? -1 : s);
      setAnnounce(`${PIECE_NAMES[typeOf(p)]} on ${squareName(s)} selected.`);
    } else setSelected(-1);
  };

  const showHint = () => {
    const a = answer();
    if (!a) return;
    if (hint < 0) {
      setHint(a.from);
      const p = game.current.board[a.from]!;
      const msg = `Hint: move the ${PIECE_NAMES[typeOf(p)]} on ${squareName(a.from)}.`;
      setMessage(msg);
      setAnnounce(msg);
      return;
    }
    // Second press: show the solution.
    revealedRef.current = true;
    writeJson('chesspz:streak', 0);
    setStreak(0);
    if (mode === 'daily') recordDaily('chess-puzzles', false);
    attempt(a);
  };

  const next = () => {
    if (mode === 'daily') return open('mate2', readJson<number>('chesspz:current:mate2', 0));
    const set = solvedSet(mode);
    let i = (index + 1) % SETS[mode].length;
    for (let k = 0; k < SETS[mode].length && set.includes(i); k++) i = (i + 1) % SETS[mode].length;
    open(mode, i);
  };

  const g = game.current;
  const flipped = solver === BLACK;
  const active = stage === 'first' || stage === 'second';
  const targets = new Set(selected >= 0 && active ? g.moves(selected).map((m) => m.to) : []);
  const last = g.played[g.played.length - 1];
  const checkSq = g.inCheck() ? g.kings[g.turn] : -1;
  const order = Array.from({ length: 64 }, (_, i) => {
    const r = Math.floor(i / 8);
    const c = i % 8;
    return flipped ? r * 8 + (7 - c) : (7 - r) * 8 + c;
  });

  const onKeyDown = (e: KeyboardEvent) => {
    const d = { ArrowUp: flipped ? -8 : 8, ArrowDown: flipped ? 8 : -8, ArrowLeft: flipped ? 1 : -1, ArrowRight: flipped ? -1 : 1 }[e.key];
    if (d !== undefined) {
      e.preventDefault();
      const n = cursor + d;
      if (n < 0 || n > 63 || (Math.abs(d) === 1 && Math.floor(n / 8) !== Math.floor(cursor / 8))) return;
      setCursor(n);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      tapSquare(cursor);
    } else if (e.key === 'Escape') setSelected(-1);
  };

  const total = mode === 'daily' ? 0 : SETS[mode].length;

  return (
    <section class="game" aria-label="Chess puzzles">
      <div class="toolbar" role="toolbar" aria-label="Puzzle controls">
        <div class="segmented" role="radiogroup" aria-label="Puzzle set">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              class="seg"
              aria-checked={mode === m.id}
              onClick={() => open(m.id, m.id === 'daily' ? 0 : readJson<number>(`chesspz:current:${m.id}`, 0) % SETS[m.id].length)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <button type="button" class="btn" onClick={showHint} disabled={!active}>
          {hint >= 0 ? 'Show solution' : 'Hint'}
        </button>
        <button type="button" class="btn" onClick={() => open(mode, index)} disabled={stage === 'first' && !g.played.length}>
          Retry
        </button>
        <dl class="stats">
          <div>
            <dt>{mode === 'daily' ? `Daily #${day}` : 'Puzzle'}</dt>
            <dd class="tabular-nums">{mode === 'daily' ? `Mate in ${puzzle.mate}` : `${index + 1}/${total}`}</dd>
          </div>
          <div>
            <dt>Solved</dt>
            <dd class="tabular-nums">{solvedCount.mate1 + solvedCount.mate2}</dd>
          </div>
          <div>
            <dt>Streak</dt>
            <dd class="tabular-nums">{streak}</dd>
          </div>
        </dl>
      </div>
      <div class="arcade-area">
        <p class="arcade-message" aria-hidden="true">
          {message}
        </p>
        <div class="sq-fit">
          <div class="chess-board" role="grid" aria-label={`Chess puzzle board. ${sideName} to move, mate in ${puzzle.mate}.`} tabIndex={0} onKeyDown={onKeyDown}>
            {order.map((s) => {
              const p = g.board[s]!;
              const light = ((s >> 3) + (s & 7)) % 2 === 1;
              const cls = [
                'chess-sq',
                light ? 'is-light' : 'is-dark',
                s === selected ? 'is-sel' : '',
                last && (last.from === s || last.to === s) ? 'is-last' : '',
                s === checkSq ? 'is-check' : '',
                targets.has(s) ? (p ? 'is-capture' : 'is-target') : '',
                s === cursor ? 'is-cursor' : '',
                s === hint ? 'is-hint' : '',
                s === wrong ? 'is-wrong' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <button
                  key={s}
                  type="button"
                  role="gridcell"
                  class={cls}
                  tabIndex={-1}
                  aria-label={`${squareName(s)}${p ? `, ${colorOf(p) === WHITE ? 'white' : 'black'} ${PIECE_NAMES[typeOf(p)]}` : ''}${targets.has(s) ? ', can move here' : ''}`}
                  onClick={() => tapSquare(s)}
                >
                  {p ? <span class="chess-piece" dangerouslySetInnerHTML={{ __html: pieceSvg(typeOf(p), colorOf(p) === WHITE) }} /> : null}
                </button>
              );
            })}
          </div>
        </div>
        {stage === 'solved' && (
          <div class="four-over">
            <button type="button" class="btn btn-primary" onClick={next}>
              {mode === 'daily' ? 'More mate in 2 puzzles' : 'Next puzzle'}
            </button>
            {mode === 'daily' && (
              <a class="btn" href="/daily/">
                Daily challenges
              </a>
            )}
          </div>
        )}
      </div>
      <p class="sr-only" aria-live="polite">
        {announce}
      </p>
      <noscript dangerouslySetInnerHTML={{ __html: '<p class="noscript">Chess puzzles need JavaScript to run. Please enable it to play.</p>' }} />
    </section>
  );
}
