import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { readJson, writeJson } from '../../engines/core/storage';
import { cardLabel } from '../../engines/solitaire/cards';
import { dropTarget, hitTest, layoutTable, type Scene } from '../../engines/solitaire/layout';
import { CardRenderer, type CardRef, type Overlay } from '../../engines/solitaire/render';
import { STOCK, pilesOf, samePile, type PileRef, type SolitaireEngine, type TableSpec } from '../../engines/solitaire/table';

export type Options = Record<string, number>;

export interface OptionGroup {
  id: string;
  label: string;
  values: { value: number; label: string }[];
}

export interface CardTableProps {
  /** Game name for headings and the accessible label, e.g. "Spider Solitaire". */
  name: string;
  /** Prefix for saved settings and best times. */
  storageKey: string;
  create: (seed: string, options: Options) => SolitaireEngine;
  spec: (options: Options) => TableSpec;
  newSeed: () => string;
  /** URL query parameter that selects and shares a deal, e.g. "deal". */
  seedParam?: string;
  isValidSeed?: (seed: string) => boolean;
  /** Start with this deal (FreeCell deal pages); the URL is then left alone. */
  fixedSeed?: string;
  optionGroups: OptionGroup[];
  defaults: Options;
  keyboardHelp: string;
  otherGame: { name: string; href: string };
}

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const pileName = (p: PileRef) =>
  p.kind === 'stock'
    ? 'Stock'
    : p.kind === 'waste'
      ? 'Waste'
      : p.kind === 'foundation'
        ? `Foundation ${p.index + 1}`
        : p.kind === 'cell'
          ? `Free cell ${p.index + 1}`
          : `Column ${p.index + 1}`;

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const optionsKey = (o: Options) => Object.keys(o).sort().map((k) => `${k}${o[k]}`).join('-') || 'all';

/**
 * The shared solitaire table: Canvas board, toolbar, timer, dialogs and all
 * input handling (tap-to-move, drag and drop, two-tap moves, keyboard play
 * with screen-reader announcements). Each game supplies only its engine,
 * table layout and option groups.
 */
