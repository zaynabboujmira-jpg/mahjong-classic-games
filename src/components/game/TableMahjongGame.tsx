import { useEffect, useRef, useState } from 'preact/hooks';
import { randomSeed } from '../../engines/core/rng';
import { readJson, writeJson } from '../../engines/core/storage';
import { recordWin } from '../../engines/core/progress';
import { CARD, cardTokens, rankTargets } from '../../engines/mahjong-table/american';
import { charlestonPass, stepBots, suggestDiscard } from '../../engines/mahjong-table/ai';
import { FAAN_TABLE } from '../../engines/mahjong-table/classic';
import { YAKU_TABLE, doraOf } from '../../engines/mahjong-table/riichi';
import { RULES, SEAT_NAMES, TableGame, nextHand, type Claim, type Variant } from '../../engines/mahjong-table/game';
import { TableRenderer } from '../../engines/mahjong-table/render';
import { JOKER, shortName, tileName } from '../../engines/mahjong-table/tiles';

interface Props {
  variant: Variant;
  variants: { id: Variant; name: string; href: string }[];
}

interface Session {
  scores: number[];
  dealer: number;
  prevailing: number;
  hands: number;
  /** Riichi: repeat counters and riichi sticks carried to the next hand. */
  honba?: number;
  sticks?: number;
}

const FRESH: Session = { scores: [0, 0, 0, 0], dealer: 0, prevailing: 0, hands: 0 };
/** Riichi starts everyone on 25,000 points. */
const freshSession = (riichi: boolean): Session => ({ ...FRESH, scores: riichi ? [25000, 25000, 25000, 25000] : [0, 0, 0, 0], honba: 0, sticks: 0 });
const SUIT_COLORS = ['#1d4e89', '#c2272d', '#167a3e'];
const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const claimLabel = (c: Claim, american: boolean) => {
  if (c.type === 'win') return 'Mahjong!';
  if (c.type === 'chow') return `Chow ${[0, 1, 2].map((k) => ((c.start + k) % 9) + 1).join('-')}`;
  const name = c.type[0]!.toUpperCase() + c.type.slice(1);
  return american && c.jokers ? `${name} (${c.jokers} joker${c.jokers > 1 ? 's' : ''})` : name;
};

