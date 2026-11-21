import { useEffect, useRef, useState } from 'preact/hooks';
import { readJson, writeJson } from '../../engines/core/storage';
import { recordWin } from '../../engines/core/progress';
import { ChineseCheckers, HOLES, POINT_HOLES, chooseMove, type CCLevel, type CCState, type Move, type Point } from '../../engines/board/chinese-checkers';

/** Table choices: computer opponents (1, 2, 3 or 5) or two people on one device. */
const MODES = [
  { id: '2', label: 'You vs 1 computer', players: 2, local: false },
  { id: '3', label: 'You vs 2 computers', players: 3, local: false },
  { id: '4', label: 'You vs 3 computers', players: 4, local: false },
  { id: '6', label: 'You vs 5 computers', players: 6, local: false },
  { id: 'local', label: '2 players, one device', players: 2, local: true },
] as const;
type ModeId = (typeof MODES)[number]['id'];
const LEVELS: CCLevel[] = ['easy', 'medium', 'hard'];
const LEVEL_NAMES: Record<CCLevel, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
/** Colours by starting point, so a point keeps its colour whatever the table size. */
const POINT_COLOUR: Record<Point, { name: string; fill: string }> = {
  'z+': { name: 'Red', fill: '#dc2626' },
  'x-': { name: 'Blue', fill: '#2563eb' },
  'y+': { name: 'Green', fill: '#16a34a' },
  'z-': { name: 'Yellow', fill: '#eab308' },
  'x+': { name: 'Purple', fill: '#9333ea' },
  'y-': { name: 'Black', fill: '#1f2937' },
};

const S = 10;
const XY = HOLES.map((h) => [S * Math.sqrt(3) * (h.x + h.z / 2), S * 1.5 * h.z] as const);
const minX = Math.min(...XY.map((p) => p[0])) - S;
const minY = Math.min(...XY.map((p) => p[1])) - S;
const W = Math.max(...XY.map((p) => p[0])) - minX + S;
const H = Math.max(...XY.map((p) => p[1])) - minY + S;
/** Triangle outline of each point, behind its holes. */
const pointPath = (p: Point) => {
  const hs = POINT_HOLES[p].map((i) => XY[i]!);
  const cx = hs.reduce((t, q) => t + q[0], 0) / hs.length;
  const cy = hs.reduce((t, q) => t + q[1], 0) / hs.length;
  // The three corners are the holes farthest from the point's centre.
  const corners = hs
    .map((q) => ({ q, d: Math.hypot(q[0] - cx, q[1] - cy) }))
    .sort((a, b) => b.d - a.d)
    .slice(0, 3)
    .map(({ q }) => [cx + (q[0] - cx) * 1.45, cy + (q[1] - cy) * 1.45]);
  return `M${corners.map((c) => c.join(' ')).join('L')}Z`;
};

interface Saved {
  state: CCState;
  mode: ModeId;
  level: CCLevel;
}

