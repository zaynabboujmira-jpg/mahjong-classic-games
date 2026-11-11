import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { createRng, randomSeed } from '../../engines/core/rng';
import { readJson, writeJson } from '../../engines/core/storage';
import { cardLabel } from '../../engines/solitaire/cards';
import {
  Klondike,
  STOCK,
  WASTE,
  foundation,
  samePile,
  tableau,
  type DrawMode,
  type Hint,
  type PileRef,
} from '../../engines/solitaire/klondike';
import { dropTarget, hitTest, layoutScene, type Scene } from '../../engines/solitaire/layout';
import { CardRenderer, type CardRef, type Overlay } from '../../engines/solitaire/render';

interface Props {
  /** Default mode when the player has no saved preference. */
  defaultMode: DrawMode;
  otherGame: { name: string; href: string };
}

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Keyboard focus order: stock, waste, 4 foundations, 7 columns. */
const PILES: PileRef[] = [STOCK, WASTE, ...[0, 1, 2, 3].map(foundation), ...[0, 1, 2, 3, 4, 5, 6].map(tableau)];

const pileName = (p: PileRef) =>
  p.kind === 'stock' ? 'Stock' : p.kind === 'waste' ? 'Waste' : p.kind === 'foundation' ? `Foundation ${p.index + 1}` : `Column ${p.index + 1}`;

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function KlondikeGame({ defaultMode, otherGame }: Props) {
  const areaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const game = useRef<Klondike | null>(null);
  const renderer = useRef<CardRenderer | null>(null);
  const scene = useRef<Scene | null>(null);
  const overlay = useRef<Overlay>({ selected: null, focus: null, hint: null, drag: null });
  const pointer = useRef<{ x: number; y: number; hit: CardRef; draggable: boolean; dragging: boolean } | null>(null);
  const timer = useRef({ startedAt: 0, banked: 0 });
  const finishing = useRef(0);
  const hintTimer = useRef(0);

  const [mode, setMode] = useState<DrawMode>(defaultMode);
  const [, setVersion] = useState(0);
  const [won, setWonState] = useState(false);
  // Mirrors `won` for callbacks that outlive a render (auto-finish interval).
  const wonRef = useRef(false);
  const setWon = (v: boolean) => {
    wonRef.current = v;
    setWonState(v);
  };
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [best, setBest] = useState<number | null>(null);
  const [announce, setAnnounce] = useState('');
  const bestKey = (m: DrawMode) => `klondike:best:draw${m}`;

  const paint = useCallback(() => {
    const g = game.current;
    const r = renderer.current;
    const area = areaRef.current;
    if (!g || !r || !area) return;
    area.style.minHeight = '';
    const w = area.clientWidth;
    const h = area.clientHeight;
    const s = layoutScene(g.state, w, h, g.drawMode);
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

  const newGame = useCallback(
    (m: DrawMode, seed = randomSeed()) => {
      window.clearInterval(finishing.current);
      game.current = new Klondike(createRng(seed), m);
      overlay.current = { selected: null, focus: null, hint: null, drag: null };
      timer.current = { startedAt: 0, banked: 0 };
      setMode(m);
      setWon(false);
      setElapsed(0);
      setRunning(false);
      setBest(readJson<number | null>(bestKey(m), null));
      setVersion((v) => v + 1);
      paint();
    },
    [paint],
  );

  /** Call after every state change: repaints, updates the toolbar, detects a win. */
  const after = (message?: string) => {
    const g = game.current!;
    overlay.current.hint = null;
    if (message) setAnnounce(message);
    if (g.isWon && !wonRef.current) {
      stopClock();
      const time = timer.current.banked;
      const prev = readJson<number | null>(bestKey(g.drawMode), null);
      if (prev === null || time < prev) {
        writeJson(bestKey(g.drawMode), time);
        setBest(time);
      }
      setWon(true);
      setAnnounce(`You won in ${fmt(time)} with ${g.state.moves} moves.`);
    }
    setVersion((v) => v + 1);
    paint();
  };

  const describeTop = (p: PileRef) => {
    const s = game.current!.state;
    if (p.kind === 'stock') return s.stock.length ? `${s.stock.length} cards` : s.waste.length ? 'empty, select to turn the waste over' : 'empty';
    const cards = p.kind === 'waste' ? s.waste : p.kind === 'foundation' ? s.foundations[p.index]! : s.tableau[p.index]!.cards;
    const top = cards[cards.length - 1];
    return top ? cardLabel(top) : 'empty';
  };

  const draw = () => {
    const g = game.current!;
    if (!g.draw()) return;
    startClock();
    overlay.current.selected = null;
    const top = g.state.waste[g.state.waste.length - 1];
    const turned = g.drawMode === 3 ? 'Turned up to 3 cards; ' : 'Drew ';
    after(top ? `${turned}${cardLabel(top)}${g.drawMode === 3 ? ' is on top' : ''}.` : 'Waste turned over.');
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

  /** Tap/click: stock draws; a card goes to its best target; otherwise select it for a second tap. */
  const tap = (hit: CardRef) => {
    const g = game.current!;
    const o = overlay.current;
    if (hit.pile.kind === 'stock') {
      draw();
      return;
    }
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
    const card = cardLabel(g.pickUp(hit.pile, hit.index)![0]!);
    after(`${card} selected. Choose where to put it.`);
  };

  const point = (e: PointerEvent) => {
    const b = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  };

  const onPointerDown = (e: PointerEvent) => {
    const s = scene.current;
    const g = game.current;
    if (!s || !g || won || finishing.current) return;
    const { x, y } = point(e);
    const hit = hitTest(s, x, y);
    if (!hit) return;
    overlay.current.focus = null;
    pointer.current = { x, y, hit, draggable: hit.index >= 0 && !!g.pickUp(hit.pile, hit.index), dragging: false };
    canvasRef.current!.setPointerCapture(e.pointerId);
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
    const cx = lead.rect.x + (x - p.x) + lead.rect.w / 2;
    const cy = lead.rect.y + (y - p.y) + lead.rect.h * 0.3;
    overlay.current.drag = null;
    const to = dropTarget(s, cx, cy);
    if (!to || !tryMove(p.hit, to)) after();
  };

  const onPointerCancel = () => {
    pointer.current = null;
    overlay.current.drag = null;
    paint();
  };

  const showHint = () => {
    const g = game.current!;
    const h: Hint | null = g.hint();
    if (!h) {
      setAnnounce('No useful moves left. Start a new game.');
      return;
    }
    window.clearTimeout(hintTimer.current);
    if (h.kind === 'draw') {
      overlay.current.hint = null;
      overlay.current.focus = { pile: STOCK, index: -1 };
      setAnnounce(g.state.stock.length ? 'Hint: draw from the stock.' : 'Hint: turn the waste over.');
    } else {
      overlay.current.hint = { from: { pile: h.from, index: h.index }, to: h.to };
      overlay.current.focus = { pile: h.from, index: h.index };
      const card = g.pickUp(h.from, h.index)![0]!;
      setAnnounce(`Hint: move ${cardLabel(card)} to ${pileName(h.to).toLowerCase()}.`);
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
  const focusIndexFor = (p: PileRef): number => {
    const s = game.current!.state;
    if (p.kind === 'stock') return -1;
    const len = p.kind === 'waste' ? s.waste.length : p.kind === 'foundation' ? s.foundations[p.index]!.length : s.tableau[p.index]!.cards.length;
    return len - 1;
  };

  const setFocus = (ref: CardRef) => {
    overlay.current.focus = ref;
    const g = game.current!;
    let text = `${pileName(ref.pile)}: ${describeTop(ref.pile)}`;
    if (ref.pile.kind === 'tableau' && ref.index >= 0) {
      const t = g.state.tableau[ref.pile.index]!;
      text = `${pileName(ref.pile)}: ${cardLabel(t.cards[ref.index]!)}${t.faceDown ? `, ${t.faceDown} face down` : ''}`;
    }
    setAnnounce(text);
    paint();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const g = game.current;
    if (!g || won) return;
    const o = overlay.current;
    const k = e.key;
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
      return;
    }
    const current = o.focus ?? { pile: PILES[0]!, index: -1 };
    const pos = Math.max(0, PILES.findIndex((p) => samePile(p, current.pile)));

    if (k === 'ArrowRight' || k === 'ArrowLeft') {
      e.preventDefault();
      const next = PILES[(pos + (k === 'ArrowRight' ? 1 : PILES.length - 1)) % PILES.length]!;
      setFocus({ pile: next, index: focusIndexFor(next) });
    } else if ((k === 'ArrowUp' || k === 'ArrowDown') && current.pile.kind === 'tableau') {
      e.preventDefault();
      const t = g.state.tableau[current.pile.index]!;
      const lo = Math.min(t.faceDown, t.cards.length - 1);
      const idx = Math.min(t.cards.length - 1, Math.max(lo, current.index + (k === 'ArrowUp' ? -1 : 1)));
      setFocus({ pile: current.pile, index: idx });
    } else if (k === 'Enter' || k === ' ') {
      e.preventDefault();
      if (current.pile.kind === 'stock') draw();
      else if (o.selected) {
        const sel = o.selected;
        if (!tryMove(sel, current.pile)) {
          o.selected = null;
          after(`Can't move there. Selection cleared.`);
        }
      } else if (current.index >= 0 && g.pickUp(current.pile, current.index)) {
        o.selected = current;
        const run = g.pickUp(current.pile, current.index)!;
        after(`Picked up ${cardLabel(run[0]!)}${run.length > 1 ? ` and ${run.length - 1} more` : ''}. Move to a pile and press Enter.`);
      } else setAnnounce('That card cannot be picked up.');
      if (o.focus) o.focus = { pile: o.focus.pile, index: focusIndexFor(o.focus.pile) };
      paint();
    } else if (k === 'a' || k === 'A') {
      if (current.index >= 0) {
        const t = g.bestTarget(current.pile, current.index);
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
    const param = new URLSearchParams(location.search).get('draw');
    const saved = readJson<{ mode?: DrawMode }>('klondike:settings', {}).mode;
    const initial: DrawMode = param === '3' ? 3 : param === '1' ? 1 : (saved ?? defaultMode);
    newGame(initial);

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
      } else if (!document.hidden && game.current && game.current.state.moves > 0 && !game.current.isWon) {
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

  const switchMode = (m: DrawMode) => {
    if (m === mode) return;
    writeJson('klondike:settings', { mode: m });
    newGame(m);
    setAnnounce(`New Draw ${m} game.`);
  };

  const g = game.current;
  return (
    <section class="game" aria-label="Klondike Solitaire">
      <div class="toolbar" role="toolbar" aria-label="Game controls">
        <button type="button" class="btn" onClick={() => newGame(mode)}>
          New game
        </button>
        <button type="button" class="btn" onClick={undo} disabled={!g?.canUndo}>
          Undo
        </button>
        <button type="button" class="btn" onClick={showHint} disabled={won}>
          Hint
        </button>
        <div class="segmented" role="radiogroup" aria-label="Cards per draw">
          {([1, 3] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} class="seg" onClick={() => switchMode(m)}>
              Draw {m}
            </button>
          ))}
        </div>
        {g?.canAutoFinish && (
          <button type="button" class="btn btn-primary" onClick={autoFinish}>
            Finish
          </button>
        )}
        <dl class="stats">
          <div>
            <dt>Time</dt>
            <dd class="tabular-nums">{fmt(elapsed)}</dd>
          </div>
          <div>
            <dt>Moves</dt>
            <dd class="tabular-nums">{g?.state.moves ?? 0}</dd>
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
          aria-label="Klondike table. Left and right arrows move between piles, up and down move within a column, Enter picks up and places cards, A auto-moves, D draws, H gives a hint, Control+Z undoes."
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
                Draw {mode} in <strong>{fmt(elapsed)}</strong> · {g?.state.moves} moves
                {best !== null && <> · Best {fmt(best)}</>}
              </p>
              <div class="panel-actions">
                <button type="button" class="btn btn-primary" onClick={() => newGame(mode)}>
                  Play again
                </button>
                <button type="button" class="btn" onClick={() => switchMode(mode === 1 ? 3 : 1)}>
                  Try Draw {mode === 1 ? 3 : 1}
                </button>
                <a class="btn" href={otherGame.href}>
                  {otherGame.name}
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
      <p class="sr-only" aria-live="polite">
        {announce}
      </p>
      <noscript>
        <p class="noscript">Klondike Solitaire needs JavaScript to run. Please enable it to play.</p>
      </noscript>
    </section>
  );
}
