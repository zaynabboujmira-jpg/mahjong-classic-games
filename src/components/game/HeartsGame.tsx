import { useEffect, useRef, useState } from 'preact/hooks';
import { readJson, writeJson } from '../../engines/core/storage';
import { recordWin } from '../../engines/core/progress';
import { randomSeed } from '../../engines/core/rng';
import { Synth } from '../../engines/arcade/audio';
import { cardLabel, type Card } from '../../engines/solitaire/cards';
import { SEATS, trickWinner } from '../../engines/cards/tricks';
import { Hearts, chooseCard, choosePass } from '../../engines/cards/hearts';
import { TrickTable } from './TrickTable';

const PASS_TEXT = { left: 'to West (left)', right: 'to East (right)', across: 'to North (across)', none: '' };

export default function HeartsGame() {
  const game = useRef(new Hearts('preview'));
  const synth = useRef(new Synth());
  const [, setTick] = useState(0);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  /** A finished trick stays on the table for a moment. */
  const [showing, setShowing] = useState(false);
  const [message, setMessage] = useState('');
  const [announce, setAnnounce] = useState('');
  const timer = useRef(0);
  const refresh = () => setTick((n) => n + 1);

  const step = () => {
    const g = game.current;
    window.clearTimeout(timer.current);
    if (g.phase !== 'play') {
      if (g.phase === 'game-over') {
        const won = g.winners().includes(0);
        if (won) recordWin('hearts');
        writeJson('hearts:games', readJson<number>('hearts:games', 0) + 1);
        if (won) writeJson('hearts:wins', readJson<number>('hearts:wins', 0) + 1);
      }
      refresh();
      return;
    }
    if (g.turn === 0) {
      setMessage(g.trick.length ? 'Your turn: follow suit if you can.' : g.tricksPlayed === 0 ? 'Lead the 2♣.' : 'Your lead.');
      refresh();
      return;
    }
    timer.current = window.setTimeout(() => {
      play(g.turn, chooseCard(g));
    }, 480);
  };

  const play = (seat: number, card: Card) => {
    const g = game.current;
    const before = g.trick.length;
    g.play(seat, card);
    synth.current.tone(440 + seat * 40, 50, 'triangle', 0.06);
    setAnnounce(`${SEATS[seat]} played ${cardLabel(card)}.`);
    if (before === 3) {
      const w = trickWinner(g.lastTrick);
      const pts = g.lastTrick.reduce((n, p) => n + (p.card.suit === 1 ? 1 : p.card.suit === 0 && p.card.rank === 12 ? 13 : 0), 0);
      setMessage(`${SEATS[w]} ${w === 0 ? 'take' : 'takes'} the trick${pts ? ` (${pts} ${pts === 1 ? 'point' : 'points'})` : ''}.`);
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
    game.current = new Hearts(randomSeed());
    setPicked(new Set());
    setShowing(false);
    beginRound();
  };

  const beginRound = () => {
    const g = game.current;
    setPicked(new Set());
    if (g.phase === 'pass') setMessage(`Choose 3 cards to pass ${PASS_TEXT[g.passDir]}.`);
    else setMessage('No passing this hand.');
    refresh();
    step();
  };

  const pass = () => {
    const g = game.current;
    const mine = g.hands[0]!.filter((c) => picked.has(c.id));
    const passes = g.hands.map((h, s) => (s === 0 ? mine : choosePass(h)));
    g.pass(passes);
    setPicked(new Set());
    setAnnounce(`You passed ${mine.map(cardLabel).join(', ')}.`);
    step();
  };

  const onCard = (c: Card) => {
    const g = game.current;
    if (g.phase === 'pass') {
      setPicked((prev) => {
        const next = new Set(prev);
        if (next.has(c.id)) next.delete(c.id);
        else if (next.size < 3) next.add(c.id);
        return next;
      });
      return;
    }
    if (g.turn === 0 && !showing) play(0, c);
  };

  useEffect(() => {
    start();
    return () => window.clearTimeout(timer.current);
  }, []);

  const g = game.current;
  const playable = new Set(g.phase === 'pass' ? g.hands[0]!.map((c) => c.id) : g.turn === 0 && !showing ? g.legal(0).map((c) => c.id) : []);
  const trick = showing ? g.lastTrick : g.trick;
  return (
    <section class="game" aria-label="Hearts">
      <div class="toolbar" role="toolbar" aria-label="Game controls">
        <button type="button" class="btn btn-primary" onClick={start}>
          New game
        </button>
        <dl class="stats">
          <div>
            <dt>Hand</dt>
            <dd class="tabular-nums">{g.round}</dd>
          </div>
          <div>
            <dt>Hearts</dt>
            <dd>{g.heartsBroken ? 'Broken' : 'Not yet'}</dd>
          </div>
          <div>
            <dt>Pass</dt>
            <dd>{g.passDir === 'none' ? 'Hold' : g.passDir[0]!.toUpperCase() + g.passDir.slice(1)}</dd>
          </div>
        </dl>
      </div>
      <div class="board-area tt-area">
        <TrickTable
          names={SEATS}
          info={g.scores.map((s, i) => `${s} pts${g.phase === 'play' && g.taken[i] ? ` (+${g.taken[i]})` : ''}`)}
          counts={g.hands.map((h) => h.length)}
          turn={g.phase === 'play' && !showing ? g.turn : -1}
          trick={trick}
          winner={showing ? trickWinner(g.lastTrick) : null}
          hand={g.hands[0]!}
          playable={playable}
          selected={picked}
          onCard={onCard}
          message={message}
        >
          {g.phase === 'pass' && (
            <div class="tt-actions">
              <button type="button" class="btn btn-primary" disabled={picked.size !== 3} onClick={pass}>
                Pass {picked.size}/3 {PASS_TEXT[g.passDir]}
              </button>
            </div>
          )}
        </TrickTable>
        {(g.phase === 'round-over' || g.phase === 'game-over') && !showing && (
          <div class="overlay overlay-soft" role="dialog" aria-labelledby="hearts-end">
            <div class="panel">
              <h2 id="hearts-end">
                {g.phase === 'game-over' ? (g.winners().includes(0) ? 'You win!' : `${g.winners().map((w) => SEATS[w]).join(' and ')} ${g.winners().length > 1 ? 'win' : 'wins'}`) : `Hand ${g.round} over`}
              </h2>
              {g.moon !== null && <p class="font-semibold">{g.moon === 0 ? 'You shot the moon! Everyone else takes 26.' : `${SEATS[g.moon]} shot the moon!`}</p>}
              <table class="tt-scores">
                <tbody>
                  {SEATS.map((name, i) => (
                    <tr key={name}>
                      <th scope="row">{name}</th>
                      <td>+{g.moon === null ? g.taken[i] : g.moon === i ? 0 : 26}</td>
                      <td>{g.scores[i]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div class="panel-actions">
                {g.phase === 'round-over' ? (
                  <button
                    type="button"
                    class="btn btn-primary"
                    onClick={() => {
                      g.newRound();
                      beginRound();
                    }}
                  >
                    Next hand
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
      <noscript dangerouslySetInnerHTML={{ __html: '<p class="noscript">Hearts needs JavaScript to run. Please enable it to play.</p>' }} />
    </section>
  );
}
