import { useEffect, useRef, useState } from 'preact/hooks';
import { readJson, writeJson } from '../../engines/core/storage';
import { recordWin } from '../../engines/core/progress';
import { randomSeed } from '../../engines/core/rng';
import { Synth } from '../../engines/arcade/audio';
import { cardLabel, type Card } from '../../engines/solitaire/cards';
import { SPADES, trickWinner } from '../../engines/cards/tricks';
import { Spades, chooseBid, chooseSpadesCard } from '../../engines/cards/spades';
import { TrickTable } from './TrickTable';

const NAMES = ['You', 'West', 'Partner', 'East'];
const TEAM = ['You & Partner', 'West & East'];

export default function SpadesGame() {
  const game = useRef(new Spades('preview'));
  const synth = useRef(new Synth());
  const [, setTick] = useState(0);
  const [showing, setShowing] = useState(false);
  const [message, setMessage] = useState('');
  const [announce, setAnnounce] = useState('');
  const timer = useRef(0);
  const refresh = () => setTick((n) => n + 1);

  const step = () => {
    const g = game.current;
    window.clearTimeout(timer.current);
    if (g.phase === 'bid') {
      if (g.turn === 0) {
        setMessage('Your bid: how many tricks will you take?');
        refresh();
        return;
      }
      timer.current = window.setTimeout(() => {
        const seat = g.turn;
        const b = chooseBid(g.hands[seat]!, g.bids[(seat + 2) % 4] ?? null);
        g.bid(seat, b);
        setAnnounce(`${NAMES[seat]} bids ${b === 0 ? 'Nil' : b}.`);
        refresh();
        step();
      }, 420);
      return;
    }
    if (g.phase !== 'play') {
      if (g.phase === 'game-over' && g.winner() === 0) {
        recordWin('spades');
        writeJson('spades:wins', readJson<number>('spades:wins', 0) + 1);
      }
      if (g.phase === 'game-over') writeJson('spades:games', readJson<number>('spades:games', 0) + 1);
      refresh();
      return;
    }
    if (g.turn === 0) {
      setMessage(g.trick.length ? 'Your turn: follow suit if you can.' : 'Your lead.');
      refresh();
      return;
    }
    timer.current = window.setTimeout(() => play(g.turn, chooseSpadesCard(g)), 480);
  };

  const play = (seat: number, card: Card) => {
    const g = game.current;
    const before = g.trick.length;
    g.play(seat, card);
    synth.current.tone(card.suit === SPADES ? 330 : 440 + seat * 40, 50, 'triangle', 0.06);
    setAnnounce(`${NAMES[seat]} played ${cardLabel(card)}.`);
    if (before === 3) {
      const w = trickWinner(g.lastTrick, SPADES);
      setMessage(`${NAMES[w]} ${w === 0 ? 'take' : 'takes'} the trick.`);
      setShowing(true);
      refresh();
      timer.current = window.setTimeout(() => {
        setShowing(false);
        step();
      }, 1000);
      return;
    }
    refresh();
    step();
  };

  const start = () => {
    window.clearTimeout(timer.current);
    game.current = new Spades(randomSeed());
    setShowing(false);
    refresh();
    step();
  };

  const bid = (n: number) => {
    const g = game.current;
    if (g.phase !== 'bid' || g.turn !== 0) return;
    g.bid(0, n);
    setAnnounce(`You bid ${n === 0 ? 'Nil' : n}.`);
    step();
  };

  useEffect(() => {
    start();
    return () => window.clearTimeout(timer.current);
  }, []);

  const g = game.current;
  const playable = new Set(g.phase === 'play' && g.turn === 0 && !showing ? g.legal(0).map((c) => c.id) : []);
  const trick = showing ? g.lastTrick : g.trick;
  const info = [0, 1, 2, 3].map((s) => (g.bids[s] === null ? (g.phase === 'bid' ? 'bidding…' : '') : `Bid ${g.bids[s] === 0 ? 'Nil' : g.bids[s]} · Won ${g.tricks[s]}`));
  const suggestion = g.phase === 'bid' ? chooseBid(g.hands[0]!, g.bids[2] ?? null) : 0;

  return (
    <section class="game" aria-label="Spades">
      <div class="toolbar" role="toolbar" aria-label="Game controls">
        <button type="button" class="btn btn-primary" onClick={start}>
          New game
        </button>
        <dl class="stats">
          <div>
            <dt>Us</dt>
            <dd class="tabular-nums">{g.scores[0]}</dd>
          </div>
          <div>
            <dt>Them</dt>
            <dd class="tabular-nums">{g.scores[1]}</dd>
          </div>
          <div>
            <dt>Bags</dt>
            <dd class="tabular-nums">
              {g.bags[0]}/{g.bags[1]}
            </dd>
          </div>
          <div>
            <dt>Spades</dt>
            <dd>{g.spadesBroken ? 'Broken' : 'Not yet'}</dd>
          </div>
        </dl>
      </div>
      <div class="board-area tt-area">
        <TrickTable
          names={NAMES}
          info={info}
          counts={g.hands.map((h) => h.length)}
          turn={g.phase !== 'round-over' && g.phase !== 'game-over' && !showing ? g.turn : -1}
          trick={trick}
          winner={showing ? trickWinner(g.lastTrick, SPADES) : null}
          hand={g.hands[0]!}
          playable={playable}
          onCard={(c) => g.turn === 0 && !showing && play(0, c)}
          message={g.phase === 'bid' && g.turn !== 0 ? `${NAMES[g.turn]} is bidding…` : message}
        >
          {g.phase === 'bid' && g.turn === 0 && (
            <div class="tt-bids" role="group" aria-label="Your bid">
              {Array.from({ length: 14 }, (_, n) => (
                <button key={n} type="button" class={`seg${n === suggestion ? ' is-suggest' : ''}`} onClick={() => bid(n)} aria-label={n === 0 ? 'Bid Nil' : `Bid ${n}`}>
                  {n === 0 ? 'Nil' : n}
                </button>
              ))}
              <p class="tt-hint">Suggested: {suggestion === 0 ? 'Nil' : suggestion}. Team bid so far: {g.teamBid(0)}.</p>
            </div>
          )}
        </TrickTable>
        {(g.phase === 'round-over' || g.phase === 'game-over') && !showing && (
          <div class="overlay overlay-soft" role="dialog" aria-labelledby="spades-end">
            <div class="panel">
              <h2 id="spades-end">{g.phase === 'game-over' ? (g.winner() === 0 ? 'You and your partner win!' : 'West and East win') : `Round ${g.round} over`}</h2>
              <table class="tt-scores">
                <thead>
                  <tr>
                    <th scope="col">Team</th>
                    <th scope="col">Bid</th>
                    <th scope="col">Won</th>
                    <th scope="col">Points</th>
                    <th scope="col">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {g.lastRound.map((r) => (
                    <tr key={r.team}>
                      <th scope="row">{TEAM[r.team]}</th>
                      <td>{r.bid}</td>
                      <td>{r.tricks}</td>
                      <td>{r.points > 0 ? `+${r.points}` : r.points}</td>
                      <td>{g.scores[r.team]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p class="text-sm mt-1">
                {g.lastRound
                  .flatMap((r) => [...r.nil.map((n) => `${NAMES[n.seat]}'s Nil ${n.made ? 'made (+100)' : 'failed (−100)'}`), ...(r.bagPenalty ? [`${TEAM[r.team]}: 10 bags, −100`] : [])])
                  .join(' · ')}
              </p>
              <div class="panel-actions">
                {g.phase === 'round-over' ? (
                  <button
                    type="button"
                    class="btn btn-primary"
                    onClick={() => {
                      g.newRound();
                      refresh();
                      step();
                    }}
                  >
                    Next round
                  </button>
                ) : (
                  <button type="button" class="btn btn-primary" onClick={start}>
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
      <noscript dangerouslySetInnerHTML={{ __html: '<p class="noscript">Spades needs JavaScript to run. Please enable it to play.</p>' }} />
    </section>
  );
}
