import { useEffect, useRef, useState } from 'preact/hooks';
import { readJson, writeJson } from '../../engines/core/storage';
import { recordWin } from '../../engines/core/progress';
import { randomSeed } from '../../engines/core/rng';
import { Synth } from '../../engines/arcade/audio';
import { BAR, BLACK, Backgammon, OFF, WHITE, chooseBgSequence, diceList, pips, type BgLevel, type BgMove, type Player } from '../../engines/board/backgammon';

type Opponent = BgLevel | 'friend';
const OPPONENTS: { id: Opponent; label: string }[] = [
  { id: 'easy', label: 'Easy' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' },
  { id: 'friend', label: '2 players' },
];
const NAME = ['White', 'Black'];
const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const TOP = [12, 13, 14, 15, 16, 17, -2, 18, 19, 20, 21, 22, 23];
const BOTTOM = [11, 10, 9, 8, 7, 6, -2, 5, 4, 3, 2, 1, 0];
const pointName = (i: number) => (i === BAR ? 'the bar' : i === OFF ? 'off' : `point ${i + 1}`);
interface Rec {
  won: number;
  lost: number;
  points: number;
}

function Die({ n, used, roll }: { n: number; used: boolean; roll: number }) {
  return (
    <span key={roll} class={`bg-die${used ? ' is-used' : ''}`} aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} class={PIPS[n]!.includes(i) ? 'bg-pip' : ''} />
      ))}
    </span>
  );
}

