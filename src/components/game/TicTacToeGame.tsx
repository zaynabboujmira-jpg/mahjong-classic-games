import { useEffect, useRef, useState } from 'preact/hooks';
import { readJson, writeJson } from '../../engines/core/storage';
import { recordWin } from '../../engines/core/progress';
import { Synth } from '../../engines/arcade/audio';
import { Grid, O, X, bestGomoku, bestTicTacToe, type TttLevel } from '../../engines/board/tictactoe';

type Mode = 'ttt' | 'five';
type Opponent = TttLevel | 'friend';
const LEVELS: Record<Mode, { id: Opponent; label: string }[]> = {
  ttt: [
    { id: 'easy', label: 'Easy' },
    { id: 'medium', label: 'Medium' },
    { id: 'hard', label: 'Unbeatable' },
    { id: 'friend', label: '2 players' },
  ],
  five: [
    { id: 'easy', label: 'Easy' },
    { id: 'hard', label: 'Hard' },
    { id: 'friend', label: '2 players' },
  ],
};
interface Rec {
  won: number;
  lost: number;
  drawn: number;
}

export default function TicTacToeGame() {
  const game = useRef(new Grid(3));
  const synth = useRef(new Synth());
  const [, setTick] = useState(0);
  const [mode, setMode] = useState<Mode>('ttt');
  const [opponent, setOpponent] = useState<Opponent>('hard');
  const [human, setHuman] = useState<1 | 2>(X);
  const [cursor, setCursor] = useState(4);
  const [record, setRecord] = useState<Rec>({ won: 0, lost: 0, drawn: 0 });
  const [announce, setAnnounce] = useState('');
  const timer = useRef(0);
  const refresh = () => setTick((n) => n + 1);
  const vsAi = opponent !== 'friend';
  const recKey = (m: Mode, o: Opponent) => `ttt:record:${m}:${o}`;
  const mark = (v: number) => (v === X ? 'X' : 'O');

  const finish = (m: Mode, opp: Opponent, me: 1 | 2) => {
    const g = game.current;
    if (!g.over) return;
    if (opp !== 'friend') {
      const r = readJson<Rec>(recKey(m, opp), { won: 0, lost: 0, drawn: 0 });
      if (!g.winner) r.drawn++;
      else if (g.winner === me) {
        r.won++;
        recordWin('tic-tac-toe');
      } else r.lost++;
      writeJson(recKey(m, opp), r);
      setRecord(r);
    }
    synth.current.tone(g.winner ? 784 : 330, 260, 'triangle', 0.12);
  };

  const status = () => {
    const g = game.current;
    if (g.winner) return vsAi ? (g.winner === human ? 'You win!' : 'The computer wins.') : `${mark(g.winner)} wins!`;
    if (g.full) return "It's a draw.";
    if (!vsAi) return `${mark(g.turn)} to play.`;
    return g.turn === human ? `Your turn (${mark(human)}).` : 'Computer is thinking…';
  };

  const place = (i: number, m = mode, opp = opponent, me = human) => {
    const g = game.current;
    if (!g.play(i)) return false;
    synth.current.tone(g.turn === O ? 520 : 400, 50, 'triangle', 0.08);
    if (g.over) finish(m, opp, me);
    setAnnounce(`${mark(g.cells[i]!)} at row ${Math.floor(i / g.size) + 1}, column ${(i % g.size) + 1}. ${status()}`);
    refresh();
    return true;
  };

  const aiMove = (m: Mode, opp: Opponent, me: 1 | 2) => {
    const g = game.current;
    if (opp === 'friend' || g.over || g.turn === me) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const i = m === 'ttt' ? bestTicTacToe(g, opp as TttLevel) : bestGomoku(g, opp === 'easy' ? 'easy' : 'hard');
      place(i, m, opp, me);
    }, 320);
  };

  const start = (m: Mode = mode, opp: Opponent = opponent, swap = false) => {
    window.clearTimeout(timer.current);
    const levels = LEVELS[m];
    const o = levels.some((l) => l.id === opp) ? opp : 'hard';
    game.current = new Grid(m === 'ttt' ? 3 : 15);
    // Against the computer, X (who moves first) alternates between games.
    const me: 1 | 2 = o === 'friend' ? X : swap ? (human === X ? O : X) : human;
    setMode(m);
    setOpponent(o);
    setHuman(me);
    setCursor(m === 'ttt' ? 4 : 112);
    setRecord(readJson<Rec>(recKey(m, o), { won: 0, lost: 0, drawn: 0 }));
    writeJson('ttt:settings', { mode: m, opponent: o });
    setAnnounce(`New ${m === 'ttt' ? 'Tic Tac Toe' : 'Five in a Row'} game. ${o === 'friend' ? 'X starts.' : `You are ${mark(me)}.`}`);
    refresh();
    if (o !== 'friend' && me === O) aiMove(m, o, me);
  };

  const tap = (i: number) => {
    const g = game.current;
    setCursor(i);
    if (g.over || (vsAi && g.turn !== human)) return;
    if (place(i)) aiMove(mode, opponent, human);
  };

  useEffect(() => {
    const s = readJson<{ mode: Mode; opponent: Opponent }>('ttt:settings', { mode: 'ttt', opponent: 'hard' });
    start(s.mode === 'five' ? 'five' : 'ttt', s.opponent);
    return () => window.clearTimeout(timer.current);
  }, []);

  const g = game.current;
  const n = g.size;
  const win = new Set(g.line ?? []);
  const last = g.moves[g.moves.length - 1];

  const onKeyDown = (e: KeyboardEvent) => {
    const d = { ArrowUp: -n, ArrowDown: n, ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (d !== undefined) {
      e.preventDefault();
      const next = cursor + d;
      if (next < 0 || next >= n * n || (Math.abs(d) === 1 && Math.floor(next / n) !== Math.floor(cursor / n))) return;
      setCursor(next);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      tap(cursor);
    } else if (mode === 'ttt' && e.key >= '1' && e.key <= '9') {
      e.preventDefault();
      tap(Number(e.key) - 1);
    }
  };

  return (
    <section class="game" aria-label="Tic Tac Toe">
      <div class="toolbar" role="toolbar" aria-label="Game controls">
        <button type="button" class="btn btn-primary" onClick={() => start(mode, opponent, vsAi)}>
          New game
        </button>
        <div class="segmented" role="radiogroup" aria-label="Game">
          <button type="button" role="radio" class="seg" aria-checked={mode === 'ttt'} onClick={() => start('ttt', opponent)}>
            3×3
          </button>
          <button type="button" role="radio" class="seg" aria-checked={mode === 'five'} onClick={() => start('five', opponent)}>
            Five in a Row
          </button>
        </div>
        <div class="segmented" role="radiogroup" aria-label="Opponent">
          {LEVELS[mode].map((o) => (
            <button key={o.id} type="button" role="radio" class="seg" aria-checked={opponent === o.id} onClick={() => start(mode, o.id)}>
              {o.label}
            </button>
          ))}
        </div>
        {vsAi && (
          <dl class="stats">
            <div>
              <dt>W/L/D</dt>
              <dd class="tabular-nums">
                {record.won}/{record.lost}/{record.drawn}
              </dd>
            </div>
          </dl>
        )}
      </div>
      <div class="arcade-area">
        <p class="arcade-message" aria-hidden="true">
          {status()}
        </p>
        <div class="sq-fit">
          <div
            class={`ttt-grid${mode === 'five' ? ' is-five' : ''}`}
            style={{ '--n': n }}
            role="grid"
            aria-label={`${mode === 'ttt' ? 'Tic Tac Toe' : 'Five in a Row'} board, ${n} by ${n}. ${status()}`}
            tabIndex={0}
            onKeyDown={onKeyDown}
          >
            {g.cells.map((v, i) => (
              <button
                key={i}
                type="button"
                role="gridcell"
                tabIndex={-1}
                class={`ttt-cell${v ? (v === X ? ' is-x' : ' is-o') : ''}${win.has(i) ? ' is-win' : ''}${i === last ? ' is-last' : ''}${i === cursor ? ' is-cursor' : ''}`}
                aria-label={`Row ${Math.floor(i / n) + 1}, column ${(i % n) + 1}: ${v ? mark(v) : 'empty'}`}
                onClick={() => tap(i)}
              >
                {v ? <span aria-hidden="true">{mark(v)}</span> : null}
              </button>
            ))}
          </div>
        </div>
        {g.over && (
          <div class="four-over">
            <button type="button" class="btn btn-primary" onClick={() => start(mode, opponent, vsAi)}>
              Play again
            </button>
          </div>
        )}
      </div>
      <p class="sr-only" aria-live="polite">
        {announce}
      </p>
      <noscript dangerouslySetInnerHTML={{ __html: '<p class="noscript">Tic Tac Toe needs JavaScript to run. Please enable it to play.</p>' }} />
    </section>
  );
}
