import { useEffect, useRef, useState } from 'preact/hooks';
import { readJson, writeJson } from '../../engines/core/storage';
import { recordWin } from '../../engines/core/progress';
import { Synth } from '../../engines/arcade/audio';
import { Checkers, RED, WHITE, chooseCheckersMove, isDark, isKing, sideOf, type CMove, type CheckersLevel, type Side } from '../../engines/board/checkers';

type Opponent = CheckersLevel | 'friend';
const OPPONENTS: { id: Opponent; label: string }[] = [
  { id: 'easy', label: 'Easy' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' },
  { id: 'friend', label: '2 players' },
];
const NAME = { [RED]: 'Red', [WHITE]: 'White' } as const;
const label = (s: number) => `${'abcdefgh'[s & 7]}${8 - (s >> 3)}`;
interface Rec {
  won: number;
  lost: number;
  drawn: number;
}

export default function CheckersGame() {
  const game = useRef(new Checkers());
  const synth = useRef(new Synth());
  const [, setTick] = useState(0);
  const [opponent, setOpponent] = useState<Opponent>('medium');
  /** The path chosen so far for a move (start square, then landing squares). */
  const [path, setPath] = useState<number[]>([]);
  const [thinking, setThinking] = useState(false);
  const [record, setRecord] = useState<Rec>({ won: 0, lost: 0, drawn: 0 });
  const [cursor, setCursor] = useState(40);
  const [announce, setAnnounce] = useState('');
  const aiTimer = useRef(0);
  const human: Side = RED;
  const vsAi = opponent !== 'friend';
  const refresh = () => setTick((n) => n + 1);
  const recKey = (o: Opponent) => `checkers:record:${o}`;

  const status = () => {
    const g = game.current;
    const res = g.result();
    if (res === 'draw') return 'Draw: forty moves each without a capture.';
    if (res) return vsAi ? (res === human ? 'You win!' : 'The computer wins.') : `${NAME[res]} wins!`;
    if (thinking) return 'Computer is thinking…';
    const must = g.moves()[0]?.captures.length ? ' You must jump.' : '';
    if (!vsAi) return `${NAME[g.turn]} to move.${must}`;
    return g.turn === human ? `Your move (Red).${must}` : 'Computer to move.';
  };

  const finish = (opp: Opponent) => {
    const g = game.current;
    const res = g.result();
    if (!res || opp === 'friend') return;
    const r = readJson<Rec>(recKey(opp), { won: 0, lost: 0, drawn: 0 });
    if (res === 'draw') r.drawn++;
    else if (res === human) {
      r.won++;
      recordWin('checkers');
    } else r.lost++;
    writeJson(recKey(opp), r);
    setRecord(r);
  };

  const play = (m: CMove, opp = opponent) => {
    const g = game.current;
    g.play(m);
    setPath([]);
    synth.current.tone(m.captures.length ? 330 : 480, 70, 'triangle', 0.09);
    if (g.result()) finish(opp);
    setAnnounce(`${label(m.path[0]!)} to ${m.path.slice(1).map(label).join(', ')}${m.captures.length ? `, ${m.captures.length} captured` : ''}. ${status()}`);
    refresh();
  };

  const aiMove = (opp: Opponent) => {
    const g = game.current;
    if (opp === 'friend' || g.result() || g.turn === human) return;
    setThinking(true);
    window.clearTimeout(aiTimer.current);
    aiTimer.current = window.setTimeout(() => {
      const m = chooseCheckersMove(g, opp as CheckersLevel, Math.random);
      setThinking(false);
      if (m) play(m, opp);
    }, 350);
  };

  const start = (opp: Opponent = opponent) => {
    window.clearTimeout(aiTimer.current);
    game.current = new Checkers();
    setThinking(false);
    setPath([]);
    setOpponent(opp);
    setRecord(readJson<Rec>(recKey(opp), { won: 0, lost: 0, drawn: 0 }));
    writeJson('checkers:opponent', opp);
    setAnnounce(opp === 'friend' ? 'New game for two players. Red moves first.' : 'New game. You are Red and move first.');
    refresh();
  };

  const canAct = () => {
    const g = game.current;
    return !g.result() && !thinking && (!vsAi || g.turn === human);
  };

  /** Moves that continue the path chosen so far. */
  const matching = (p: number[]) => game.current.moves().filter((m) => p.every((s, i) => m.path[i] === s));

  const tap = (s: number) => {
    setCursor(s);
    if (!canAct()) return;
    const g = game.current;
    if (path.length) {
      const next = matching([...path, s]);
      if (next.length) {
        const done = next.find((m) => m.path.length === path.length + 1);
        if (done && next.length === 1) {
          play(done);
          aiMove(opponent);
        } else setPath([...path, s]);
        return;
      }
    }
    if (sideOf(g.board[s]!) === g.turn && matching([s]).length) setPath(path[0] === s && path.length === 1 ? [] : [s]);
    else if (path.length === 1) setPath([]);
  };

  const undo = () => {
    const g = game.current;
    window.clearTimeout(aiTimer.current);
    setThinking(false);
    if (vsAi) {
      if (g.turn === human) {
        g.undo();
        g.undo();
      } else g.undo();
    } else g.undo();
    setPath([]);
    setAnnounce(`Move taken back. ${status()}`);
    refresh();
  };

  useEffect(() => {
    const o = readJson<Opponent>('checkers:opponent', 'medium');
    start(OPPONENTS.some((x) => x.id === o) ? o : 'medium');
    return () => window.clearTimeout(aiTimer.current);
  }, []);

  const g = game.current;
  const live = canAct();
  const movable = new Set(live ? g.moves().map((m) => m.path[0]!) : []);
  const nexts = new Set(path.length ? matching(path).map((m) => m.path[path.length]!) : []);
  const last = g.history[g.history.length - 1]?.move;
  const lastSet = new Set(last ? last.path : []);

  const onKeyDown = (e: KeyboardEvent) => {
    const d = { ArrowUp: -8, ArrowDown: 8, ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (d !== undefined) {
      e.preventDefault();
      const n = cursor + d;
      if (n < 0 || n > 63 || (Math.abs(d) === 1 && Math.floor(n / 8) !== Math.floor(cursor / 8))) return;
      setCursor(n);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      tap(cursor);
    } else if (e.key === 'Escape') setPath([]);
  };

  return (
    <section class="game" aria-label="Checkers">
      <div class="toolbar" role="toolbar" aria-label="Game controls">
        <button type="button" class="btn btn-primary" onClick={() => start()}>
          New game
        </button>
        <button type="button" class="btn" onClick={undo} disabled={g.history.length === 0}>
          Undo
        </button>
        <div class="segmented" role="radiogroup" aria-label="Opponent">
          {OPPONENTS.map((o) => (
            <button key={o.id} type="button" role="radio" class="seg" aria-checked={opponent === o.id} onClick={() => start(o.id)}>
              {o.label}
            </button>
          ))}
        </div>
        <dl class="stats">
          <div>
            <dt>Red</dt>
            <dd class="tabular-nums">{g.count(RED)}</dd>
          </div>
          <div>
            <dt>White</dt>
            <dd class="tabular-nums">{g.count(WHITE)}</dd>
          </div>
          {vsAi && (
            <div>
              <dt>W/L/D</dt>
              <dd class="tabular-nums">
                {record.won}/{record.lost}/{record.drawn}
              </dd>
            </div>
          )}
        </dl>
      </div>
      <div class="arcade-area">
        <p class="arcade-message" aria-hidden="true">
          {status()}
        </p>
        <div class="sq-fit">
          <div class="chess-board checkers-board" role="grid" aria-label="Checkers board" tabIndex={0} onKeyDown={onKeyDown}>
            {g.board.map((p, s) => {
              const dark = isDark(s);
              const cls = [
                'chess-sq',
                dark ? 'is-dark' : 'is-light',
                path.includes(s) ? 'is-sel' : '',
                lastSet.has(s) ? 'is-last' : '',
                nexts.has(s) ? 'is-target' : '',
                !path.length && movable.has(s) ? 'is-movable' : '',
                s === cursor ? 'is-cursor' : '',
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
                  disabled={!dark}
                  aria-label={`${label(s)}${p ? `, ${sideOf(p) === RED ? 'red' : 'white'} ${isKing(p) ? 'king' : 'man'}` : ''}${nexts.has(s) ? ', can move here' : ''}`}
                  onClick={() => tap(s)}
                >
                  {p ? <span class={`ck-piece ${sideOf(p) === RED ? 'ck-red' : 'ck-white'}${isKing(p) ? ' ck-king' : ''}`} /> : null}
                </button>
              );
            })}
          </div>
        </div>
        {g.result() && (
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
      <noscript dangerouslySetInnerHTML={{ __html: '<p class="noscript">Checkers needs JavaScript to run. Please enable it to play.</p>' }} />
    </section>
  );
}