export default function BackgammonGame() {
  const game = useRef(new Backgammon('preview'));
  const synth = useRef(new Synth());
  const [, setTick] = useState(0);
  const [opponent, setOpponent] = useState<Opponent>('medium');
  const [sel, setSel] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [rollId, setRollId] = useState(0);
  const [record, setRecord] = useState<Rec>({ won: 0, lost: 0, points: 0 });
  const [message, setMessage] = useState('');
  const [announce, setAnnounce] = useState('');
  const timer = useRef(0);
  const refresh = () => setTick((n) => n + 1);
  const vsAi = opponent !== 'friend';
  const recKey = (o: Opponent) => `backgammon:record:${o}`;
  const human = (p: Player) => !vsAi || p === WHITE;

  const finish = (opp: Opponent) => {
    const g = game.current;
    if (g.winner === null) return;
    const kind = g.points === 3 ? 'a backgammon' : g.points === 2 ? 'a gammon' : 'the game';
    if (opp !== 'friend') {
      const r = readJson<Rec>(recKey(opp), { won: 0, lost: 0, points: 0 });
      if (g.winner === WHITE) {
        r.won++;
        r.points += g.points;
        recordWin('backgammon');
      } else r.lost++;
      writeJson(recKey(opp), r);
      setRecord(r);
      setMessage(g.winner === WHITE ? `You win ${kind}!` : `The computer wins ${kind}.`);
    } else setMessage(`${NAME[g.winner]} wins ${kind}!`);
    synth.current.tone(784, 320, 'triangle', 0.14);
    refresh();
  };

  const describeRoll = (g: Backgammon) => {
    if (!g.dice) return '';
    const moves = g.nextMoves();
    if (!moves.length) return `${NAME[g.turn]} rolled ${g.dice.join('-')}: no legal move.`;
    return `${NAME[g.turn]} rolled ${g.dice.join('-')}.`;
  };

  const aiTurn = (opp: Opponent) => {
    const g = game.current;
    if (opp === 'friend' || g.winner !== null || g.turn !== BLACK) return;
    setBusy(true);
    timer.current = window.setTimeout(() => {
      if (!g.dice) {
        g.roll();
        setRollId((n) => n + 1);
        synth.current.tone(220, 80, 'square', 0.05);
      }
      setMessage(describeRoll(g));
      refresh();
      const seq = chooseBgSequence(g, opp as BgLevel);
      const playNext = (k: number) => {
        if (k >= seq.length) {
          timer.current = window.setTimeout(() => {
            if (g.winner !== null) {
              setBusy(false);
              finish(opp);
              return;
            }
            g.endTurn();
            setBusy(false);
            setMessage('Your turn: roll the dice.');
            refresh();
          }, 500);
          return;
        }
        timer.current = window.setTimeout(() => {
          g.move(seq[k]!);
          synth.current.tone(seq[k]!.hit ? 300 : 520, 50, 'triangle', 0.08);
          setAnnounce(`Black moves ${pointName(seq[k]!.from)} to ${pointName(seq[k]!.to)}${seq[k]!.hit ? ', hitting' : ''}.`);
          refresh();
          playNext(k + 1);
        }, 450);
      };
      playNext(0);
    }, 600);
  };

  const start = (opp: Opponent = opponent) => {
    window.clearTimeout(timer.current);
    const g = new Backgammon(randomSeed());
    game.current = g;
    setOpponent(opp);
    setSel(null);
    setBusy(false);
    setRecord(readJson<Rec>(recKey(opp), { won: 0, lost: 0, points: 0 }));
    writeJson('backgammon:opponent', opp);
    const d = g.opening();
    setRollId((n) => n + 1);
    const first = g.turn === WHITE ? (opp === 'friend' ? 'White' : 'You') : opp === 'friend' ? 'Black' : 'The computer';
    setMessage(`Opening roll ${d.join('-')}: ${first} ${first === 'You' ? 'go' : 'goes'} first.`);
    setAnnounce(`New game. Opening roll ${d.join(' and ')}. ${first} first.`);
    refresh();
    if (opp !== 'friend' && g.turn === BLACK) aiTurn(opp);
  };

  const roll = () => {
    const g = game.current;
    if (g.dice || busy || g.winner !== null) return;
    g.roll();
    setRollId((n) => n + 1);
    synth.current.tone(220, 80, 'square', 0.05);
    const text = describeRoll(g);
    setMessage(text);
    setAnnounce(text);
    setSel(null);
    refresh();
  };

  const done = () => {
    const g = game.current;
    if (!g.endTurn()) return;
    setSel(null);
    setMessage(vsAi ? 'Computer is thinking…' : `${NAME[g.turn]} to roll.`);
    refresh();
    aiTurn(opponent);
  };

  const doMove = (m: BgMove) => {
    const g = game.current;
    g.move(m);
    synth.current.tone(m.hit ? 300 : 520, 50, 'triangle', 0.08);
    setAnnounce(`${pointName(m.from)} to ${pointName(m.to)}${m.hit ? ', hit!' : ''}.`);
    setSel(null);
    if (g.winner !== null) finish(opponent);
    else if (g.turnComplete) setMessage('Turn complete: press Done, or Undo to change it.');
    refresh();
  };

  const tapPoint = (i: number) => {
    const g = game.current;
    if (busy || !g.dice || !human(g.turn) || g.winner !== null) return;
    const moves = g.nextMoves();
    if (sel !== null) {
      // The higher die first when two dice reach different points is handled by listing both.
      const m = moves.find((x) => x.from === sel && x.to === i);
      if (m) return doMove(m);
    }
    if (moves.some((x) => x.from === i)) setSel(sel === i ? null : i);
    else setSel(null);
  };

  useEffect(() => {
    const o = readJson<Opponent>('backgammon:opponent', 'medium');
    start(OPPONENTS.some((x) => x.id === o) ? o : 'medium');
    return () => window.clearTimeout(timer.current);
  }, []);

  const g = game.current;
  const p = g.pos;
  const myTurn = !busy && g.winner === null && human(g.turn);
  const moves = myTurn && g.dice ? g.nextMoves() : [];
  const sources = new Set(moves.map((m) => m.from));
  const targets = new Set(sel !== null ? moves.filter((m) => m.from === sel).map((m) => m.to) : []);
  const used = [...g.played.map((m) => m.die)];
  const dice = g.dice ? diceList(g.dice) : [];
  const usedFlags = dice.map((d) => {
    const k = used.indexOf(d);
    if (k >= 0) {
      used.splice(k, 1);
      return true;
    }
    return false;
  });

  const stack = (count: number, color: Player, top: boolean) => {
    const shown = Math.min(count, 5);
    return (
      <span class={`bg-stack${top ? ' is-top' : ''}`}>
        {Array.from({ length: shown }, (_, k) => (
          <span key={k} class={`bg-chk ${color === WHITE ? 'bg-w' : 'bg-b'}`}>
            {k === shown - 1 && count > 5 ? count : ''}
          </span>
        ))}
      </span>
    );
  };

  const point = (i: number, top: boolean) => {
    if (i === -2) {
      const bw = p.bar[WHITE];
      const bb = p.bar[BLACK];
      return (
        <button
          key={`bar-${top}`}
          type="button"
          class={`bg-bar${sources.has(BAR) && !top ? ' is-source' : ''}${sel === BAR && !top ? ' is-sel' : ''}`}
          aria-label={top ? `Bar: ${bb} black` : `Bar: ${bw} white`}
          onClick={() => !top && tapPoint(BAR)}
        >
          {top ? bb > 0 && stack(bb, BLACK, true) : bw > 0 && stack(bw, WHITE, false)}
        </button>
      );
    }
    const v = p.board[i]!;
    const n = Math.abs(v);
    const color: Player = v > 0 ? WHITE : BLACK;
    return (
      <button
        key={i}
        type="button"
        class={`bg-pt ${top ? 'is-top' : 'is-bottom'} ${i % 2 ? 'bg-pt-a' : 'bg-pt-b'}${sources.has(i) ? ' is-source' : ''}${sel === i ? ' is-sel' : ''}${targets.has(i) ? ' is-target' : ''}`}
        aria-label={`Point ${i + 1}: ${n ? `${n} ${color === WHITE ? 'white' : 'black'}` : 'empty'}${targets.has(i) ? ', move here' : ''}`}
        onClick={() => tapPoint(i)}
      >
        {n > 0 && stack(n, color, top)}
      </button>
    );
  };

  return (
    <section class="game" aria-label="Backgammon">
      <div class="toolbar" role="toolbar" aria-label="Game controls">
        <button type="button" class="btn btn-primary" onClick={() => start()}>
          New game
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
            <dt>Pips W/B</dt>
            <dd class="tabular-nums">
              {pips(p, WHITE)}/{pips(p, BLACK)}
            </dd>
          </div>
          {vsAi && (
            <div>
              <dt>W/L</dt>
              <dd class="tabular-nums">
                {record.won}/{record.lost}
              </dd>
            </div>
          )}
        </dl>
      </div>
      <div class="board-area bg-area">
        <p class="arcade-message" aria-hidden="true">
          {message}
        </p>
        <div class="sq-fit" style={{ '--ratio': 1.25 }}>
          <div class="bg-wrap">
            <div class="bg-board" role="group" aria-label="Backgammon board">
              <div class="bg-row">{TOP.map((i) => point(i, true))}</div>
              <div class="bg-middle">
                {dice.length > 0 && (
                  <span class="bg-dice">
                    {dice.slice(0, dice.length === 4 ? 4 : 2).map((d, k) => (
                      <Die key={k} n={d} used={usedFlags[k]!} roll={rollId} />
                    ))}
                  </span>
                )}
              </div>
              <div class="bg-row">{BOTTOM.map((i) => point(i, false))}</div>
            </div>
            <div class="bg-tray">
              <span class="bg-off" aria-label={`Black borne off: ${p.off[BLACK]}`}>
                {p.off[BLACK]}
              </span>
              <button
                type="button"
                class={`bg-off-btn${targets.has(OFF) ? ' is-target' : ''}`}
                aria-label={`Bear off. White borne off: ${p.off[WHITE]}`}
                onClick={() => tapPoint(OFF)}
              >
                {p.off[WHITE]}
              </button>
            </div>
          </div>
        </div>
        <div class="bg-actions">
          {myTurn && !g.dice && (
            <button type="button" class="btn btn-primary" onClick={roll}>
              Roll dice
            </button>
          )}
          {myTurn && g.dice && (
            <>
              <button
                type="button"
                class="btn"
                disabled={!g.played.length}
                onClick={() => {
                  g.undoMove();
                  setSel(null);
                  setMessage(describeRoll(g));
                  refresh();
                }}
              >
                Undo move
              </button>
              <button type="button" class="btn btn-primary" disabled={!g.turnComplete} onClick={done}>
                Done
              </button>
            </>
          )}
          {g.winner !== null && (
            <button type="button" class="btn btn-primary" onClick={() => start()}>
              Play again
            </button>
          )}
        </div>
      </div>
      <p class="sr-only" aria-live="polite">
        {announce}
      </p>
      <noscript dangerouslySetInnerHTML={{ __html: '<p class="noscript">Backgammon needs JavaScript to run. Please enable it to play.</p>' }} />
    </section>
  );
}
