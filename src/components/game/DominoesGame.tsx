import { useEffect, useRef, useState } from 'preact/hooks';
import { readJson, writeJson } from '../../engines/core/storage';
import { recordWin } from '../../engines/core/progress';
import { Synth } from '../../engines/arcade/audio';
import { randomSeed } from '../../engines/core/rng';
import { Dominoes, chooseDominoPlay, isDouble, type DominoMode, type End, type Tile } from '../../engines/board/dominoes';

const NAMES = ['You', 'West', 'North', 'East'];
/** Pip positions in a 3 × 3 grid for 0-6. */
const PIP_CELLS: Record<number, number[]> = { 0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

function Half({ n }: { n: number }) {
  return (
    <span class="dm-half">
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} class={PIP_CELLS[n]!.includes(i) ? 'dm-pip' : ''} />
      ))}
    </span>
  );
}

function Domino({ a, b, vertical = false, extra = '' }: { a: number; b: number; vertical?: boolean; extra?: string }) {
  return (
    <span class={`dm-tile${vertical ? ' is-vertical' : ''}${extra}`} aria-hidden="true">
      <Half n={a} />
      <span class="dm-bar" />
      <Half n={b} />
    </span>
  );
}

export default function DominoesGame() {
  const game = useRef(new Dominoes(2, 'draw', 'preview'));
  const synth = useRef(new Synth());
  const [, setTick] = useState(0);
  const [mode, setMode] = useState<DominoMode>('draw');
  const [players, setPlayers] = useState(2);
  const [picked, setPicked] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [message, setMessage] = useState('');
  const timer = useRef(0);
  const refresh = () => setTick((n) => n + 1);

  const tileName = (t: Tile) => `${t[0]}-${t[1]}`;

  /** Runs computer turns one after another, with a short pause each. */
  const runAi = () => {
    const g = game.current;
    window.clearTimeout(timer.current);
    if (g.result || g.turn === 0) {
      setBusy(false);
      roundCheck();
      refresh();
      return;
    }
    setBusy(true);
    timer.current = window.setTimeout(() => {
      const p = g.turn;
      const play = chooseDominoPlay(g, p);
      if (play) {
        const t = g.hands[p]![play.tile]!;
        g.play(p, play.tile, play.end);
        synth.current.tone(420, 60, 'triangle', 0.08);
        setMessage(`${NAMES[p]} played ${tileName(t)}.`);
        setAnnounce(`${NAMES[p]} played ${tileName(t)}. Ends ${g.ends?.join(' and ') ?? ''}.`);
      } else if (g.mode === 'draw' && g.boneyard.length) {
        let drawn = 0;
        while (!g.canPlay(p) && g.draw(p)) drawn++;
        setMessage(`${NAMES[p]} drew ${drawn} ${drawn === 1 ? 'tile' : 'tiles'}.`);
      } else {
        g.pass(p);
        setMessage(`${NAMES[p]} passed.`);
        setAnnounce(`${NAMES[p]} passed.`);
      }
      refresh();
      runAi();
    }, 650);
  };

  const roundCheck = () => {
    const g = game.current;
    const r = g.result;
    if (!r) return;
    const who = r.winner === null ? 'Nobody' : NAMES[r.winner]!;
    const text = r.blocked ? `Blocked! ${r.winner === null ? 'A tie on pips: no points.' : `${who} has the fewest pips and scores ${r.points}.`}` : `${who} went out and scores ${r.points}.`;
    setMessage(text);
    setAnnounce(text);
    if (g.matchWinner === 0) {
      recordWin('dominoes');
      const w = readJson<number>('dominoes:matches', 0);
      writeJson('dominoes:matches', w + 1);
    }
  };

  const start = (m: DominoMode = mode, n = players) => {
    window.clearTimeout(timer.current);
    game.current = new Dominoes(n, m, randomSeed());
    setMode(m);
    setPlayers(n);
    setPicked(-1);
    writeJson('dominoes:settings', { mode: m, players: n });
    const g = game.current;
    setMessage(g.turn === 0 ? 'You lead: play your highest double.' : `${NAMES[g.turn]} leads.`);
    setAnnounce(`New match to ${g.target} points, ${m} game, ${n} players.`);
    refresh();
    runAi();
  };

  const place = (tile: number, end: End) => {
    const g = game.current;
    const t = g.hands[0]![tile]!;
    g.play(0, tile, end);
    setPicked(-1);
    synth.current.tone(520, 60, 'triangle', 0.09);
    setMessage(`You played ${tileName(t)}.`);
    refresh();
    runAi();
  };

  const pick = (i: number) => {
    const g = game.current;
    if (busy || g.result || g.turn !== 0) return;
    const ends = g.fits(0, i);
    if (!ends.length) {
      setMessage('That tile does not fit either end.');
      return;
    }
    const sameEnds = g.ends && g.ends[0] === g.ends[1];
    if (ends.length === 1 || sameEnds) place(i, ends[0]!);
    else {
      setPicked(i);
      setMessage('It fits both ends: tap ◀ or ▶ to choose.');
    }
  };

  const drawTile = () => {
    const g = game.current;
    const t = g.draw(0);
    if (t) {
      setMessage(g.canPlay(0) ? `You drew ${tileName(t)}. It plays!` : `You drew ${tileName(t)}.`);
      setAnnounce(`You drew ${tileName(t)}.`);
    }
    refresh();
  };

  const pass = () => {
    game.current.pass(0);
    setMessage('You passed.');
    refresh();
    runAi();
  };

  useEffect(() => {
    const s = readJson<{ mode: DominoMode; players: number }>('dominoes:settings', { mode: 'draw', players: 2 });
    start(s.mode === 'block' ? 'block' : 'draw', [2, 3, 4].includes(s.players) ? s.players : 2);
    return () => window.clearTimeout(timer.current);
  }, []);

  const g = game.current;
  const myTurn = g.turn === 0 && !g.result && !busy;
  const playable = new Set(myTurn ? g.legal(0).map((x) => x.tile) : []);
  const mustDraw = myTurn && !playable.size && g.mode === 'draw' && g.boneyard.length > 0;
  const mustPass = myTurn && !playable.size && !mustDraw;
  const pickedEnds = picked >= 0 ? g.fits(0, picked) : [];

  return (
    <section class="game" aria-label="Dominoes">
      <div class="toolbar" role="toolbar" aria-label="Game controls">
        <button type="button" class="btn btn-primary" onClick={() => start()}>
          New match
        </button>
        <div class="segmented" role="radiogroup" aria-label="Game type">
          {(['draw', 'block'] as const).map((m) => (
            <button key={m} type="button" role="radio" class="seg" aria-checked={mode === m} onClick={() => start(m, players)}>
              {m === 'draw' ? 'Draw' : 'Block'}
            </button>
          ))}
        </div>
        <div class="segmented" role="radiogroup" aria-label="Players">
          {[2, 3, 4].map((n) => (
            <button key={n} type="button" role="radio" class="seg" aria-checked={players === n} onClick={() => start(mode, n)}>
              {n}P
            </button>
          ))}
        </div>
        <dl class="stats">
          {g.scores.map((s, i) => (
            <div key={i}>
              <dt>{NAMES[i]}</dt>
              <dd class="tabular-nums">{s}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div class="arcade-area dm-area">
        <div class="dm-opponents" aria-label="Opponents">
          {g.hands.slice(1).map((h, i) => (
            <div key={i} class={`dm-opp${g.turn === i + 1 && !g.result ? ' is-turn' : ''}`}>
              <span class="dm-opp-name">{NAMES[i + 1]}</span>
              <span class="dm-backs" aria-label={`${h.length} tiles`}>
                {h.map((_, k) => (
                  <span key={k} class="dm-back" />
                ))}
              </span>
            </div>
          ))}
          {g.mode === 'draw' && <span class="dm-yard">Boneyard {g.boneyard.length}</span>}
        </div>
        <p class="arcade-message" aria-hidden="true">
          {message}
        </p>
        <div class="dm-line" aria-label={`Line of play: ${g.line.map((p) => `${p.a}-${p.b}`).join(', ') || 'empty'}`}>
          {pickedEnds.includes('left') && (
            <button type="button" class="dm-end" onClick={() => place(picked, 'left')} aria-label={`Play on the left end (${g.ends?.[0]})`}>
              ◀ {g.ends?.[0]}
            </button>
          )}
          {g.line.map((p, i) => (
            <Domino key={`${p.tile[0]}${p.tile[1]}`} a={p.a} b={p.b} vertical={isDouble(p.tile)} extra={i === 0 || i === g.line.length - 1 ? ' is-end' : ''} />
          ))}
          {pickedEnds.includes('right') && (
            <button type="button" class="dm-end" onClick={() => place(picked, 'right')} aria-label={`Play on the right end (${g.ends?.[1]})`}>
              {g.ends?.[1]} ▶
            </button>
          )}
        </div>
        <div class="dm-hand-wrap">
          <div class="dm-hand-head">
            <span>
              Your tiles · {g.handPips(0)} pips{myTurn ? ' · your turn' : ''}
            </span>
            {mustDraw && (
              <button type="button" class="btn btn-primary" onClick={drawTile}>
                Draw a tile
              </button>
            )}
            {mustPass && (
              <button type="button" class="btn btn-primary" onClick={pass}>
                Pass
              </button>
            )}
          </div>
          <div class="dm-hand" role="group" aria-label="Your tiles">
            {g.hands[0]!.map((t, i) => (
              <button
                key={`${t[0]}${t[1]}`}
                type="button"
                class={`dm-hand-btn${playable.has(i) ? ' is-playable' : ''}${picked === i ? ' is-picked' : ''}`}
                aria-label={`${t[0]}-${t[1]}${playable.has(i) ? ', playable' : ''}`}
                aria-disabled={!playable.has(i)}
                onClick={() => pick(i)}
              >
                <Domino a={t[0]} b={t[1]} vertical />
              </button>
            ))}
          </div>
        </div>
        {g.result && (
          <div class="overlay overlay-soft" role="dialog" aria-labelledby="dm-round">
            <div class="panel">
              <h2 id="dm-round">{g.matchWinner !== null ? (g.matchWinner === 0 ? 'You win the match!' : `${NAMES[g.matchWinner]} wins the match`) : `Round ${g.round} over`}</h2>
              <p class="text-sm">{message}</p>
              <p class="text-sm mt-1">
                Pips left: {g.result.pips.map((p, i) => `${NAMES[i]} ${p}`).join(' · ')}
              </p>
              <p class="text-sm font-semibold mt-1">
                Score: {g.scores.map((s, i) => `${NAMES[i]} ${s}`).join(' · ')} (to {g.target})
              </p>
              <div class="panel-actions">
                {g.matchWinner === null ? (
                  <button
                    type="button"
                    class="btn btn-primary"
                    onClick={() => {
                      g.nextRound();
                      setMessage(g.turn === 0 ? 'You lead: play your highest double.' : `${NAMES[g.turn]} leads.`);
                      refresh();
                      runAi();
                    }}
                  >
                    Next round
                  </button>
                ) : (
                  <button type="button" class="btn btn-primary" onClick={() => start()}>
                    New match
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
      <noscript dangerouslySetInnerHTML={{ __html: '<p class="noscript">Dominoes needs JavaScript to run. Please enable it to play.</p>' }} />
    </section>
  );
}
