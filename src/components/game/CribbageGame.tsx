import { useEffect, useRef, useState } from 'preact/hooks';
import { readJson, writeJson, removeKey } from '../../engines/core/storage';
import { recordWin } from '../../engines/core/progress';
import { randomSeed } from '../../engines/core/rng';
import { cardLabel } from '../../engines/solitaire/cards';
import { Cribbage, NAMES, TARGET, card, chooseDiscard, choosePeg, short, total, type CribbageState, type ScoreItem } from '../../engines/cards/cribbage';
import { PlayingCard } from './PlayingCard';

const SAVE = 'cribbage:game';
const KIND: Record<ScoreItem['kind'], string> = { fifteen: 'Fifteen', pair: 'Pair', run: 'Run', flush: 'Flush', nobs: 'Nobs' };

/** Hole positions on the pegging board: two lanes of 60 per player, out and back. */
const hx = (n: number) => 30 + (n - 1) * 9.6 + Math.floor((n - 1) / 5) * 3.4;
function holeXY(seat: number, n: number): [number, number] {
  const top = seat === 1 ? 14 : 52;
  if (n <= 0) return [14, top];
  if (n >= TARGET) return [14, top + 14];
  return n <= 60 ? [hx(n), top] : [hx(121 - n), top + 14];
}

function Board({ scores, prev }: { scores: readonly number[]; prev: readonly number[] }) {
  const holes: string[] = [];
  for (const seat of [1, 0]) for (let n = 1; n <= 120; n++) holes.push(holeXY(seat, n).join(','));
  return (
    <svg class="cb-board" viewBox="0 0 650 80" role="img" aria-label={`Cribbage board: you ${scores[0]}, computer ${scores[1]} of ${TARGET}`}>
      <rect x="1" y="1" width="648" height="78" rx="10" class="cb-wood" />
      <line x1="24" y1="40" x2="640" y2="40" class="cb-split" />
      {holes.map((h) => {
        const [x, y] = h.split(',');
        return <circle key={h} cx={x} cy={y} r="1.7" class="cb-hole" />;
      })}
      {[0, 1].map((seat) => {
        const pegs = [prev[seat]!, scores[seat]!].map((n) => holeXY(seat, n));
        return pegs.map(([x, y], k) => <circle key={`${seat}${k}`} cx={x} cy={y} r={k ? 4.2 : 3.4} class={`cb-peg cb-peg${seat}${k ? '' : ' is-back'}`} />);
      })}
      <text x="640" y="25" class="cb-label" text-anchor="end">
        Computer {scores[1]}
      </text>
      <text x="640" y="77" class="cb-label" text-anchor="end">
        You {scores[0]}
      </text>
    </svg>
  );
}

function restore(): Cribbage | null {
  const s = readJson<CribbageState | null>(SAVE, null);
  if (!s || s.phase === 'game-over' || !Array.isArray(s.hands) || !Array.isArray(s.pegHands) || typeof s.seed !== 'string') return null;
  return new Cribbage(s.seed, s);
}

function itemText(i: ScoreItem) {
  const cards = i.cards.map((id) => short(card(id))).join(' ');
  const label = i.kind === 'run' ? `Run of ${i.cards.length}` : i.kind === 'flush' ? `Flush of ${i.cards.length}` : KIND[i.kind];
  return { label, cards, points: i.points };
}

