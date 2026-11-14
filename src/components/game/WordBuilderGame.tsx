import { useEffect, useRef, useState } from 'preact/hooks';
import { readJson, writeJson } from '../../engines/core/storage';
import { recordWin } from '../../engines/core/progress';
import { dayNumber } from '../../engines/core/day';
import { randomSeed } from '../../engines/core/rng';
import { Synth } from '../../engines/arcade/audio';
import { WordBuilder, buildWheel, pickBase, unpack } from '../../engines/puzzles/wordbuilder';

type Kind = 'daily' | 'unlimited';
let dictionary: Promise<string[]> | null = null;
/** Loads the 4-6 letter ENABLE lists once (they are cached for offline play). */
const loadDictionary = () =>
  (dictionary ??= Promise.all([4, 5, 6].map((n) => fetch(`/words/${n}.txt`).then((r) => r.text()).then((t) => unpack(t, n)))).then((lists) => lists.flat()));

const MESSAGES = { short: 'Words need at least 4 letters.', letters: 'Use only the letters on the wheel.', unknown: 'Not in the word list.', repeat: 'Already found.' };

export default function WordBuilderGame() {
  const game = useRef<WordBuilder | null>(null);
  const synth = useRef(new Synth());
  const [, setTick] = useState(0);
  const [kind, setKind] = useState<Kind>('daily');
  const [word, setWord] = useState<number[]>([]);
  const [message, setMessage] = useState('Loading the word list…');
  const [flash, setFlash] = useState<'good' | 'bad' | ''>('');
  const [announce, setAnnounce] = useState('');
  const [revealed, setRevealed] = useState(false);
  const dragging = useRef(false);
  const wheelRef = useRef<HTMLDivElement>(null);
  const refresh = () => setTick((n) => n + 1);
  const saveKey = (k: Kind, base: string) => `wheel:${k}:${base}`;

  const start = async (k: Kind = kind) => {
    const dict = await loadDictionary();
    const seed = k === 'daily' ? `daily${dayNumber(new Date())}` : randomSeed();
    const base = pickBase(seed);
    const g = new WordBuilder(buildWheel(base, dict, seed));
    // The daily wheel keeps your words for the day.
    if (k === 'daily') for (const w of readJson<string[]>(saveKey(k, base), [])) g.submit(w);
    game.current = g;
    setKind(k);
    setWord([]);
    setRevealed(false);
    writeJson('wheel:kind', k);
    setMessage(`${g.puzzle.answers.length} words to find. Make words of 4 or more letters.`);
    setAnnounce(`${k === 'daily' ? 'Daily wheel' : 'New wheel'}: letters ${g.puzzle.letters.join(' ').toUpperCase()}.`);
    refresh();
  };

  const current = () => word.map((i) => game.current!.puzzle.letters[i]).join('');

  const submit = () => {
    const g = game.current;
    if (!g || !word.length) return;
    const w = current();
    const r = g.submit(w);
    if (r.result === 'ok') {
      const bonus = w === g.puzzle.base;
      setMessage(bonus ? `${w.toUpperCase()}: the wheel word! +${r.points}` : `${w.toUpperCase()} +${r.points}`);
      setFlash('good');
      synth.current.tone(bonus ? 880 : 660, bonus ? 260 : 90, 'triangle', 0.1);
      if (kind === 'daily') writeJson(saveKey(kind, g.puzzle.base), g.found);
      if (g.rank === 'Genius' && !readJson<boolean>(`wheel:genius:${g.puzzle.base}`, false)) {
        writeJson(`wheel:genius:${g.puzzle.base}`, true);
        recordWin('word-builder');
      }
      const best = readJson<number>('wheel:best', 0);
      if (g.score > best) writeJson('wheel:best', g.score);
      setAnnounce(`${w}, ${r.points} points. Score ${g.score}, rank ${g.rank}.`);
    } else {
      setMessage(MESSAGES[r.result]);
      setFlash('bad');
      synth.current.tone(160, 120, 'sawtooth', 0.06);
      setAnnounce(MESSAGES[r.result]);
    }
    window.setTimeout(() => setFlash(''), 450);
    setWord([]);
    refresh();
  };

  const addLetter = (i: number) => setWord((w) => (w.includes(i) ? w : [...w, i]));

  useEffect(() => {
    start(readJson<Kind>('wheel:kind', 'daily') === 'unlimited' ? 'unlimited' : 'daily');
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const g = game.current;
      const t = e.target as HTMLElement;
      if (!g || e.ctrlKey || e.metaKey || e.altKey || t?.tagName === 'INPUT') return;
      if (e.key === 'Enter') {
        if (t?.tagName === 'BUTTON') return;
        e.preventDefault();
        submit();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setWord((w) => w.slice(0, -1));
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        const ch = e.key.toLowerCase();
        const idx = g.puzzle.letters.findIndex((l, i) => l === ch && !word.includes(i));
        if (idx >= 0) setWord([...word, idx]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Drag across the letters to spell a word; release to submit.
  const letterAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const i = el?.closest<HTMLElement>('[data-i]')?.dataset.i;
    return i === undefined ? -1 : Number(i);
  };
  const onPointerDown = (e: PointerEvent) => {
    const i = letterAt(e.clientX, e.clientY);
    if (i < 0) return;
    e.preventDefault();
    dragging.current = true;
    try {
      wheelRef.current!.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic pointer */
    }
    if (!word.length || e.pointerType !== 'mouse') addLetter(i);
    else addLetter(i);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging.current) return;
    const i = letterAt(e.clientX, e.clientY);
    if (i >= 0) addLetter(i);
  };
  const onPointerUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (word.length >= 2) submit();
  };

  const g = game.current;
  const letters = g?.puzzle.letters ?? [];
  const next = g?.nextRank;
  const pct = g ? Math.min(100, (g.score / g.puzzle.total) * 100) : 0;

  return (
    <section class="game" aria-label="Word Builder">
      <div class="toolbar" role="toolbar" aria-label="Game controls">
        <div class="segmented" role="radiogroup" aria-label="Puzzle">
          <button type="button" role="radio" class="seg" aria-checked={kind === 'daily'} onClick={() => start('daily')}>
            Daily
          </button>
          <button type="button" role="radio" class="seg" aria-checked={kind === 'unlimited'} onClick={() => start('unlimited')}>
            {kind === 'unlimited' ? 'New' : 'Unlimited'}
          </button>
        </div>
        <button
          type="button"
          class="btn"
          disabled={!g}
          onClick={() => {
            g?.shuffle();
            setWord([]);
            refresh();
          }}
        >
          Shuffle
        </button>
        <button type="button" class="btn" disabled={!g} onClick={() => setRevealed(true)}>
          Give up
        </button>
        <dl class="stats">
          <div>
            <dt>Score</dt>
            <dd class="tabular-nums">{g?.score ?? 0}</dd>
          </div>
          <div>
            <dt>Rank</dt>
            <dd>{g?.rank ?? '–'}</dd>
          </div>
        </dl>
      </div>
      <div class="arcade-area wb-area">
        <div class="wb-progress" aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </div>
        <p class="arcade-message" aria-hidden="true">
          {next ? `${message} · ${next.points} to ${next.name}` : message}
        </p>
        <p class={`wb-word${flash ? ` is-${flash}` : ''}`} aria-live="off">
          {current().toUpperCase() || ' '}
        </p>
        <div class="sq-fit wb-fit">
          <div
            ref={wheelRef}
            class="wb-wheel"
            role="group"
            aria-label={`Letter wheel: ${letters.join(' ').toUpperCase()}. Type letters and press Enter, or tap letters.`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => (dragging.current = false)}
          >
            {letters.map((l, i) => {
              const a = (i / letters.length) * Math.PI * 2 - Math.PI / 2;
              return (
                <button
                  key={i}
                  type="button"
                  data-i={i}
                  class={`wb-letter${word.includes(i) ? ' is-used' : ''}`}
                  style={{ left: `${50 + Math.cos(a) * 36}%`, top: `${50 + Math.sin(a) * 36}%` }}
                  aria-label={l.toUpperCase()}
                  onClick={() => addLetter(i)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLetter(i))}
                >
                  {l.toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>
        <div class="wb-actions">
          <button type="button" class="btn" onClick={() => setWord((w) => w.slice(0, -1))} disabled={!word.length}>
            Delete
          </button>
          <button type="button" class="btn btn-primary" onClick={submit} disabled={word.length < 4}>
            Enter
          </button>
        </div>
        <details class="wb-found">
          <summary>
            {g?.found.length ?? 0} of {g?.puzzle.answers.length ?? 0} words found
          </summary>
          <ul>
            {(revealed ? g?.puzzle.answers ?? [] : [...(g?.found ?? [])].sort()).map((w) => (
              <li key={w} class={g?.found.includes(w) ? 'is-found' : ''}>
                {w}
              </li>
            ))}
          </ul>
        </details>
      </div>
      <p class="sr-only" aria-live="polite">
        {announce}
      </p>
      <noscript dangerouslySetInnerHTML={{ __html: '<p class="noscript">Word Builder needs JavaScript to run. Please enable it to play.</p>' }} />
    </section>
  );
}