export default function ChineseCheckersGame() {
  const game = useRef(new ChineseCheckers(2));
  const [mode, setMode] = useState<ModeId>('2');
  const [level, setLevel] = useState<CCLevel>('medium');
  const [sel, setSel] = useState(-1);
  const [, setTick] = useState(0);
  const [announce, setAnnounce] = useState('');
  const timer = useRef(0);
  const recorded = useRef(false);
  const modeRef = useRef<ModeId>('2');
  const levelRef = useRef<CCLevel>('medium');

  const g = game.current;
  const m = MODES.find((x) => x.id === mode)!;
  const isHuman = (p: number) => p === 0 || m.local;
  const colourOf = (p: number) => POINT_COLOUR[g.s.starts[p]!];
  const nameOf = (p: number) => (m.local ? `${colourOf(p).name}` : p === 0 ? 'You' : `${colourOf(p).name} (computer)`);

  const save = () => writeJson('cc:game', { state: game.current.s, mode: modeRef.current, level: levelRef.current } satisfies Saved);

  const finish = () => {
    const gg = game.current;
    if (gg.s.winner < 0 || recorded.current) return;
    recorded.current = true;
    const local = MODES.find((x) => x.id === modeRef.current)!.local;
    if (!local) {
      const key = `cc:record:${levelRef.current}`;
      const r = readJson<{ won: number; lost: number }>(key, { won: 0, lost: 0 });
      if (gg.s.winner === 0) {
        r.won++;
        recordWin('chinese-checkers');
      } else r.lost++;
      writeJson(key, r);
    }
  };

  const refresh = () => {
    finish();
    save();
    setTick((n) => n + 1);
  };

  const start = (md: ModeId = modeRef.current, lv: CCLevel = levelRef.current) => {
    window.clearTimeout(timer.current);
    modeRef.current = md;
    levelRef.current = lv;
    setMode(md);
    setLevel(lv);
    writeJson('cc:settings', { mode: md, level: lv });
    game.current = new ChineseCheckers(MODES.find((x) => x.id === md)!.players);
    recorded.current = false;
    setSel(-1);
    setAnnounce('New game. You play Red, at the bottom. Move all ten marbles into the point at the top.');
    refresh();
  };

  useEffect(() => {
    const saved = readJson<Saved | null>('cc:game', null);
    const settings = readJson<{ mode?: ModeId; level?: CCLevel }>('cc:settings', {});
    const okMode = (x: unknown): x is ModeId => MODES.some((d) => d.id === x);
    const okLevel = (x: unknown): x is CCLevel => LEVELS.includes(x as CCLevel);
    if (saved && saved.state && Array.isArray(saved.state.board) && saved.state.board.length === HOLES.length && saved.state.winner < 0 && okMode(saved.mode) && okLevel(saved.level)) {
      modeRef.current = saved.mode;
      levelRef.current = saved.level;
      setMode(saved.mode);
      setLevel(saved.level);
      game.current = new ChineseCheckers(saved.state);
      setAnnounce('Welcome back: your game was restored.');
      setTick((n) => n + 1);
    } else start(okMode(settings.mode) ? settings.mode : '2', okLevel(settings.level) ? settings.level : 'medium');
    return () => window.clearTimeout(timer.current);
  }, []);

  // Computer turns.
  useEffect(() => {
    const gg = game.current;
    if (gg.s.winner >= 0 || isHuman(gg.s.turn)) return;
    timer.current = window.setTimeout(() => {
      const mv = chooseMove(gg, levelRef.current);
      if (mv) {
        const p = gg.s.turn;
        gg.play(mv);
        setAnnounce(`${nameOf(p)} moved${mv.path.length > 2 ? `, hopping ${mv.path.length - 1} times` : ''}.`);
      }
      refresh();
    }, 450);
    return () => window.clearTimeout(timer.current);
  });

  const targets = new Map<number, Move>();
  if (sel >= 0 && g.s.board[sel] === g.s.turn && isHuman(g.s.turn) && g.s.winner < 0) for (const mv of g.movesFrom(sel)) targets.set(mv.to, mv);

  const click = (i: number) => {
    if (g.s.winner >= 0 || !isHuman(g.s.turn)) return;
    const mv = targets.get(i);
    if (mv) {
      const p = g.s.turn;
      g.play(mv);
      setSel(-1);
      setAnnounce(`${nameOf(p)} moved${mv.path.length > 2 ? `, hopping ${mv.path.length - 1} times` : ''}.`);
      refresh();
      return;
    }
    if (g.s.board[i] === g.s.turn) {
      const n = g.movesFrom(i).length;
      setSel(i === sel ? -1 : i);
      setAnnounce(n ? `Marble selected: ${n} possible ${n === 1 ? 'move' : 'moves'}.` : 'That marble cannot move.');
    } else setSel(-1);
  };

  const undo = () => {
    window.clearTimeout(timer.current);
    const gg = game.current;
    if (!gg.s.history.length) return;
    if (m.local) gg.undo();
    else {
      // Back to your previous turn: take back the computers' replies and your move.
      while (gg.s.history.length && gg.s.history[gg.s.history.length - 1]!.player !== 0) gg.undo();
      gg.undo();
    }
    recorded.current = false;
    setSel(-1);
    setAnnounce('Move taken back.');
    refresh();
  };

  const last = g.s.history[g.s.history.length - 1]?.move;
  const turnName = nameOf(g.s.turn);
  const canUndo = m.local ? g.s.history.length > 0 : g.s.history.some((h) => h.player === 0);
  const message =
    g.s.winner >= 0
      ? `${nameOf(g.s.winner)} ${g.s.winner === 0 && !m.local ? 'win' : 'wins'}!`
      : isHuman(g.s.turn)
        ? `${m.local ? `${turnName} to move` : 'Your move'}: ${sel >= 0 && targets.size ? 'tap a highlighted hole.' : 'tap one of your marbles.'}`
        : `${turnName} is thinking…`;

  return (
    <section class="game" aria-label="Chinese Checkers">
      <div class="toolbar" role="toolbar" aria-label="Game controls">
        <button type="button" class="btn btn-primary" onClick={() => start()}>
          New game
        </button>
        <button type="button" class="btn" onClick={undo} disabled={!canUndo}>
          Undo
        </button>
        <label class="cc-pick">
          <span class="sr-only">Players</span>
          <select value={mode} onChange={(e) => start((e.currentTarget as HTMLSelectElement).value as ModeId)}>
            {MODES.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        {!m.local && (
          <div class="segmented" role="radiogroup" aria-label="Computer level">
            {LEVELS.map((l) => (
              <button key={l} type="button" role="radio" class="seg" aria-checked={l === level} onClick={() => start(modeRef.current, l)}>
                {LEVEL_NAMES[l]}
              </button>
            ))}
          </div>
        )}
        <dl class="stats">
          <div>
            <dt>Turn</dt>
            <dd>
              <span class="cc-dot" style={{ background: colourOf(g.s.turn).fill }} /> {m.local ? colourOf(g.s.turn).name : g.s.turn === 0 ? 'You' : colourOf(g.s.turn).name}
            </dd>
          </div>
          <div>
            <dt>Moves</dt>
            <dd class="tabular-nums">{g.s.moves}</dd>
          </div>
        </dl>
      </div>
      <div class="board-area cc-area">
        <p class="arcade-message cc-msg" aria-hidden="true">
          {message}
        </p>
        <svg class="cc-board" viewBox={`${minX} ${minY} ${W} ${H}`} role="group" aria-label="Chinese Checkers star board">
          {(Object.keys(POINT_COLOUR) as Point[]).map((p) => {
            const owner = g.s.starts.indexOf(p);
            const targetOf = g.s.starts.findIndex((_, k) => g.target(k) === p);
            const c = owner >= 0 ? POINT_COLOUR[p].fill : targetOf >= 0 ? POINT_COLOUR[g.s.starts[targetOf]!].fill : '';
            return <path key={p} d={pointPath(p)} class="cc-point" style={c ? { fill: c } : undefined} />;
          })}
          {last && <polyline class="cc-path" points={last.path.map((i) => XY[i]!.join(',')).join(' ')} />}
          {HOLES.map((_, i) => {
            const owner = g.s.board[i]!;
            const [x, y] = XY[i]!;
            const isTarget = targets.has(i);
            const mine = owner >= 0 && owner === g.s.turn && isHuman(owner) && g.s.winner < 0;
            const label = owner >= 0 ? `${colourOf(owner).name} marble` : isTarget ? 'Empty hole, move here' : 'Empty hole';
            const active = mine || isTarget;
            return (
              <g
                key={i}
                class={`cc-cell${active ? ' is-active' : ''}${i === sel ? ' is-sel' : ''}`}
                role={active ? 'button' : undefined}
                tabIndex={active ? 0 : undefined}
                aria-label={active ? label : undefined}
                onClick={() => click(i)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), click(i))}
              >
                <circle cx={x} cy={y} r={S * 0.98} class="cc-hit" />
                <circle cx={x} cy={y} r={S * 0.42} class="cc-hole" />
                {owner >= 0 && <circle cx={x} cy={y} r={S * 0.78} class="cc-marble" style={{ fill: colourOf(owner).fill }} />}
                {isTarget && <circle cx={x} cy={y} r={S * 0.55} class="cc-target" />}
                {last && i === last.to && <circle cx={x} cy={y} r={S * 0.92} class="cc-last" />}
              </g>
            );
          })}
        </svg>
        {g.s.winner >= 0 && (
          <div class="overlay overlay-soft" role="dialog" aria-labelledby="cc-end">
            <div class="panel">
              <h2 id="cc-end">{m.local ? `${colourOf(g.s.winner).name} wins!` : g.s.winner === 0 ? 'You win!' : `${colourOf(g.s.winner).name} wins`}</h2>
              <p>
                {g.s.winner === 0 || m.local ? 'All marbles home' : 'The computer filled its target first'} after {g.s.moves} moves.
              </p>
              <div class="panel-actions">
                <button type="button" class="btn btn-primary" onClick={() => start()}>
                  Play again
                </button>
                {canUndo && (
                  <button type="button" class="btn" onClick={undo}>
                    Undo last move
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
      <noscript dangerouslySetInnerHTML={{ __html: '<p class="noscript">Chinese Checkers needs JavaScript to run. Please enable it to play.</p>' }} />
    </section>
  );
}