export default function TableMahjongGame({ variant, variants }: Props) {
  const rules = RULES[variant];
  const areaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<TableRenderer | null>(null);
  const game = useRef<TableGame | null>(null);
  const session = useRef<Session>(freshSession(rules.riichi));
  const riichiMode = useRef(false);
  const timer = useRef(0);
  const seenEvents = useRef(0);
  const selected = useRef(new Set<number>());
  const hint = useRef(-1);
  const focus = useRef(-1);
  const settled = useRef(false);

  const [, setVersion] = useState(0);
  const [announce, setAnnounce] = useState('');
  const [lastEvent, setLastEvent] = useState('');
  const [panel, setPanel] = useState(false);
  const [showResult, setShowResult] = useState(true);
  const storageKey = `table:${variant}:session`;

  const paint = () => {
    const g = game.current;
    const r = renderer.current;
    if (!g || !r || !r.layout.w) return;
    const w = g.waiting();
    const active = w.type === 'turn' ? w.player : -1;
    r.draw(g, { selected: selected.current, hint: hint.current, focus: focus.current, active, scores: session.current.scores, reveal: g.phase === 'over' });
  };

  const fit = () => {
    const el = areaRef.current;
    const r = renderer.current;
    if (!el || !r) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (w && h && (w !== r.layout.w || h !== r.layout.h)) r.resize(w, h, Math.min(window.devicePixelRatio || 1, 3));
    paint();
  };

  /** Re-render, announce new events, settle scores once a hand ends. */
  const refresh = () => {
    const g = game.current!;
    const fresh = g.events.slice(seenEvents.current);
    seenEvents.current = g.events.length;
    if (fresh.length) {
      const text = fresh.map((e) => e.text).join(' ');
      setAnnounce(text);
      setLastEvent(fresh[fresh.length - 1]!.text);
    }
    if (g.phase === 'over' && !settled.current) {
      settled.current = true;
      const s = session.current;
      const r = g.result!;
      const next = nextHand(rules, g.dealer, g.prevailing, r);
      session.current = { scores: s.scores.map((v, i) => v + r.payments[i]!), dealer: next.dealer, prevailing: next.prevailing, hands: s.hands + 1 };
      if (rules.riichi) {
        // A repeat counter is added after a dealer win or any draw, and cleared otherwise.
        session.current.honba = r.kind === 'draw' || r.winner === g.dealer ? (s.honba ?? 0) + 1 : 0;
        session.current.sticks = r.sticksLeft ?? 0;
      }
      writeJson(storageKey, session.current);
      if (r.kind === 'win' && r.winner === 0) recordWin('mahjong-4p');
      setShowResult(true);
    }
    setVersion((v) => v + 1);
    // Re-measure as well as repaint: the action bar's height can change with its buttons.
    requestAnimationFrame(fit);
    fit();
  };

  /** Lets the bots play, one action at a time, until it is your move or the hand ends. */
  const pump = () => {
    window.clearTimeout(timer.current);
    const g = game.current;
    if (!g) return;
    const w = g.waiting();
    const botsPending = (w.type === 'claim' || w.type === 'charleston') && w.players.some((p) => p !== 0);
    // Bots answer a discard or pick their Charleston tiles at once; the engine
    // then waits for you if you have a decision to make too.
    if (botsPending && w.players.includes(0)) {
      stepBots(g);
      refresh();
      return;
    }
    if (w.type === 'charleston' && botsPending) {
      stepBots(g);
      pump();
      return;
    }
    const botTurn = (w.type === 'turn' && w.player !== 0) || (w.type === 'claim' && botsPending);
    if (!botTurn) {
      refresh();
      return;
    }
    const delay = reducedMotion() ? 120 : w.type === 'turn' ? 650 : 250;
    timer.current = window.setTimeout(() => {
      stepBots(g);
      refresh();
      pump();
    }, delay);
    refresh();
  };

  const startHand = (fresh = false) => {
    window.clearTimeout(timer.current);
    if (fresh) session.current = freshSession(rules.riichi);
    const s = session.current;
    game.current = new TableGame(rules, randomSeed(), { dealer: s.dealer, prevailing: s.prevailing, honba: s.honba ?? 0, sticks: s.sticks ?? 0 });
    riichiMode.current = false;
    seenEvents.current = 0;
    settled.current = false;
    selected.current = new Set();
    hint.current = -1;
    focus.current = -1;
    setShowResult(true);
    setPanel(false);
    writeJson(storageKey, session.current);
    pump();
  };

  const act = (fn: (g: TableGame) => boolean, after?: string) => {
    const g = game.current;
    if (!g || !fn(g)) return;
    selected.current = new Set();
    hint.current = -1;
    if (after) setAnnounce(after);
    pump();
  };

  const discardSelected = () => {
    const id = [...selected.current][0];
    if (id === undefined) return;
    act((g) => g.discard(0, id));
  };

  const onTileTap = (id: number) => {
    const g = game.current!;
    const w = g.waiting();
    const tile = g.seats[0]!.hand.find((t) => t.id === id)!;
    focus.current = id;
    if (w.type === 'charleston' && w.players.includes(0) && w.stage !== 'vote') {
      const sel = selected.current;
      if (sel.has(id)) sel.delete(id);
      else if (tile.kind === JOKER) setAnnounce('Jokers can never be passed.');
      else if (sel.size >= 3) setAnnounce('You can pass three tiles at most.');
      else sel.add(id);
      refresh();
      return;
    }
    if (w.type === 'turn' && w.player === 0) {
      if (rules.riichi && riichiMode.current) {
        if (g.riichiOptions(0).some((o) => g.seats[0]!.hand.find((t) => t.id === o)?.kind === tile.kind)) {
          riichiMode.current = false;
          act((x) => x.declareRiichi(0, id));
        } else setAnnounce('Discarding that tile would not leave you ready. Choose another, or cancel riichi.');
        refresh();
        return;
      }
      if (rules.riichi && g.riichi[0] && id !== g.drawnId) {
        setAnnounce('In riichi you can only discard the tile you just drew.');
        return;
      }
      if (selected.current.has(id)) {
        discardSelected();
        return;
      }
      selected.current = new Set([id]);
      setAnnounce(`${tileName(tile.kind, rules.american)} selected. Tap again or press Discard.`);
      refresh();
    }
  };

  const showHint = () => {
    const g = game.current!;
    const w = g.waiting();
    if (w.type === 'turn' && w.player === 0) {
      const t = suggestDiscard(g, 0);
      hint.current = t.id;
      selected.current = new Set([t.id]);
      setAnnounce(`Hint: discard ${tileName(t.kind, rules.american)}.`);
    } else if (w.type === 'charleston' && w.players.includes(0)) {
      const tiles = charlestonPass(g.seats[0]!.hand);
      selected.current = new Set(tiles.map((t) => t.id));
      setAnnounce(`Hint: pass ${tiles.map((t) => tileName(t.kind, true)).join(', ')}.`);
    }
    refresh();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const g = game.current;
    if (!g) return;
    const hand = renderer.current!.layout.handRects.map((r) => r.id);
    if (!hand.length) return;
    const i = Math.max(0, hand.indexOf(focus.current));
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      focus.current = hand[(i + (e.key === 'ArrowRight' ? 1 : hand.length - 1)) % hand.length]!;
      const t = g.seats[0]!.hand.find((x) => x.id === focus.current)!;
      setAnnounce(tileName(t.kind, rules.american));
      paint();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (focus.current < 0) focus.current = hand[0]!;
      onTileTap(focus.current);
    } else if (e.key === 'h' || e.key === 'H') showHint();
  };

  useEffect(() => {
    renderer.current = new TableRenderer(canvasRef.current!);
    const saved = readJson<Session | null>(storageKey, null);
    if (saved && Array.isArray(saved.scores) && saved.scores.length === 4) session.current = saved;
    else session.current = freshSession(rules.riichi);
    fit();
    startHand();
    const ro = new ResizeObserver(fit);
    ro.observe(areaRef.current!);
    window.addEventListener('resize', fit);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', fit);
      window.clearTimeout(timer.current);
    };
  }, []);

  // ----- what to show in the action bar
  const g = game.current;
  const w = g?.waiting();
  const me = g?.seats[0];
  let status = '';
  const buttons: preact.JSX.Element[] = [];
  const btn = (label: string, onClick: () => void, primary = false, disabled = false) => (
    <button key={label} type="button" class={`btn${primary ? ' btn-primary' : ''}`} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
  if (g && w && me) {
    if (w.type === 'charleston') {
      if (w.stage === 'vote') {
        status = 'First Charleston done. Play the second Charleston?';
        buttons.push(btn('Second Charleston', () => act((x) => x.voteSecond(true)), true), btn('Skip it', () => act((x) => x.voteSecond(false))));
      } else if (w.players.includes(0)) {
        const n = selected.current.size;
        if (w.stage === 'courtesy') {
          status = 'Courtesy pass: choose 0 to 3 tiles to pass across.';
          buttons.push(btn(n ? `Pass ${n} across` : 'Pass nothing', () => act((x) => x.submitPass(0, [...selected.current])), true));
        } else {
          status = `${w.stage === 'first' ? 'First' : 'Second'} Charleston: choose 3 tiles to pass ${w.dir}.`;
          buttons.push(btn(`Pass 3 ${w.dir}`, () => act((x) => x.submitPass(0, [...selected.current])), true, n !== 3));
        }
        buttons.push(btn('Hint', showHint));
      } else status = 'Passing tiles…';
    } else if (w.type === 'turn') {
      if (w.player === 0 && rules.riichi && g.riichi[0]) {
        status = g.canSelfWin(0) ? 'Riichi: your tile wins! Declare tsumo, or let it go.' : 'Riichi: the tile you drew goes out.';
        if (g.canSelfWin(0)) buttons.push(btn('Tsumo!', () => act((x) => x.selfWin(0)), true));
        buttons.push(btn('Discard drawn tile', () => act((x) => x.discard(0, x.drawnId >= 0 ? x.drawnId : x.seats[0]!.hand[x.seats[0]!.hand.length - 1]!.id)), !g.canSelfWin(0)));
      } else if (w.player === 0 && rules.riichi && riichiMode.current) {
        status = 'Riichi: tap the tile to discard. Only discards that leave you ready are allowed.';
        buttons.push(
          btn('Cancel riichi', () => {
            riichiMode.current = false;
            refresh();
          }),
        );
      } else if (w.player === 0) {
        status = 'Your turn: tap a tile, then tap it again (or press Discard).';
        if (g.canSelfWin(0)) buttons.push(btn(rules.riichi ? 'Tsumo!' : 'Mahjong!', () => act((x) => x.selfWin(0)), true));
        if (rules.riichi && g.riichiOptions(0).length)
          buttons.push(
            btn('Riichi', () => {
              riichiMode.current = true;
              setAnnounce('Riichi: choose the tile to discard.');
              refresh();
            }),
          );
        for (const k of g.kongOptions(0)) buttons.push(btn(`Kong ${tileName(k)}`, () => act((x) => x.declareKong(0, k))));
        for (const s of g.jokerSwaps(0)) buttons.push(btn(`Take joker from ${SEAT_NAMES[s.owner]}`, () => act((x) => x.swapJoker(0, s.owner, s.meld))));
        buttons.push(btn('Discard', discardSelected, !g.canSelfWin(0), selected.current.size !== 1), btn('Hint', showHint));
      } else status = `${SEAT_NAMES[w.player]} is playing…`;
    } else if (w.type === 'claim') {
      const opts = g.claimOptions(0);
      if (opts.length) {
        const d = g.lastDiscard!;
        status = `${SEAT_NAMES[d.from]} discarded ${tileName(d.tile.kind, rules.american)}. Call it or pass.`;
        opts.forEach((o) => buttons.push(btn(rules.riichi && o.type === 'win' ? 'Ron!' : claimLabel(o, rules.american), () => act((x) => x.respond(0, o)), o.type === 'win')));
        buttons.push(btn('Pass', () => act((x) => x.respond(0, null))));
      } else status = 'Waiting for calls…';
    } else status = g.result?.kind === 'win' ? 'Hand over.' : 'Hand over: draw.';
  }

  const result = g?.phase === 'over' ? g.result : null;
  const closest = g && me && rules.american && panel ? rankTargets(me.hand, me.melds, 3) : [];

  return (
    <section class="game" aria-label={`${rules.name} Mahjong against three computer players`}>
      <div class="toolbar" role="toolbar" aria-label="Game controls">
        <button type="button" class="btn" onClick={() => startHand(true)} title="Start over with all scores at zero">
          New game
        </button>
        <nav class="segmented" aria-label="Rules">
          {variants.map((v) => (
            <a key={v.id} class="seg" href={v.href} aria-current={v.id === variant ? 'page' : undefined}>
              {v.name}
            </a>
          ))}
        </nav>
        <button type="button" class="btn" aria-pressed={panel} onClick={() => setPanel(!panel)}>
          {rules.american ? 'Card' : 'Scoring'}
        </button>
        <dl class="stats">
          <div>
            <dt>Hand</dt>
            <dd class="tabular-nums">{session.current.hands + (g?.phase === 'over' ? 0 : 1)}</dd>
          </div>
          <div>
            <dt>Wall</dt>
            <dd class="tabular-nums">{g?.wallCount ?? 0}</dd>
          </div>
          {rules.riichi && g && (
            <>
              <div>
                <dt>Dora</dt>
                <dd title={g.doraIndicators().map((k) => `Indicator ${tileName(k)}: dora ${tileName(doraOf(k))}`).join('; ')}>{g.doraIndicators().map((k) => shortName(doraOf(k))).join(' ')}</dd>
              </div>
              <div>
                <dt>Sticks</dt>
                <dd class="tabular-nums" title="Riichi sticks on the table and repeat counters (honba)">
                  {g.sticks}·{g.honba}
                </dd>
              </div>
            </>
          )}
        </dl>
      </div>

      <div ref={areaRef} class="board-area table-area">
        <canvas
          ref={canvasRef}
          class="board"
          tabIndex={0}
          role="application"
          aria-roledescription="Mahjong table"
          aria-label={`Mahjong table. Your hand is along the bottom. Left and right arrows move between your tiles, Enter selects or discards, H gives a hint.`}
          onPointerDown={(e) => {
            const b = canvasRef.current!.getBoundingClientRect();
            const id = renderer.current!.tileAt(e.clientX - b.left, e.clientY - b.top);
            if (id >= 0) onTileTap(id);
          }}
          onKeyDown={onKeyDown}
        />
        {panel && (
          <div class="overlay overlay-soft table-panel-wrap" onClick={(e) => e.target === e.currentTarget && setPanel(false)}>
            <div class="panel table-panel" role="dialog" aria-label={rules.american ? 'Hand card' : 'Scoring table'}>
              {rules.american ? (
                <>
                  <h2>This site&rsquo;s card</h2>
                  {closest.length > 0 && (
                    <div class="card-closest">
                      <h3>Closest to your tiles</h3>
                      <ul>
                        {closest.map((c) => (
                          <li key={c.target.label}>
                            <strong>{c.target.label}</strong> · {c.distance === 0 ? 'complete!' : `${c.distance} tile${c.distance > 1 ? 's' : ''} away`} · {c.target.hand.value}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <ul class="card-list">
                    {CARD.map((h) => (
                      <li key={h.id}>
                        <span class="card-pattern">
                          {cardTokens(h).map((t, i) => (
                            <span key={i} style={t.suit !== null ? { color: SUIT_COLORS[t.suit] } : undefined}>
                              {t.text}{' '}
                            </span>
                          ))}
                        </span>
                        <span class="card-meta">
                          {h.concealed ? 'C' : 'X'} {h.value}
                        </span>
                        <span class="card-note">
                          {h.section}: {h.note}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p class="card-legend">Colours mark different suits. Numbers shown are examples; F = flower, D = dragon. X: exposures allowed. C: concealed.</p>
                </>
              ) : rules.riichi ? (
                <>
                  <h2>Yaku table</h2>
                  <p class="text-sm">
                    You need at least one yaku to win. Dora add han but are not a yaku. Riichi with a closed ready hand is the easiest yaku: it costs 1,000 points, which the next winner collects.
                  </p>
                  <ul class="faan-list">
                    {YAKU_TABLE.map((y) => (
                      <li key={y.name}>
                        <span>{y.name}</span>
                        <strong>{y.han}</strong>
                      </li>
                    ))}
                  </ul>
                  <p class="text-sm">
                    Points: 1 han 30 fu is 1,000 on a discard; 3 han 30 fu 3,900; 4 han 30 fu 7,700; mangan 8,000; haneman 12,000; baiman 16,000; yakuman 32,000. The dealer gets 50% more.
                  </p>
                </>
              ) : (
                <>
                  <h2>Faan table</h2>
                  <p class="text-sm">{rules.minFaan ? `You need at least ${rules.minFaan} faan to declare Mahjong.` : 'Any complete hand can win, even with 0 faan.'}</p>
                  <ul class="faan-list">
                    {FAAN_TABLE.map((f) => (
                      <li key={f.name}>
                        <span>{f.name}</span>
                        <strong>{f.faan}</strong>
                      </li>
                    ))}
                    {rules.flowers && (
                      <li>
                        <span>Own flower or season (each) · no bonus tiles · full set of four</span>
                        <strong>1 · 1 · 2</strong>
                      </li>
                    )}
                  </ul>
                </>
              )}
              <div class="panel-actions">
                <button type="button" class="btn btn-primary" onClick={() => setPanel(false)}>
                  Back to the table
                </button>
              </div>
            </div>
          </div>
        )}
        {result && showResult && (
          <div class="overlay overlay-soft" role="dialog" aria-modal="false" aria-labelledby="hand-title">
            <div class="panel">
              <h2 id="hand-title">{result.kind === 'draw' ? 'Draw' : result.winner === 0 ? 'Mahjong! You win' : `${SEAT_NAMES[result.winner]} wins`}</h2>
              {result.kind === 'win' && (
                <>
                  <p class="text-sm">
                    {result.selfDrawn ? 'Self-drawn' : `On ${result.discarder === 0 ? 'your' : `${SEAT_NAMES[result.discarder]}’s`} discard`}
                    {rules.american
                      ? ` · ${result.target!.hand.section}: ${result.target!.label}`
                      : rules.riichi
                        ? ` · ${result.faan} han ${result.fu} fu${result.limit ? ` · ${result.limit}` : ''}`
                        : ` · ${result.faan} faan`}
                  </p>
                  {!rules.american && (
                    <ul class="faan-list text-sm">
                      {result.items.map((it, i) => (
                        <li key={i}>
                          <span>{it.name}</span>
                          <strong>{it.faan}</strong>
                        </li>
                      ))}
                    </ul>
                  )}
                  {rules.american && result.jokerless && <p class="text-sm">Jokerless: value doubled.</p>}
                </>
              )}
              {result.kind === 'draw' && (
                <p>
                  The wall ran out before anyone completed a hand.
                  {rules.riichi && result.tenpai && ` Ready: ${result.tenpai.map((t, i) => (t ? SEAT_NAMES[i] : '')).filter(Boolean).join(', ') || 'nobody'}.`}
                </p>
              )}
              <ul class="score-list">
                {result.payments.map((p, i) => (
                  <li key={i}>
                    <span>{SEAT_NAMES[i]}</span>
                    <span class={p > 0 ? 'text-brand' : ''}>{p > 0 ? `+${p}` : p}</span>
                    <strong>{session.current.scores[i]}</strong>
                  </li>
                ))}
              </ul>
              <div class="panel-actions">
                <button type="button" class="btn btn-primary" onClick={() => startHand()}>
                  Next hand
                </button>
                <button type="button" class="btn" onClick={() => setShowResult(false)}>
                  View table
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div class="action-bar">
        <p class="action-status" aria-hidden="true">
          {status}
          {lastEvent && <span class="action-last"> {lastEvent}</span>}
        </p>
        <div class="action-buttons">
          {buttons}
          {result && !showResult && btn('Next hand', () => startHand(), true)}
        </div>
      </div>
      <p class="sr-only" aria-live="polite">
        {announce}
      </p>
      <noscript dangerouslySetInnerHTML={{ __html: '<p class="noscript">Mahjong needs JavaScript to run. Please enable it to play.</p>' }} />
    </section>
  );
}
