import { useEffect, useRef, useState } from 'preact/hooks';
import { readJson, writeJson } from '../../engines/core/storage';
import { recordWin } from '../../engines/core/progress';
import { Synth } from '../../engines/arcade/audio';
import { BISHOP, BLACK, Chess, KNIGHT, QUEEN, ROOK, WHITE, colorOf, squareName, typeOf, type Color, type Move } from '../../engines/board/chess';
import { chooseMove, type ChessLevel } from '../../engines/board/chess-ai';
import { PIECE_NAMES, pieceSvg } from './chess-pieces';

type Opponent = ChessLevel | 'friend';
const OPPONENTS: { id: Opponent; label: string }[] = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'club', label: 'Club' },
  { id: 'tactician', label: 'Tactician' },
  { id: 'friend', label: '2 players' },
];
const OUTCOME_TEXT: Record<string, string> = {
  stalemate: 'Draw by stalemate.',
  'fifty-move': 'Draw by the fifty-move rule.',
  repetition: 'Draw by threefold repetition.',
  material: 'Draw: not enough pieces to mate.',
};
interface Rec {
  won: number;
  lost: number;
  drawn: number;
}

export default function ChessGame() {
  const game = useRef(new Chess());
  const synth = useRef(new Synth());
  const [, setTick] = useState(0);
  const [opponent, setOpponent] = useState<Opponent>('club');
  const [side, setSide] = useState<Color>(WHITE);
  const [selected, setSelected] = useState(-1);
  const [cursor, setCursor] = useState(12);
  const [promo, setPromo] = useState<Move[] | null>(null);
  const [thinking, setThinking] = useState(false);
  const [record, setRecord] = useState<Rec>({ won: 0, lost: 0, drawn: 0 });
  const [announce, setAnnounce] = useState('');
  const aiTimer = useRef(0);
  const sans = useRef<string[]>([]);

  const vsAi = opponent !== 'friend';
  const refresh = () => setTick((n) => n + 1);
  const recKey = (o: Opponent) => `chess:record:${o}`;

  const status = () => {
    const g = game.current;
    const out = g.outcome();
    if (out === 'checkmate') {
      const winner = g.turn === WHITE ? 'Black' : 'White';
      if (!vsAi) return `Checkmate. ${winner} wins!`;
      return (g.turn === side ? 'Checkmate. The computer wins.' : 'Checkmate. You win!');
    }
    if (out) return OUTCOME_TEXT[out]!;
    const who = g.turn === WHITE ? 'White' : 'Black';
    const check = g.inCheck() ? ' Check!' : '';
    if (thinking) return `Computer is thinking…${check}`;
    if (!vsAi) return `${who} to move.${check}`;
    return g.turn === side ? `Your move (${who}).${check}` : `Computer to move.${check}`;
  };

  const finish = (opp: Opponent, me: Color) => {
    const g = game.current;
    const out = g.outcome();
    if (!out || opp === 'friend') return;
    const r = readJson<Rec>(recKey(opp), { won: 0, lost: 0, drawn: 0 });
    if (out === 'checkmate') {
      if (g.turn !== me) {
        r.won++;
        recordWin('chess');
      } else r.lost++;
    } else r.drawn++;
    writeJson(recKey(opp), r);
    setRecord(r);
  };

  const doMove = (m: Move, opp = opponent, me = side) => {
    const g = game.current;
    const san = g.san(m);
    g.play(m);
    sans.current.push(san);
    setSelected(-1);
    synth.current.tone(m.captured ? 330 : 520, 60, 'triangle', 0.08);
    if (g.outcome()) finish(opp, me);
    setAnnounce(`${san}. ${status()}`);
    refresh();
  };

  const aiMove = (opp: Opponent, me: Color) => {
    const g = game.current;
    if (opp === 'friend' || g.outcome() || g.turn === me) return;
    setThinking(true);
    window.clearTimeout(aiTimer.current);
    // Let the board paint first, then think.
    aiTimer.current = window.setTimeout(() => {
      const m = chooseMove(g, opp as ChessLevel, Math.random);
      setThinking(false);
      if (m) doMove(m, opp, me);
    }, 60);
  };

  const start = (opp: Opponent = opponent, me: Color = side) => {
    window.clearTimeout(aiTimer.current);
    game.current = new Chess();
    sans.current = [];
    setThinking(false);
    setSelected(-1);
    setPromo(null);
    setOpponent(opp);
    setSide(me);
    setRecord(readJson<Rec>(recKey(opp), { won: 0, lost: 0, drawn: 0 }));
    writeJson('chess:settings', { opponent: opp, side: me });
    setAnnounce(opp === 'friend' ? 'New game for two players. White to move.' : `New game. You play ${me === WHITE ? 'White' : 'Black'}.`);
    refresh();
    if (opp !== 'friend' && me === BLACK) aiMove(opp, me);
  };

  const myTurn = () => {
    const g = game.current;
    return !g.outcome() && !thinking && !promo && (!vsAi || g.turn === side);
  };

  const tapSquare = (s: number) => {
    const g = game.current;
    setCursor(s);
    if (!myTurn()) return;
    const p = g.board[s]!;
    if (selected >= 0) {
      const moves = g.moves(selected).filter((m) => m.to === s);
      if (moves.length > 1) {
        setPromo(moves);
        return;
      }
      if (moves.length === 1) {
        doMove(moves[0]!);
        aiMove(opponent, side);
        return;
      }
    }
    if (p && colorOf(p) === g.turn && g.moves(s).length) {
      setSelected(s === selected ? -1 : s);
      setAnnounce(`${PIECE_NAMES[typeOf(p)]} on ${squareName(s)} selected. ${g.moves(s).length} moves.`);
    } else setSelected(-1);
  };

  const choosePromo = (type: number) => {
    const m = promo?.find((x) => x.promo === type);
    setPromo(null);
    if (m) {
      doMove(m);
      aiMove(opponent, side);
    }
  };

  const undo = () => {
    const g = game.current;
    window.clearTimeout(aiTimer.current);
    setThinking(false);
    const back = () => {
      if (g.takeBack()) sans.current.pop();
    };
    if (vsAi) {
      if (g.turn === side) {
        back();
        back();
      } else back();
      if (g.turn !== side) aiMove(opponent, side);
    } else back();
    setSelected(-1);
    setAnnounce(`Move taken back. ${status()}`);
    refresh();
  };

  useEffect(() => {
    const s = readJson<{ opponent: Opponent; side: Color }>('chess:settings', { opponent: 'club', side: WHITE });
    start(OPPONENTS.some((o) => o.id === s.opponent) ? s.opponent : 'club', s.side === BLACK ? BLACK : WHITE);
    return () => window.clearTimeout(aiTimer.current);
  }, []);

  const g = game.current;
  const flipped = side === BLACK && vsAi;
  const targets = new Set(selected >= 0 ? g.moves(selected).map((m) => m.to) : []);
  const last = g.played[g.played.length - 1];
  const checkSq = g.inCheck() ? g.kings[g.turn] : -1;
  const order = Array.from({ length: 64 }, (_, i) => {
    const r = Math.floor(i / 8);
    const c = i % 8;
    return flipped ? r * 8 + (7 - c) : (7 - r) * 8 + c;
  });
  const moveList = sans.current
    .map((s, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${s}` : s))
    .slice(-6)
    .join(' ');

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

  return (
    <section class="game" aria-label="Chess">
      <div class="toolbar" role="toolbar" aria-label="Game controls">
        <button type="button" class="btn btn-primary" onClick={() => start()}>
          New game
        </button>
        <button type="button" class="btn" onClick={undo} disabled={g.played.length === 0 || (vsAi && g.played.length === 1 && side === BLACK)}>
          Undo
        </button>
        <button type="button" class="btn" onClick={() => start(opponent, side === WHITE ? BLACK : WHITE)} disabled={!vsAi} aria-label={`Play as ${side === WHITE ? 'Black' : 'White'} instead`}>
          Play {side === WHITE ? 'Black' : 'White'}
        </button>
        <div class="segmented" role="radiogroup" aria-label="Opponent">
          {OPPONENTS.map((o) => (
            <button key={o.id} type="button" role="radio" class="seg" aria-checked={opponent === o.id} onClick={() => start(o.id, side)}>
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
          {status()} {moveList && <span class="board-moves">{moveList}</span>}
        </p>
        <div class="sq-fit">
          <div class="chess-board" role="grid" aria-label="Chess board" tabIndex={0} onKeyDown={onKeyDown}>
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
        {promo && (
          <div class="overlay overlay-soft" role="dialog" aria-labelledby="promo-title">
            <div class="panel">
              <h2 id="promo-title">Promote to</h2>
              <div class="panel-actions">
                {[QUEEN, ROOK, BISHOP, KNIGHT].map((t) => (
                  <button key={t} type="button" class="btn promo-btn" aria-label={PIECE_NAMES[t]} onClick={() => choosePromo(t)}>
                    <span class="chess-piece" dangerouslySetInnerHTML={{ __html: pieceSvg(t, g.turn === WHITE) }} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {g.outcome() && (
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
      <noscript dangerouslySetInnerHTML={{ __html: '<p class="noscript">Chess needs JavaScript to run. Please enable it to play.</p>' }} />
    </section>
  );
}

