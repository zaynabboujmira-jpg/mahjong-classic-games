import { useEffect, useRef, useState } from 'preact/hooks';
import { readJson, removeKey, writeJson } from '../../engines/core/storage';
import { recordWin } from '../../engines/core/progress';
import { randomSeed } from '../../engines/core/rng';
import { Synth } from '../../engines/arcade/audio';
import { cardLabel, type Card } from '../../engines/solitaire/cards';
import { SPADES, trickWinner } from '../../engines/cards/tricks';
import { Spades2, card2, chooseBid2, chooseKeep, choosePlay2, type Spades2State } from '../../engines/cards/spades2';
import { TrickTable } from './TrickTable';
import { PlayingCard } from './PlayingCard';

const NAMES = ['You', 'Computer'];
/** Engine seats 0 and 1 sit South and North on the shared table. */
const TABLE_SEAT = [0, 2];
const SAVE = 'spades2:game';
const TARGETS = [300, 500];

export default function Spades2Game() {
  const game = useRef(new Spades2('preview'));
  const synth = useRef(new Synth());
  const [, setTick] = useState(0);
  const [showing, setShowing] = useState(false);
  const [message, setMessage] = useState('');
  const [announce, setAnnounce] = useState('');
  const [target, setTarget] = useState(300);
  const timer = useRef(0);
  const refresh = () => setTick((n) => n + 1);

  const save = () => {
    const s = game.current.s;
    if (s.phase === 'game-over') removeKey(SAVE);
    else writeJson(SAVE, s);
  };

  const step = () => {
    const g = game.current;
    const s = g.s;
    window.clearTimeout(timer.current);
    save();
    if (s.phase === 'draw') {
      if (s.turn === 0) {
        setMessage(`Your draw (${s.hands[0].length}/13): keep this card, or pass it and take the next one.`);
        refresh();
        return;
      }
      setMessage('The computer is drawing…');
      refresh();
      timer.current = window.setTimeout(() => {
        g.take(1, chooseKeep(g.hand(1), g.top!));
        step();
      }, 260);
      return;
    }
    if (s.phase === 'bid') {
      if (s.turn === 0) {
        setMessage('Your bid: how many of the 13 tricks will you take?');
        refresh();
        return;
      }
      timer.current = window.setTimeout(() => {
        const b = chooseBid2(g.hand(1));
        g.bid(1, b);
        setAnnounce(`The computer bids ${b === 0 ? 'Nil' : b}.`);
        step();
      }, 420);
      return;
    }
    if (s.phase !== 'play') {
      if (s.phase === 'game-over') {
        writeJson('spades2:games', readJson<number>('spades2:games', 0) + 1);
        if (s.winner === 0) {
          recordWin('two-player-spades');
          writeJson('spades2:wins', readJson<number>('spades2:wins', 0) + 1);
        }
      }
      refresh();
      return;
    }
    if (s.turn === 0) {
      setMessage(s.trick.length ? 'Your turn: follow suit if you can.' : 'Your lead.');
      refresh();
      return;
    }
    timer.current = window.setTimeout(() => play(1, choosePlay2(g, 1)), 520);
  };

  const play = (seat: number, c: Card) => {
    const g = game.current;
    const before = g.s.trick.length;
    if (!g.play(seat, c)) return;
    synth.current.tone(c.suit === SPADES ? 330 : 440 + seat * 60, 50, 'triangle', 0.06);
    setAnnounce(`${NAMES[seat]} played ${cardLabel(c)}.`);
    if (before === 1) {
      const w = trickWinner(
        g.s.lastTrick.map((t) => ({ seat: t.seat, card: card2(t.id) })),
        SPADES,
      );
      setMessage(`${NAMES[w]} ${w === 0 ? 'take' : 'takes'} the trick.`);
      setShowing(true);
      refresh();
      timer.current = window.setTimeout(() => {
        setShowing(false);
        step();
      }, 900);
      return;
    }
    refresh();
    step();
  };

  const start = (t = target) => {
    window.clearTimeout(timer.current);
    game.current = new Spades2(randomSeed(), t);
    setTarget(t);
    writeJson('spades2:target', t);
    setShowing(false);
    step();
  };

  const draw = (keep: boolean) => {
    const g = game.current;
    const top = g.top;
    const discarded = g.take(0, keep);
    if (!top || !discarded) return;
    const msg = keep ? `You kept the ${cardLabel(top)}; the ${cardLabel(discarded)} was discarded.` : `You passed the ${cardLabel(top)} and took the ${cardLabel(card2(g.s.hands[0][g.s.hands[0].length - 1]!))}.`;
    setAnnounce(msg);
    step();
  };

  const bid = (n: number) => {
    const g = game.current;
    if (!g.bid(0, n)) return;
    setAnnounce(`You bid ${n === 0 ? 'Nil' : n}.`);
    step();
  };

  useEffect(() => {
    const saved = readJson<Spades2State | null>(SAVE, null);
    const t = readJson<number>('spades2:target', 300);
    if (saved && Array.isArray(saved.hands) && saved.phase !== 'game-over' && typeof saved.seed === 'string') {
      game.current = new Spades2(saved);
      setTarget(saved.target);
      setAnnounce('Welcome back: your game was restored.');
      step();
    } else start(TARGETS.includes(t) ? t : 300);
    return () => window.clearTimeout(timer.current);
  }, []);

  const g = game.current;
  const s = g.s;
  const hand = g.hand(0);
  const playable = new Set(s.phase === 'play' && s.turn === 0 && !showing ? g.legal(0).map((c) => c.id) : []);
  const trickIds = showing ? s.lastTrick : s.trick;
  const trick = trickIds.map((t) => ({ seat: TABLE_SEAT[t.seat]!, card: card2(t.id) }));
  const winnerSeat = showing ? TABLE_SEAT[trickWinner(s.lastTrick.map((t) => ({ seat: t.seat, card: card2(t.id) })), SPADES)]! : null;
  const info = [0, 1].map((seat) => (s.bids[seat] === null ? (s.phase === 'draw' ? `${s.hands[seat]!.length}/13 drawn` : s.phase === 'bid' ? 'bidding…' : '') : `Bid ${s.bids[seat] === 0 ? 'Nil' : s.bids[seat]} · Won ${s.tricks[seat]}`));
  const suggestion = s.phase === 'bid' ? chooseBid2(hand) : 0;
  const top = s.phase === 'draw' && s.turn === 0 ? g.top : null;

  return (
    <section class="game" aria-label="2-player Spades">
      <div class="toolbar" role="toolbar" aria-label="Game controls">
        <button type="button" class="btn btn-primary" onClick={() => start()}>
          New game
        </button>
        <div class="segmented" role="radiogroup" aria-label="Points to win">
          {TARGETS.map((t) => (
            <button key={t} type="button" role="radio" class="seg" aria-checked={t === target} onClick={() => start(t)}>
              To {t}
            </button>
          ))}
        </div>
        <dl class="stats">
          <div>
            <dt>You</dt>
            <dd class="tabular-nums">{s.scores[0]}</dd>
          </div>
          <div>
            <dt>Computer</dt>
            <dd class="tabular-nums">{s.scores[1]}</dd>
          </div>
          <div>
            <dt>Bags</dt>
            <dd class="tabular-nums">
              {s.bags[0]}/{s.bags[1]}
            </dd>
          </div>
          <div>
            <dt>Spades</dt>
            <dd>{s.spadesBroken ? 'Broken' : 'Not yet'}</dd>
          </div>
        </dl>
      </div>
      <div class="board-area tt-area">
        <TrickTable
          names={['You', '', 'Computer', '']}
          info={[info[0]!, '', info[1]!, '']}
          counts={[s.hands[0].length, 0, s.hands[1].length, 0]}
          seats={[2]}
          turn={s.phase === 'round-over' || s.phase === 'game-over' || showing ? -1 : TABLE_SEAT[s.turn]!}
          trick={trick}
          winner={winnerSeat}
          hand={hand}
          playable={playable}
          onCard={(c) => s.turn === 0 && !showing && play(0, c)}
          message={s.phase === 'bid' && s.turn !== 0 ? 'The computer is bidding…' : message}
        >
          {top && (
            <div class="sp2-draw" role="group" aria-label="Your draw">
              <span class="sp2-top">
                <PlayingCard card={top} />
              </span>
              <div class="sp2-actions">
                <button type="button" class="btn btn-primary" onClick={() => draw(true)}>
                  Keep {cardLabel(top)}
                </button>
                <button type="button" class="btn" onClick={() => draw(false)}>
                  Pass, take the next card
                </button>
                <p class="tt-hint">{26 - s.stock.length / 2} of 26 draws done. Discarded cards are out of play for this hand.</p>
              </div>
            </div>
          )}
          {s.phase === 'bid' && s.turn === 0 && (
            <div class="tt-bids" role="group" aria-label="Your bid">
              {Array.from({ length: 14 }, (_, n) => (
                <button key={n} type="button" class={`seg${n === suggestion ? ' is-suggest' : ''}`} onClick={() => bid(n)} aria-label={n === 0 ? 'Bid Nil' : `Bid ${n}`}>
                  {n === 0 ? 'Nil' : n}
                </button>
              ))}
              <p class="tt-hint">Suggested: {suggestion === 0 ? 'Nil' : suggestion}.{s.bids[1] !== null ? ` The computer bid ${s.bids[1] === 0 ? 'Nil' : s.bids[1]}.` : ''}</p>
            </div>
          )}
        </TrickTable>
        {(s.phase === 'round-over' || s.phase === 'game-over') && !showing && (
          <div class="overlay overlay-soft" role="dialog" aria-labelledby="sp2-end">
            <div class="panel">
              <h2 id="sp2-end">{s.phase === 'game-over' ? (s.winner === 0 ? 'You win!' : 'The computer wins') : `Round ${s.round} over`}</h2>
              <table class="tt-scores">
                <thead>
                  <tr>
                    <th scope="col">Player</th>
                    <th scope="col">Bid</th>
                    <th scope="col">Won</th>
                    <th scope="col">Points</th>
                    <th scope="col">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {s.lastRound.map((r) => (
                    <tr key={r.seat}>
                      <th scope="row">{NAMES[r.seat]}</th>
                      <td>{r.bid === 0 ? 'Nil' : r.bid}</td>
                      <td>{r.tricks}</td>
                      <td>{r.points > 0 ? `+${r.points}` : r.points}</td>
                      <td>{s.scores[r.seat]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p class="text-sm mt-1">{s.lastRound.filter((r) => r.bagPenalty).map((r) => `${NAMES[r.seat]}: 10 bags, −100`).join(' · ')}</p>
              <div class="panel-actions">
                {s.phase === 'round-over' ? (
                  <button
                    type="button"
                    class="btn btn-primary"
                    onClick={() => {
                      g.newRound();
                      step();
                    }}
                  >
                    Next round
                  </button>
                ) : (
                  <button type="button" class="btn btn-primary" onClick={() => start()}>
                    New game
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
      <noscript dangerouslySetInnerHTML={{ __html: '<p class="noscript">2-player Spades needs JavaScript to run. Please enable it to play.</p>' }} />
    </section>
  );
}
