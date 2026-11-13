import { useEffect, useRef, useState } from 'preact/hooks';
import { readJson, writeJson } from '../../engines/core/storage';
import { recordWin } from '../../engines/core/progress';
import { Synth } from '../../engines/arcade/audio';
import { COLS, FourRow, ROWS, bestMove, type Level } from '../../engines/puzzles/fourrow';

type Opponent = Level | 'friend';
const OPPONENTS: { id: Opponent; label: string }[] = [
  { id: 'easy', label: 'Easy' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' },
  { id: 'friend', label: '2 players' },
];
const NAMES = { 1: 'Red', 2: 'Gold' } as const;
interface Record3 {
  won: number;
  lost: number;
  drawn: number;
}

export default function FourInRowGame() {
  const game = useRef(new FourRow());
  const synth = useRef(new Synth());
  const [opponent, setOpponent] = useState<Opponent>('medium');
  const [, setTick] = useState(0);
  const [hover, setHover] = useState(3);
  const [thinking, setThinking] = useState(false);
  const [human, setHuman] = useState<1 | 2>(1);
  const [last, setLast] = useState<[number, number] | null>(null);
  const [record, setRecord] = useState<Record3>({ won: 0, lost: 0, drawn: 0 });
  const [announce, setAnnounce] = useState('');
  const aiTimer = useRef(0);
  const boardRef = useRef<HTMLDivElement>(null);

  const recKey = (o: Opponent) => `fourrow:record:${o}`;
  const refresh = () => setTick((n) => n + 1);
  const vsAi = opponent !== 'friend';

  const finish = (opp: Opponent, me: 1 | 2) => {
    const g = game.current;
    if (!g.over || opp === 'friend') return;
    const r = readJson<Record3>(recKey(opp), { won: 0, lost: 0, drawn: 0 });
    if (g.draw) r.drawn++;
    else if (g.winner === me) {
      r.won++;
      recordWin('four-in-a-row');
    } else r.lost++;
    writeJson(recKey(opp), r);
    setRecord(r);
  };

  const describe = (opp: Opponent, me: 1 | 2) => {
    const g = game.current;
    if (g.draw) return 'A draw: the grid is full.';
    if (g.winner) {
      if (opp === 'friend') return `${NAMES[g.winner]} wins!`;
      return g.winner === me ? 'You win!' : 'The computer wins.';
    }
    if (opp === 'friend') return `${NAMES[g.turn]} to play.`;
    return g.turn === me ? 'Your turn: drop a disc.' : 'Computer is thinking…';
  };

  const drop = (col: number, opp = opponent, me = human): boolean => {
    const g = game.current;
    const row = g.drop(col);
    if (row < 0) return false;
    setLast([row, col]);
    synth.current.tone(g.winner ? 660 : 300 + row * 40, 70, 'triangle', 0.1);
    if (g.over) {
      if (g.winner) window.setTimeout(() => synth.current.tone(880, 260, 'triangle', 0.14), 120);
      finish(opp, me);
    }
    setAnnounce(`${NAMES[g.turn === 1 ? 2 : 1]} disc in column ${col + 1}. ${describe(opp, me)}`);
    refresh();
    return true;
  };

  const aiMove = (opp: Opponent, me: 1 | 2) => {
    const g = game.current;
    if (opp === 'friend' || g.over || g.turn === me) return;
    setThinking(true);
    window.clearTimeout(aiTimer.current);
    aiTimer.current = window.setTimeout(() => {
      drop(bestMove(g, opp as Level), opp, me);
      setThinking(false);
    }, 380);
  };

  const start = (opp: Opponent = opponent, alternate = true) => {
    window.clearTimeout(aiTimer.current);
    setThinking(false);
    const prevFirst = human;
    // Against the computer, the first move alternates between games.
    const me: 1 | 2 = opp === 'friend' || !alternate ? 1 : prevFirst === 1 && game.current.moves.length > 0 ? 2 : 1;
    game.current = new FourRow();
    setOpponent(opp);
    setHuman(me);
    setLast(null);
    setRecord(readJson<Record3>(recKey(opp), { won: 0, lost: 0, drawn: 0 }));
    writeJson('fourrow:opponent', opp);
    setAnnounce(opp === 'friend' ? 'New game for two players. Red starts.' : me === 1 ? 'New game. You are Red and start.' : 'New game. You are Gold; the computer starts.');
    refresh();
    if (opp !== 'friend' && me === 2) aiMove(opp, me);
  };

  const play = (col: number) => {
    const g = game.current;
    if (g.over || thinking || (vsAi && g.turn !== human)) return;
    if (drop(col)) aiMove(opponent, human);
  };

  const undo = () => {
    const g = game.current;
    window.clearTimeout(aiTimer.current);
    setThinking(false);
    if (vsAi) {
      // Take back the computer's reply and your own move.
      if (g.turn === human && g.moves.length >= 2) {
        g.undo();
        g.undo();
      } else if (g.turn !== human && g.moves.length >= 1) g.undo();
      if (g.turn !== human) aiMove(opponent, human);
    } else g.undo();
    setLast(null);
    setAnnounce(`Move taken back. ${describe(opponent, human)}`);
    refresh();
  };

  useEffect(() => {
    const o = readJson<Opponent>('fourrow:opponent', 'medium');
    start(OPPONENTS.some((x) => x.id === o) ? o : 'medium', false);
    return () => window.clearTimeout(aiTimer.current);
  }, []);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key >= '1' && e.key <= '7') {
      e.preventDefault();
      play(Number(e.key) - 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      setHover((h) => Math.max(0, Math.min(COLS - 1, h + (e.key === 'ArrowLeft' ? -1 : 1))));
    } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      play(hover);
    }
  };

  const g = game.current;
  const winSet = new Set((g.line ?? []).map(([r, c]) => r * COLS + c));
  const status = describe(opponent, human);
  const myTurn = !g.over && !thinking && (!vsAi || g.turn === human);

  return (
    <section class="game" aria-label="Four in a Row">
      <div class="toolbar" role="toolbar" aria-label="Game controls">
        <button type="button" class="btn btn-primary" onClick={() => start()}>
          New game
        </button>
        <button type="button" class="btn" onClick={undo} disabled={vsAi ? (human === 1 ? Math.ceil(g.moves.length / 2) : Math.floor(g.moves.length / 2)) === 0 : g.moves.length === 0}>
          Undo
        </button>
        <div class="segmented" role="radiogroup" aria-label="Opponent">
          {OPPONENTS.map((o) => (
            <button key={o.id} type="button" role="radio" class="seg" aria-checked={opponent === o.id} onClick={() => start(o.id, false)}>
              {o.label}
            </button>
          ))}
        </div>
        {vsAi && (
          <dl class="stats">
            <div>
              <dt>Won</dt>
              <dd class="tabular-nums">{record.won}</dd>
            </div>
            <div>
              <dt>Lost</dt>
              <dd class="tabular-nums">{record.lost}</dd>
            </div>
            <div>
              <dt>Drawn</dt>
              <dd class="tabular-nums">{record.drawn}</dd>
            </div>
          </dl>
        )}
      </div>
      <div class="arcade-area">
        <p class="arcade-message four-status" aria-hidden="true">
          <span class={`four-dot four-p${g.over ? (g.winner || 1) : g.turn}`} /> {status}
        </p>
        <div class="sq-fit" style={{ '--ratio': COLS / (ROWS + 0.6) }}>
          <div
            ref={boardRef}
            class={`four-board${myTurn ? ' is-live' : ''}`}
            tabIndex={0}
            role="application"
            aria-roledescription="Four in a Row board"
            aria-label={`Four in a Row. Press 1 to 7 to drop a disc in that column, or move with the arrow keys and press Enter. ${status}`}
            onKeyDown={onKeyDown}
            onPointerLeave={() => setHover(-1)}
          >
            <div class="four-cols">
              {Array.from({ length: COLS }, (_, c) => (
                <button
                  key={c}
                  type="button"
                  class={`four-col${hover === c && myTurn && g.canDrop(c) ? ' is-hover' : ''}`}
                  aria-label={`Column ${c + 1}${g.canDrop(c) ? '' : ', full'}`}
                  tabIndex={-1}
                  disabled={!g.canDrop(c)}
                  onPointerEnter={() => setHover(c)}
                  onClick={() => play(c)}
                >
                  <span class={`four-ghost four-p${g.turn}`} aria-hidden="true" />
                </button>
              ))}
            </div>
            <div class="four-grid" aria-hidden="true">
              {Array.from({ length: ROWS }, (_, vr) => {
                const r = ROWS - 1 - vr;
                return Array.from({ length: COLS }, (_, c) => {
                  const p = g.board[r]![c]!;
                  const isLast = last && last[0] === r && last[1] === c;
                  return (
                    <div key={`${r}-${c}`} class="four-hole">
                      {p !== 0 && (
                        <span
                          class={`four-disc four-p${p}${isLast ? ' is-drop' : ''}${winSet.has(r * COLS + c) ? ' is-win' : ''}`}
                          style={{ '--fall': vr + 1 }}
                        />
                      )}
                    </div>
                  );
                });
              })}
            </div>
          </div>
        </div>
        {g.over && (
          <div class="four-over">
            <button type="button" class="btn btn-primary" onClick={() => start()}>
              Play again
            </button>
          </div>
        )}
      </div>
      <p class="sr-only" aria-live="polite">
        {announce}
      </p>
      <noscript dangerouslySetInnerHTML={{ __html: '<p class="noscript">Four in a Row needs JavaScript to run. Please enable it to play.</p>' }} />
    </section>
  );
}
