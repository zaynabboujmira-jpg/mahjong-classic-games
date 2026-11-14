import { useEffect, useRef, useState } from 'preact/hooks';
import { readJson, writeJson } from '../../engines/core/storage';
import { recordWin } from '../../engines/core/progress';
import { Synth } from '../../engines/arcade/audio';
import { Pyramid, pIndex, type PyramidMode, type Source } from '../../engines/solitaire/pyramid';
import { cardLabel } from '../../engines/solitaire/cards';
import { PlayingCard } from './PlayingCard';

const newSeed = () => String(1 + Math.floor(Math.random() * 999999));
const validSeed = (s: string | null) => !!s && /^[a-z0-9]{1,24}$/i.test(s);
const same = (a: Source | null, b: Source) => !!a && a.kind === b.kind && (a.kind !== 'pyramid' || (b.kind === 'pyramid' && a.index === b.index));

export default function PyramidGame() {
  const game = useRef(new Pyramid('preview'));
  const synth = useRef(new Synth());
  const [, setTick] = useState(0);
  const [mode, setMode] = useState<PyramidMode>('classic');
  const [sel, setSel] = useState<Source | null>(null);
  const [hint, setHint] = useState<Source[]>([]);
  const [best, setBest] = useState(0);
  const [announce, setAnnounce] = useState('');
  const recorded = useRef(false);
  const refresh = () => setTick((n) => n + 1);

  const start = (m: PyramidMode = mode, seed = newSeed()) => {
    game.current = new Pyramid(seed, m);
    recorded.current = false;
    setMode(m);
    setSel(null);
    setHint([]);
    setBest(readJson<number>(`pyramid:best:${m}`, 0));
    writeJson('pyramid:mode', m);
    const url = new URL(location.href);
    url.searchParams.set('seed', seed);
    history.replaceState(null, '', url);
    setAnnounce(`New deal ${seed}. Pair exposed cards that add up to 13; kings go alone.`);
    refresh();
  };

  const after = () => {
    const g = game.current;
    if (g.score > readJson<number>(`pyramid:best:${g.mode}`, 0)) {
      writeJson(`pyramid:best:${g.mode}`, g.score);
      setBest(g.score);
    }
    if (g.won && !recorded.current) {
      recorded.current = true;
      recordWin('pyramid', g.seed);
      synth.current.tone(784, 300, 'triangle', 0.14);
      setAnnounce(`Pyramid cleared! Score ${g.score}.`);
    } else if (g.stuck) setAnnounce('No more moves. Undo, or start a new deal.');
    refresh();
  };

  const pick = (s: Source) => {
    const g = game.current;
    const c = g.cardAt(s);
    if (!c) return;
    setHint([]);
    if (c.rank === 13) {
      g.remove(s);
      setSel(null);
      synth.current.tone(660, 70, 'triangle', 0.08);
      setAnnounce(`${cardLabel(c)} removed.`);
      after();
      return;
    }
    if (sel && !same(sel, s)) {
      const other = g.cardAt(sel)!;
      if (g.remove(sel, s)) {
        synth.current.tone(660, 70, 'triangle', 0.08);
        setAnnounce(`${cardLabel(other)} and ${cardLabel(c)} removed.`);
        setSel(null);
        after();
        return;
      }
      setAnnounce(`${cardLabel(other)} and ${cardLabel(c)} make ${other.rank + c.rank}, not 13.`);
    }
    setSel(same(sel, s) ? null : s);
  };

  const draw = () => {
    const g = game.current;
    if (g.draw()) {
      setSel(null);
      setHint([]);
      const w = g.cardAt({ kind: 'waste' });
      setAnnounce(w ? `Turned up ${cardLabel(w)}.` : 'Stock turned over.');
      after();
    }
  };

  useEffect(() => {
    const q = new URLSearchParams(location.search).get('seed');
    const m = readJson<PyramidMode>('pyramid:mode', 'classic');
    start(m === 'relaxed' ? 'relaxed' : 'classic', validSeed(q) ? q! : newSeed());
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t?.tagName === 'INPUT' || e.ctrlKey || e.metaKey) return;
      if (e.key === 'd' || e.key === ' ') {
        if (t?.tagName === 'BUTTON') return;
        e.preventDefault();
        draw();
      } else if (e.key === 'z') {
        game.current.undo();
        refresh();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const g = game.current;
  const waste = g.cardAt({ kind: 'waste' });
  const isHint = (s: Source) => hint.some((h) => same(h, s));

  return (
    <section class="game" aria-label="Pyramid Solitaire">
      <div class="toolbar" role="toolbar" aria-label="Game controls">
        <button type="button" class="btn btn-primary" onClick={() => start()}>
          New deal
        </button>
        <button
          type="button"
          class="btn"
          disabled={!g.canUndo}
          onClick={() => {
            g.undo();
            setSel(null);
            refresh();
          }}
        >
          Undo
        </button>
        <button type="button" class="btn" onClick={() => setHint(g.hint() ?? [])} disabled={g.won}>
          Hint
        </button>
        <div class="segmented" role="radiogroup" aria-label="Rules">
          {(['classic', 'relaxed'] as const).map((m) => (
            <button key={m} type="button" role="radio" class="seg" aria-checked={mode === m} onClick={() => start(m)}>
              {m === 'classic' ? '3 passes' : 'Unlimited'}
            </button>
          ))}
        </div>
        <dl class="stats">
          <div>
            <dt>Score</dt>
            <dd class="tabular-nums">{g.score}</dd>
          </div>
          <div>
            <dt>Best</dt>
            <dd class="tabular-nums">{Math.max(best, g.score)}</dd>
          </div>
        </dl>
      </div>
      <div class="board-area board-area-top pyr-area">
        <div class="pyr-fit">
          <div class="pyr" role="group" aria-label="Pyramid">
            {Array.from({ length: 7 }, (_, r) => (
              <div key={r} class="pyr-row" style={{ '--r': r }}>
                {Array.from({ length: r + 1 }, (_, i) => {
                  const idx = pIndex(r, i);
                  const c = g.pyramid[idx];
                  if (!c) return <span key={idx} class="pc-slot is-empty" />;
                  const src: Source = { kind: 'pyramid', index: idx };
                  const open = g.isExposed(idx);
                  return (
                    <button
                      key={idx}
                      type="button"
                      class={`pc-btn${open ? '' : ' is-covered'}${same(sel, src) ? ' is-sel' : ''}${isHint(src) ? ' is-hint' : ''}`}
                      aria-label={`${cardLabel(c)}${open ? '' : ', covered'}`}
                      aria-disabled={!open}
                      onClick={() => open && pick(src)}
                    >
                      <PlayingCard card={c} />
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div class="pyr-piles">
            <button type="button" class="pc-btn" onClick={draw} aria-label={g.stock.length ? `Stock, ${g.stock.length} cards: turn one over` : g.canRecycle ? 'Turn the waste over' : 'Stock empty'}>
              {g.stock.length ? <PlayingCard card={null} /> : <span class="pc-slot">{g.canRecycle ? '↻' : '×'}</span>}
            </button>
            <button
              type="button"
              class={`pc-btn${same(sel, { kind: 'waste' }) ? ' is-sel' : ''}${isHint({ kind: 'waste' }) ? ' is-hint' : ''}`}
              aria-label={waste ? `Waste: ${cardLabel(waste)}` : 'Waste, empty'}
              onClick={() => waste && pick({ kind: 'waste' })}
            >
              {waste ? <PlayingCard card={waste} /> : <span class="pc-slot" />}
            </button>
            <p class="pyr-info">
              Stock {g.stock.length}
              <br />
              {g.passesLeft === Infinity ? 'Unlimited passes' : `${g.passesLeft} ${g.passesLeft === 1 ? 'pass' : 'passes'} left`}
              <br />
              {g.cleared}/28 cleared
            </p>
          </div>
        </div>
        {(g.won || g.stuck) && (
          <div class="overlay overlay-soft" role="dialog" aria-labelledby="pyr-end">
            <div class="panel">
              <h2 id="pyr-end">{g.won ? 'Pyramid cleared!' : 'No more moves'}</h2>
              <p>
                Score <strong>{g.score}</strong> · {g.cleared} of 28 pyramid cards cleared
              </p>
              <div class="panel-actions">
                {!g.won && (
                  <button
                    type="button"
                    class="btn"
                    onClick={() => {
                      g.undo();
                      refresh();
                    }}
                  >
                    Undo
                  </button>
                )}
                <button type="button" class="btn btn-primary" onClick={() => start()}>
                  New deal
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <p class="sr-only" aria-live="polite">
        {announce}
      </p>
      <noscript dangerouslySetInnerHTML={{ __html: '<p class="noscript">Pyramid Solitaire needs JavaScript to run. Please enable it to play.</p>' }} />
    </section>
  );
}