export default function CribbageGame() {
  const game = useRef(new Cribbage('preview'));
  const [, setTick] = useState(0);
  const [sel, setSel] = useState<number[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [hint, setHint] = useState<number[]>([]);
  const timer = useRef(0);

  const commit = () => {
    const g = game.current;
    const lines = g.s.events.map((e) => (e.text === 'go' ? `${NAMES[e.seat]} ${e.seat ? 'says' : 'say'} go` : `${NAMES[e.seat]}: ${e.text}`));
    if (lines.length) setLog((l) => [...lines.reverse(), ...l].slice(0, 4));
    if (g.s.phase === 'game-over') {
      removeKey(SAVE);
      writeJson('cribbage:games', readJson<number>('cribbage:games', 0) + 1);
      if (g.s.winner === 0) {
        recordWin('cribbage');
        writeJson('cribbage:wins', readJson<number>('cribbage:wins', 0) + 1);
      }
    } else writeJson(SAVE, g.s);
    setTick((n) => n + 1);
  };

  const start = () => {
    window.clearTimeout(timer.current);
    game.current = new Cribbage(randomSeed());
    setSel([]);
    setHint([]);
    setLog([`${game.current.s.dealer === 0 ? 'You deal' : 'The computer deals'} first.`]);
    commit();
  };

  useEffect(() => {
    const saved = restore();
    if (saved) {
      game.current = saved;
      setLog(['Welcome back: your game is where you left it.']);
      setTick((n) => n + 1);
    } else start();
    return () => window.clearTimeout(timer.current);
  }, []);

  const g = game.current;
  const s = g.s;

  // The computer plays its pegging cards after a short pause.
  useEffect(() => {
    if (s.phase !== 'peg' || s.turn !== 1) return;
    timer.current = window.setTimeout(() => {
      g.play(1, choosePeg(g, 1));
      commit();
    }, 750);
    return () => window.clearTimeout(timer.current);
  });

  const toggle = (id: number) => {
    if (s.phase === 'discard') {
      setHint([]);
      setSel((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < 2 ? [...cur, id] : [cur[1]!, id]));
    } else if (s.phase === 'peg' && s.turn === 0 && g.play(0, id)) commit();
  };

  const discard = () => {
    if (!g.discard(sel)) return;
    setSel([]);
    setHint([]);
    setLog([]);
    commit();
  };

  const showHint = () => {
    const pick = chooseDiscard(s.hands[0].map(card), s.dealer === 0).map((c) => c.id);
    setHint(pick);
    setSel(pick);
  };

  const yourCrib = s.dealer === 0;
  const legal = new Set(g.legal(0));
  const hand = s.phase === 'discard' ? s.hands[0] : s.phase === 'peg' ? s.pegHands[0] : s.hands[0];
  const show = s.phase === 'show' ? g.showing() : null;
  const showPts = show ? total(show.items) : 0;
  const cpuFaceUp = s.phase === 'show' || s.phase === 'game-over';
  const cpuCards = cpuFaceUp ? s.hands[1] : s.phase === 'discard' ? s.hands[1] : s.pegHands[1];

  let message = '';
  if (s.phase === 'discard') message = `Choose 2 cards for ${yourCrib ? 'your' : "the computer's"} crib.`;
  else if (s.phase === 'peg') message = s.turn === 0 ? `Count ${s.count}. Your turn: play a card.` : `Count ${s.count}. The computer is playing…`;
  else if (show) message = `${show.crib ? (show.seat === 0 ? 'Your crib' : "The computer's crib") : show.seat === 0 ? 'Your hand' : "The computer's hand"}: ${showPts} point${showPts === 1 ? '' : 's'}.`;
  const nextLabel = s.showStep === 0 ? (g.pone === 0 ? "Count the computer's hand" : 'Count your hand') : s.showStep === 1 ? 'Count the crib' : 'Deal the next hand';

  return (
    <section class="game" aria-label="Cribbage">
      <div class="toolbar" role="toolbar" aria-label="Game controls">
        <button type="button" class="btn btn-primary" onClick={start}>
          New game
        </button>
        {s.phase === 'discard' && (
          <button type="button" class="btn" onClick={showHint}>
            Hint
          </button>
        )}
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
            <dt>Crib</dt>
            <dd>{yourCrib ? 'Yours' : 'Computer'}</dd>
          </div>
        </dl>
      </div>
      <div class="board-area tt-area">
        <div class="cb">
          <Board scores={s.scores} prev={s.prev} />
          <div class="cb-opp" aria-label={`Computer: ${cpuCards.length} cards`}>
            <span class="tt-name">Computer{s.dealer === 1 ? ' (dealer)' : ''}</span>
            <span class="cb-cards">
              {cpuCards.map((id) => (
                <span key={id} class="cb-mini">
                  <PlayingCard card={card(id)} down={!cpuFaceUp} />
                </span>
              ))}
            </span>
          </div>
          <div class="cb-mid">
            <div class="cb-pile">
              <span class="cb-cap">Starter</span>
              <PlayingCard card={g.starter} down={!g.starter} />
            </div>
            <div class="cb-pile">
              <span class="cb-cap">Crib</span>
              {s.crib.length ? <PlayingCard card={null} down /> : <span class="pc-slot" aria-hidden="true" />}
              <span class="cb-cap">{s.crib.length}/4</span>
            </div>
            <div class="cb-play" aria-label={show ? 'Cards being counted' : `Pegging: count ${s.count}`}>
              {show ? (
                <div class="cb-show">
                  <span class="cb-row">
                    {show.cards.map((c) => (
                      <PlayingCard key={c.id} card={c} />
                    ))}
                  </span>
                  <ul class="cb-items">
                    {show.items.map((i, k) => {
                      const t = itemText(i);
                      return (
                        <li key={k}>
                          <span>{t.label}</span> <span class="cb-ic">{t.cards}</span> <b>{t.points}</b>
                        </li>
                      );
                    })}
                    {!show.items.length && <li>No points (a “19” hand)</li>}
                    <li class="cb-total">
                      <span>Total</span> <b>{showPts}</b>
                    </li>
                  </ul>
                </div>
              ) : (
                <>
                  <span class="cb-row cb-seq">
                    {s.seq.map((id) => (
                      <span key={id} class={`cb-laid${s.played.find((p) => p.id === id)?.seat === 1 ? ' is-cpu' : ''}`}>
                        <PlayingCard card={card(id)} />
                      </span>
                    ))}
                  </span>
                  {s.phase === 'peg' && <span class="cb-count">Count {s.count}</span>}
                </>
              )}
            </div>
          </div>
          <p class="arcade-message tt-msg cb-msg" aria-hidden="true">
            {message}
          </p>
          {log.length > 0 && (
            <ul class="cb-log" aria-hidden="true">
              {log.slice(0, 3).map((l, k) => (
                <li key={`${k}${l}`}>{l}</li>
              ))}
            </ul>
          )}
          <div class="tt-actions cb-actions">
            {s.phase === 'discard' && (
              <button type="button" class="btn btn-primary" disabled={sel.length !== 2} onClick={discard}>
                {sel.length === 2 ? 'Send to crib' : `Pick ${2 - sel.length} more`}
              </button>
            )}
            {s.phase === 'show' && (
              <button
                type="button"
                class="btn btn-primary"
                onClick={() => {
                  g.next();
                  if (g.s.phase === 'discard') setLog([`${g.s.dealer === 0 ? 'Your' : "The computer's"} deal.`]);
                  commit();
                }}
              >
                {nextLabel}
              </button>
            )}
          </div>
          <div class={`tt-hand cb-hand${s.phase === 'show' || s.phase === 'game-over' ? ' is-idle' : ''}`} role="group" aria-label="Your cards" style={{ '--n': hand.length }}>
            {hand.map((id) => {
              const c = card(id);
              const ok = s.phase === 'discard' || (s.phase === 'peg' && legal.has(id));
              const on = sel.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  class={`tt-card${ok ? ' is-playable' : ''}${on ? ' is-sel' : ''}${hint.includes(id) ? ' is-hint' : ''}`}
                  aria-label={`${cardLabel(c)}${on ? ', selected for the crib' : ''}${ok ? '' : ', cannot play now'}`}
                  aria-pressed={s.phase === 'discard' ? on : undefined}
                  aria-disabled={!ok}
                  onClick={() => ok && toggle(id)}
                >
                  <PlayingCard card={c} />
                </button>
              );
            })}
          </div>
        </div>
        {s.phase === 'game-over' && (
          <div class="overlay overlay-soft" role="dialog" aria-labelledby="crib-end">
            <div class="panel">
              <h2 id="crib-end">{s.winner === 0 ? 'You win!' : 'The computer wins'}</h2>
              <p>
                Final score: you {s.scores[0]}, computer {s.scores[1]}.
                {g.skunk() === 2 ? ' A double skunk!' : g.skunk() === 1 ? ' A skunk: the loser finished below 91.' : ''}
              </p>
              <div class="panel-actions">
                <button type="button" class="btn btn-primary" onClick={start}>
                  New game
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <p class="sr-only" aria-live="polite">
        {message} {log[0] ?? ''}
      </p>
      <noscript dangerouslySetInnerHTML={{ __html: '<p class="noscript">Cribbage needs JavaScript to run. Please enable it to play.</p>' }} />
    </section>
  );
}