export default function CardTable(props: CardTableProps) {
  const { name, storageKey, create, spec, newSeed, seedParam, isValidSeed, fixedSeed, optionGroups, defaults, keyboardHelp, otherGame } = props;
  const areaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const game = useRef<SolitaireEngine | null>(null);
  const tableSpec = useRef<TableSpec | null>(null);
  const renderer = useRef<CardRenderer | null>(null);
  const scene = useRef<Scene | null>(null);
  const overlay = useRef<Overlay>({ selected: null, focus: null, hint: null, drag: null });
  const pointer = useRef<{ x: number; y: number; hit: CardRef; draggable: boolean; dragging: boolean } | null>(null);
  const timer = useRef({ startedAt: 0, banked: 0 });
  const finishing = useRef(0);
  const hintTimer = useRef(0);
  const wonRef = useRef(false);

  const [options, setOptions] = useState<Options>(defaults);
  const [seed, setSeed] = useState('');
  const [, setVersion] = useState(0);
  const [won, setWonState] = useState(false);
  const [stuck, setStuck] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [best, setBest] = useState<number | null>(null);
  const [announce, setAnnounce] = useState('');

  const setWon = (v: boolean) => {
    wonRef.current = v;
    setWonState(v);
  };
  const bestKey = (o: Options) => `${storageKey}:best:${optionsKey(o)}`;

  const paint = useCallback(() => {
    const g = game.current;
    const r = renderer.current;
    const area = areaRef.current;
    const sp = tableSpec.current;
    if (!g || !r || !area || !sp) return;
    area.style.minHeight = '';
    const w = area.clientWidth;
    const h = area.clientHeight;
    const s = layoutTable(sp, g, w, h);
    scene.current = s;
    const height = Math.max(h, s.height);
    if (s.height > h) area.style.minHeight = `${s.height}px`;
    const canvas = canvasRef.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(height * dpr)) r.resize(w, height, dpr);
    r.draw(s, overlay.current);
  }, []);

  const now = () => timer.current.banked + (timer.current.startedAt ? performance.now() - timer.current.startedAt : 0);
  const startClock = () => {
    if (!timer.current.startedAt) timer.current.startedAt = performance.now();
    setRunning(true);
  };
  const stopClock = () => {
    timer.current.banked = now();
    timer.current.startedAt = 0;
    setRunning(false);
    setElapsed(timer.current.banked);
  };

  const start = (o: Options, s: string) => {
    window.clearInterval(finishing.current);
    finishing.current = 0;
    game.current = create(s, o);
    tableSpec.current = spec(o);
    overlay.current = { selected: null, focus: null, hint: null, drag: null };
    timer.current = { startedAt: 0, banked: 0 };
    setOptions(o);
    setSeed(s);
    setWon(false);
    setStuck(false);
    setElapsed(0);
    setRunning(false);
    setBest(readJson<number | null>(bestKey(o), null));
    if (seedParam && !fixedSeed) {
      const url = new URL(location.href);
      url.searchParams.set(seedParam, s);
      history.replaceState(null, '', url);
    }
    setVersion((v) => v + 1);
    paint();
  };

  /** Call after every state change: repaints, updates the toolbar, detects win or no moves. */
  const after = (message?: string) => {
    const g = game.current!;
    overlay.current.hint = null;
    if (message) setAnnounce(message);
    if (g.isWon && !wonRef.current) {
      stopClock();
      const time = timer.current.banked;
      const prev = readJson<number | null>(bestKey(options), null);
      if (prev === null || time < prev) {
        writeJson(bestKey(options), time);
        setBest(time);
      }
      setWon(true);
      setAnnounce(`You won in ${fmt(time)} with ${g.moves} moves.`);
    }
    const isStuck = !g.isWon && !finishing.current && g.isStuck;
    setStuck(isStuck);
    if (isStuck) setAnnounce('No useful moves left. Undo or start a new game.');
    setVersion((v) => v + 1);
    paint();
  };

  const describeTop = (p: PileRef) => {
    const g = game.current!;
    const cards = g.cardsIn(p);
    if (p.kind === 'stock') return cards.length ? `${cards.length} cards` : 'empty';
    const top = cards[cards.length - 1];
    return top ? cardLabel(top) : 'empty';
  };

  const draw = () => {
    const g = game.current!;
    const msg = g.draw();
    if (!msg) {
      setAnnounce(g.drawBlockedReason() ?? 'Nothing to draw.');
      return;
    }
    startClock();
    overlay.current.selected = null;
    after(msg);
  };

  const tryMove = (from: CardRef, to: PileRef): boolean => {
    const g = game.current!;
    const run = g.pickUp(from.pile, from.index);
    if (!run || !g.move(from.pile, from.index, to)) return false;
    startClock();
    overlay.current.selected = null;
    const more = run.length > 1 ? ` and ${run.length - 1} more` : '';
    after(`Moved ${cardLabel(run[0]!)}${more} to ${pileName(to).toLowerCase()}.`);
    return true;
  };

  /** The move the visible hint suggests for this card, if any. */
  const hintedTarget = (ref: CardRef): PileRef | null => {
    const h = overlay.current.hint;
    return h && samePile(h.from.pile, ref.pile) && h.from.index === ref.index ? h.to : null;
  };

  /** Tap/click: the stock draws; a card goes to its hinted or best target; otherwise it is selected for a second tap. */
  const tap = (hit: CardRef) => {
    const g = game.current!;
    const o = overlay.current;
    if (hit.pile.kind === 'stock') {
      draw();
      return;
    }
    const hinted = hintedTarget(hit);
    if (hinted && tryMove(hit, hinted)) return;
    if (o.selected) {
      const sel = o.selected;
      o.selected = null;
      if (!samePile(sel.pile, hit.pile) && tryMove(sel, hit.pile)) return;
      if (samePile(sel.pile, hit.pile) && sel.index === hit.index) {
        after('Selection cleared.');
        return;
      }
    }
    if (hit.index < 0 || !g.pickUp(hit.pile, hit.index)) {
      after();
      return;
    }
    const target = g.bestTarget(hit.pile, hit.index);
    if (target && tryMove(hit, target)) return;
    o.selected = hit;
    after(`${cardLabel(g.pickUp(hit.pile, hit.index)![0]!)} selected. Choose where to put it.`);
  };

  const point = (e: PointerEvent) => {
    const b = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  };

  const onPointerDown = (e: PointerEvent) => {
    const s = scene.current;
    const g = game.current;
    if (!s || !g || wonRef.current || finishing.current) return;
    const { x, y } = point(e);
    const hit = hitTest(s, x, y);
    if (!hit) return;
    overlay.current.focus = null;
    pointer.current = { x, y, hit, draggable: hit.index >= 0 && !!g.pickUp(hit.pile, hit.index), dragging: false };
    try {
      canvasRef.current!.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic or already-released pointer */
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    const p = pointer.current;
    if (!p || !p.draggable) return;
    const { x, y } = point(e);
    if (!p.dragging && Math.hypot(x - p.x, y - p.y) < 6) return;
    p.dragging = true;
    overlay.current.selected = null;
    overlay.current.drag = { ...p.hit, dx: x - p.x, dy: y - p.y };
    paint();
  };

  const onPointerUp = (e: PointerEvent) => {
    const p = pointer.current;
    pointer.current = null;
    if (!p) return;
    if (!p.dragging) {
      tap(p.hit);
      return;
    }
    const s = scene.current!;
    const lead = s.cards.find((c) => samePile(c.pile, p.hit.pile) && c.index === p.hit.index)!;
    const { x, y } = point(e);
    overlay.current.drag = null;
    const to = dropTarget(s, lead.rect.x + (x - p.x) + lead.rect.w / 2, lead.rect.y + (y - p.y) + lead.rect.h * 0.3);
    if (!to || !tryMove(p.hit, to)) after();
  };

  const onPointerCancel = () => {
    pointer.current = null;
    overlay.current.drag = null;
    paint();
  };

  const showHint = () => {
    const g = game.current!;
    const h = g.hint();
    if (!h) {
      setAnnounce(g.isStuck ? 'No moves left. Undo or start a new game.' : 'No more hints here. You can still move cards, or undo to try another line.');
      return;
    }
    window.clearTimeout(hintTimer.current);
    if (h.kind === 'draw') {
      overlay.current.hint = null;
      overlay.current.focus = { pile: STOCK, index: -1 };
      setAnnounce('Hint: use the stock.');
    } else {
      overlay.current.hint = { from: { pile: h.from, index: h.index }, to: h.to };
      overlay.current.focus = { pile: h.from, index: h.index };
      setAnnounce(`Hint: move ${cardLabel(g.pickUp(h.from, h.index)![0]!)} to ${pileName(h.to).toLowerCase()}.`);
    }
    paint();
    hintTimer.current = window.setTimeout(() => {
      overlay.current.hint = null;
      paint();
    }, 3000);
  };

  const undo = () => {
    window.clearInterval(finishing.current);
    finishing.current = 0;
    if (!game.current?.undo()) return;
    overlay.current.selected = null;
    if (wonRef.current) {
      setWon(false);
      startClock();
    }
    after('Move undone.');
  };

  const autoFinish = () => {
    const g = game.current!;
    if (!g.canAutoFinish || finishing.current) return;
    overlay.current.selected = null;
    if (reducedMotion()) {
      while (g.autoFinishStep());
      after();
      return;
    }
    finishing.current = window.setInterval(() => {
      if (!g.autoFinishStep()) {
        window.clearInterval(finishing.current);
        finishing.current = 0;
      }
      after();
    }, 60);
  };

  // ----- keyboard -----
  const focusIndexFor = (p: PileRef) => (p.kind === 'stock' ? -1 : game.current!.cardsIn(p).length - 1);

  const setFocus = (ref: CardRef) => {
    overlay.current.focus = ref;
    const g = game.current!;
    let text = `${pileName(ref.pile)}: ${describeTop(ref.pile)}`;
    if (ref.pile.kind === 'tableau' && ref.index >= 0) {
      const down = g.faceDownIn(ref.pile);
      text = `${pileName(ref.pile)}: ${cardLabel(g.cardsIn(ref.pile)[ref.index]!)}${down ? `, ${down} face down` : ''}`;
    }
    setAnnounce(text);
    paint();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const g = game.current;
    const sp = tableSpec.current;
    if (!g || !sp || wonRef.current) return;
    const o = overlay.current;
    const k = e.key;
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
      return;
    }
    const piles = pilesOf(sp);
    const current = o.focus ?? { pile: piles[0]!, index: focusIndexFor(piles[0]!) };
    const pos = Math.max(0, piles.findIndex((p) => samePile(p, current.pile)));

    if (k === 'ArrowRight' || k === 'ArrowLeft') {
      e.preventDefault();
      const next = o.focus ? piles[(pos + (k === 'ArrowRight' ? 1 : piles.length - 1)) % piles.length]! : piles[0]!;
      setFocus({ pile: next, index: focusIndexFor(next) });
    } else if ((k === 'ArrowUp' || k === 'ArrowDown') && current.pile.kind === 'tableau') {
      e.preventDefault();
      const cards = g.cardsIn(current.pile);
      const lo = Math.min(g.faceDownIn(current.pile), cards.length - 1);
      const idx = Math.min(cards.length - 1, Math.max(lo, current.index + (k === 'ArrowUp' ? -1 : 1)));
      setFocus({ pile: current.pile, index: idx });
    } else if (k === 'Enter' || k === ' ') {
      e.preventDefault();
      if (current.pile.kind === 'stock') draw();
      else if (o.selected) {
        if (!tryMove(o.selected, current.pile)) {
          o.selected = null;
          after(`Can't move there. Selection cleared.`);
        }
      } else if (hintedTarget(current) && tryMove(current, hintedTarget(current)!)) {
        /* played the hinted move */
      } else if (current.index >= 0 && g.pickUp(current.pile, current.index)) {
        o.selected = current;
        const run = g.pickUp(current.pile, current.index)!;
        after(`Picked up ${cardLabel(run[0]!)}${run.length > 1 ? ` and ${run.length - 1} more` : ''}. Move to a pile and press Enter.`);
      } else setAnnounce('That card cannot be picked up.');
      if (o.focus) o.focus = { pile: o.focus.pile, index: focusIndexFor(o.focus.pile) };
      paint();
    } else if (k === 'a' || k === 'A') {
      if (current.index >= 0) {
        const t = hintedTarget(current) ?? g.bestTarget(current.pile, current.index);
        if (!t || !tryMove(current, t)) setAnnounce('No move for that card.');
        o.focus = { pile: current.pile, index: focusIndexFor(current.pile) };
        paint();
      }
    } else if (k === 'd' || k === 'D') draw();
    else if (k === 'h' || k === 'H') showHint();
    else if (k === 'Escape') {
      o.selected = null;
      after('Selection cleared.');
    }
  };

  // ----- lifecycle -----
  useEffect(() => {
    renderer.current = new CardRenderer(canvasRef.current!);
    const params = new URLSearchParams(location.search);
    const saved = readJson<Options>(`${storageKey}:settings`, {});
    const initial: Options = { ...defaults };
    for (const g of optionGroups) {
      const fromUrl = Number(params.get(g.id));
      const pick = g.values.some((v) => v.value === fromUrl) ? fromUrl : saved[g.id];
      if (pick !== undefined && g.values.some((v) => v.value === pick)) initial[g.id] = pick;
    }
    const urlSeed = seedParam ? params.get(seedParam) : null;
    const s = fixedSeed ?? (urlSeed && (!isValidSeed || isValidSeed(urlSeed)) ? urlSeed : newSeed());
    start(initial, s);

    let last = '';
    const relayout = () => {
      const a = areaRef.current!;
      const key = `${a.clientWidth}x${window.innerHeight}`;
      if (key === last) return;
      last = key;
      paint();
    };
    const ro = new ResizeObserver(relayout);
    ro.observe(areaRef.current!);
    window.addEventListener('resize', relayout);
    const onVisibility = () => {
      if (document.hidden && timer.current.startedAt) {
        timer.current.banked = now();
        timer.current.startedAt = 0;
      } else if (!document.hidden && game.current && game.current.moves > 0 && !game.current.isWon) {
        timer.current.startedAt = performance.now();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', relayout);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(finishing.current);
      window.clearTimeout(hintTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setElapsed(now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const setOption = (id: string, value: number) => {
    if (options[id] === value) return;
    const next = { ...options, [id]: value };
    writeJson(`${storageKey}:settings`, next);
    start(next, newSeed());
    const group = optionGroups.find((g) => g.id === id);
    setAnnounce(`New game: ${group?.values.find((v) => v.value === value)?.label ?? value}.`);
  };

  const g = game.current;
  return (
    <section class="game" aria-label={name}>
      <div class="toolbar" role="toolbar" aria-label="Game controls">
        <button type="button" class="btn" onClick={() => start(options, newSeed())}>
          New game
        </button>
        <button type="button" class="btn" onClick={() => start(options, seed)} title="Replay this deal from the start">
          Restart
        </button>
        <button type="button" class="btn" onClick={undo} disabled={!g?.canUndo}>
          Undo
        </button>
        <button type="button" class="btn" onClick={showHint} disabled={won}>
          Hint
        </button>
        {optionGroups.map((group) => (
          <div key={group.id} class="segmented" role="radiogroup" aria-label={group.label}>
            {group.values.map((v) => (
              <button
                key={v.value}
                type="button"
                role="radio"
                aria-checked={options[group.id] === v.value}
                class="seg"
                onClick={() => setOption(group.id, v.value)}
              >
                {v.label}
              </button>
            ))}
          </div>
        ))}
        {g?.canAutoFinish && (
          <button type="button" class="btn btn-primary" onClick={autoFinish}>
            Finish
          </button>
        )}
        <dl class="stats">
          <div>
            <dt>Game</dt>
            <dd class="whitespace-nowrap">{g?.status ?? ''}</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd class="tabular-nums">{fmt(elapsed)}</dd>
          </div>
          <div>
            <dt>Moves</dt>
            <dd class="tabular-nums">{g?.moves ?? 0}</dd>
          </div>
        </dl>
      </div>

      <div ref={areaRef} class="board-area board-area-top">
        <canvas
          ref={canvasRef}
          class="board"
          tabIndex={0}
          role="application"
          aria-roledescription="Solitaire table"
          aria-label={`${name} table. ${keyboardHelp}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onKeyDown={onKeyDown}
        />
        {won && (
          <div class="overlay" role="dialog" aria-modal="false" aria-labelledby="win-title">
            <div class="panel">
              <h2 id="win-title">You won!</h2>
              <p>
                {g?.status} in <strong>{fmt(elapsed)}</strong> · {g?.moves} moves
                {best !== null && <> · Best {fmt(best)}</>}
              </p>
              <div class="panel-actions">
                <button type="button" class="btn btn-primary" onClick={() => start(options, newSeed())}>
                  Play again
                </button>
                <a class="btn" href={otherGame.href}>
                  {otherGame.name}
                </a>
              </div>
            </div>
          </div>
        )}
        {stuck && !won && (
          <div class="overlay overlay-soft" role="alertdialog" aria-labelledby="stuck-title">
            <div class="panel">
              <h2 id="stuck-title">No useful moves left</h2>
              <p>Undo a few moves to try another line, restart this deal, or start a new game.</p>
              <div class="panel-actions">
                <button type="button" class="btn btn-primary" onClick={undo}>
                  Undo
                </button>
                <button type="button" class="btn" onClick={() => start(options, seed)}>
                  Restart
                </button>
                <button type="button" class="btn" onClick={() => start(options, newSeed())}>
                  New game
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <p class="sr-only" aria-live="polite">
        {announce}
      </p>
      <noscript>
        <p class="noscript">{name} needs JavaScript to run. Please enable it to play.</p>
      </noscript>
    </section>
  );
}
