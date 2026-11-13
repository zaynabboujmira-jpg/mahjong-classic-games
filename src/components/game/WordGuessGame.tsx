import { useEffect, useRef, useState } from 'preact/hooks';
import { readJson, writeJson } from '../../engines/core/storage';
import { LENGTHS, MAX_GUESSES, WordGame, dailyAnswer, dayNumber, emptyStats, parseDictionary, randomAnswer, recordResult, type Mark, type Stats, type WordLength } from '../../engines/word/game';
import { MARK_COLORS, WordBoardRenderer } from '../../engines/word/render';

interface Props {
  defaultLength: WordLength;
}

type Mode = 'daily' | 'unlimited';
const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const MARK_WORDS: Record<Mark, string> = { hit: 'right spot', near: 'wrong spot', miss: 'not in the word' };
const dictionaries = new Map<WordLength, Promise<Set<string>>>();

function loadDictionary(length: WordLength): Promise<Set<string>> {
  let p = dictionaries.get(length);
  if (!p) {
    p = fetch(`/words/${length}.txt`)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((t) => parseDictionary(t, length));
    p.catch(() => dictionaries.delete(length));
    dictionaries.set(length, p);
  }
  return p;
}

const statsKey = (mode: Mode, length: WordLength) => `word:stats:${mode}:${length}`;
const saveKey = (mode: Mode, length: WordLength) => `word:${mode}:${length}`;

const untilMidnight = () => {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const m = Math.ceil((next.getTime() - now.getTime()) / 60000);
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

export default function WordGuessGame({ defaultLength }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<WordBoardRenderer | null>(null);
  const game = useRef<WordGame | null>(null);
  const dict = useRef<Set<string> | null>(null);
  const shake = useRef({ row: -1, start: 0 });
  const recent = useRef<string[]>([]);

  const [mode, setMode] = useState<Mode>('daily');
  const [length, setLength] = useState<WordLength>(defaultLength);
  const [, setCurrentState] = useState('');
  // The word being typed lives in a ref too, so keys pressed faster than a re-render are never lost.
  const typed = useRef('');
  const setCurrent = (v: string) => {
    typed.current = v;
    setCurrentState(v);
  };
  const [message, setMessage] = useState('');
  const [announce, setAnnounce] = useState('');
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState<Stats>(emptyStats());
  const [, setVersion] = useState(0);
  const day = dayNumber(new Date());

  const paint = (cur = typed.current) => {
    const r = renderer.current;
    const g = game.current;
    const box = boxRef.current;
    if (!r || !g || !box) return;
    r.fit(box.clientWidth - 8, box.clientHeight - 8, g.length, Math.min(window.devicePixelRatio || 1, 3));
    const t = performance.now() - shake.current.start;
    const s = shake.current.row >= 0 && t < 400 ? Math.sin(t / 25) * 8 * (1 - t / 400) : 0;
    r.draw({ length: g.length, guesses: g.guesses, marks: g.marks, current: cur, shakeRow: s ? shake.current.row : -1, shake: s });
  };

  const save = () => {
    const g = game.current;
    if (!g) return;
    writeJson(saveKey(mode, length), { ...g.serialize(), day: mode === 'daily' ? day : 0 });
  };

  const start = (m: Mode, len: WordLength, fresh = false) => {
    const saved = readJson<{ answer: string; guesses: string[]; day: number } | null>(saveKey(m, len), null);
    let g: WordGame;
    if (m === 'daily') {
      const answer = dailyAnswer(len, day);
      g = saved && saved.day === day && saved.answer === answer ? WordGame.restore(len, saved) : new WordGame(len, answer);
    } else if (saved && !fresh && saved.answer.length === len && !WordGame.restore(len, saved).over) {
      g = WordGame.restore(len, saved);
    } else {
      const answer = randomAnswer(len, Math.random, recent.current);
      recent.current = [answer, ...recent.current].slice(0, 30);
      g = new WordGame(len, answer);
    }
    game.current = g;
    setMode(m);
    setLength(len);
    setCurrent('');
    setMessage('');
    setStats(readJson<Stats>(statsKey(m, len), emptyStats()));
    setShowStats(g.over);
    writeJson('word:settings', { mode: m, length: len });
    writeJson(saveKey(m, len), { ...g.serialize(), day: m === 'daily' ? day : 0 });
    dict.current = null;
    void loadDictionary(len)
      .then((d) => {
        if (game.current === g) dict.current = d;
      })
      .catch(() => setMessage('Could not load the word list. Check your connection and reload.'));
    setVersion((v) => v + 1);
    requestAnimationFrame(() => paint(''));
  };

  const flash = (text: string) => {
    setMessage(text);
    setAnnounce(text);
  };

  const finish = (g: WordGame) => {
    const s = recordResult(readJson<Stats>(statsKey(mode, length), emptyStats()), g.won, g.guesses.length, mode === 'daily' ? day : 0);
    writeJson(statsKey(mode, length), s);
    setStats(s);
    const text = g.won ? `Solved in ${g.guesses.length} of ${MAX_GUESSES}!` : `The word was ${g.answer.toUpperCase()}.`;
    flash(text);
    window.setTimeout(() => setShowStats(true), 900);
  };

  const submit = () => {
    const g = game.current;
    if (!g || g.over) return;
    const current = typed.current;
    if (current.length !== g.length) {
      flash(`Type a ${g.length}-letter word.`);
      shakeRow();
      return;
    }
    if (!dict.current) {
      flash('Loading the word list…');
      return;
    }
    const d = dict.current;
    const res = g.submit(current, (w) => d.has(w));
    if (!res.ok) {
      flash(res.reason === 'unknown' ? `${current.toUpperCase()} is not in the word list.` : 'Try again.');
      shakeRow();
      return;
    }
    const spoken = [...current].map((ch, i) => `${ch.toUpperCase()} ${MARK_WORDS[res.marks[i]!]}`).join(', ');
    setAnnounce(`Guess ${g.guesses.length}: ${spoken}.`);
    setMessage('');
    setCurrent('');
    save();
    if (g.over) finish(g);
    setVersion((v) => v + 1);
    paint('');
  };

  const shakeRow = () => {
    shake.current = { row: game.current!.guesses.length, start: performance.now() };
    const tick = () => {
      paint();
      if (performance.now() - shake.current.start < 400) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const press = (key: string) => {
    const g = game.current;
    if (!g || g.over) return;
    const current = typed.current;
    if (key === 'enter') submit();
    else if (key === 'back') {
      const next = current.slice(0, -1);
      setCurrent(next);
      paint(next);
    } else if (/^[a-z]$/.test(key) && current.length < g.length) {
      const next = current + key;
      setCurrent(next);
      setMessage('');
      paint(next);
    }
  };

  const share = async () => {
    const g = game.current!;
    const title = mode === 'daily' ? `Word Guess #${day} (${length} letters)` : `Word Guess (${length} letters)`;
    const text = `${g.shareText(title)}\n${location.origin}${location.pathname}`;
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        flash('Result copied. Paste it anywhere to share.');
      }
    } catch {
      /* share sheet closed */
    }
  };

  useEffect(() => {
    renderer.current = new WordBoardRenderer(canvasRef.current!);
    const s = readJson<{ mode?: Mode; length?: WordLength }>('word:settings', {});
    const params = new URLSearchParams(location.search);
    const m: Mode = params.get('mode') === 'unlimited' ? 'unlimited' : s.mode === 'unlimited' ? 'unlimited' : 'daily';
    start(m, defaultLength);
    const ro = new ResizeObserver(() => paint());
    ro.observe(boxRef.current!);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.key === 'Enter') {
        if (t && t.tagName === 'BUTTON' && !t.dataset['key']) return;
        e.preventDefault();
        press('enter');
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        press('back');
      } else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toLowerCase());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const g = game.current;
  const letters = g?.letterMarks() ?? new Map<string, Mark>();
  const maxDist = Math.max(1, ...stats.dist);

  return (
    <section class="game" aria-label="Word Guess">
      <div class="toolbar" role="toolbar" aria-label="Game controls">
        <div class="segmented" role="radiogroup" aria-label="Mode">
          {(['daily', 'unlimited'] as Mode[]).map((m) => (
            <button key={m} type="button" role="radio" class="seg" aria-checked={mode === m} onClick={() => start(m, length)}>
              {m === 'daily' ? 'Daily' : 'Unlimited'}
            </button>
          ))}
        </div>
        <div class="segmented" role="radiogroup" aria-label="Word length">
          {LENGTHS.map((n) => (
            <button key={n} type="button" role="radio" class="seg" aria-checked={length === n} onClick={() => start(mode, n)}>
              {n} letters
            </button>
          ))}
        </div>
        {mode === 'unlimited' && (
          <button type="button" class="btn" onClick={() => start('unlimited', length, true)}>
            New word
          </button>
        )}
        <button type="button" class="btn" onClick={() => setShowStats(true)}>
          Stats
        </button>
      </div>

      <div class="word-area">
        <p class="word-message" aria-hidden="true">
          {message || (mode === 'daily' ? `Daily word #${day} · ${length} letters` : `Unlimited · ${length} letters`)}
        </p>
        <div ref={boxRef} class="word-board">
          <canvas ref={canvasRef} role="img" aria-label={`Guess grid, ${g?.guesses.length ?? 0} of ${MAX_GUESSES} guesses used`} />
        </div>
        <div class="word-keys" role="group" aria-label="Keyboard">
          {ROWS.map((row, i) => (
            <div key={row} class="word-row">
              {i === 2 && (
                <button type="button" class="word-key word-key-wide" data-key="enter" onClick={() => press('enter')}>
                  Enter
                </button>
              )}
              {[...row].map((ch) => {
                const m = letters.get(ch);
                return (
                  <button
                    key={ch}
                    type="button"
                    class="word-key"
                    data-key={ch}
                    style={m ? { background: MARK_COLORS[m], color: '#fff', borderColor: MARK_COLORS[m] } : undefined}
                    aria-label={m ? `${ch.toUpperCase()}, ${MARK_WORDS[m]}` : ch.toUpperCase()}
                    onClick={() => press(ch)}
                  >
                    {ch.toUpperCase()}
                  </button>
                );
              })}
              {i === 2 && (
                <button type="button" class="word-key word-key-wide" data-key="back" aria-label="Delete letter" onClick={() => press('back')}>
                  ⌫
                </button>
              )}
            </div>
          ))}
        </div>

        {showStats && (
          <div class="overlay" role="dialog" aria-labelledby="word-stats-title">
            <div class="panel">
              <h2 id="word-stats-title">{g?.over ? (g.won ? 'Well done!' : `The word was ${g.answer.toUpperCase()}`) : 'Your stats'}</h2>
              <p class="text-sm">
                {mode === 'daily' ? 'Daily' : 'Unlimited'} · {length} letters
              </p>
              <dl class="word-stats">
                <div>
                  <dd>{stats.played}</dd>
                  <dt>Played</dt>
                </div>
                <div>
                  <dd>{stats.played ? Math.round((stats.wins / stats.played) * 100) : 0}%</dd>
                  <dt>Won</dt>
                </div>
                <div>
                  <dd>{stats.streak}</dd>
                  <dt>Streak</dt>
                </div>
                <div>
                  <dd>{stats.best}</dd>
                  <dt>Best streak</dt>
                </div>
              </dl>
              <ol class="word-dist" aria-label="Wins by number of guesses">
                {stats.dist.map((n, i) => (
                  <li key={i}>
                    <span>{i + 1}</span>
                    <span class="word-bar" style={{ width: `${Math.max(8, (n / maxDist) * 100)}%` }}>
                      {n}
                    </span>
                  </li>
                ))}
              </ol>
              {g?.over && mode === 'daily' && <p class="text-sm">Next daily word in {untilMidnight()}.</p>}
              <div class="panel-actions">
                {g?.over && (
                  <button type="button" class="btn btn-primary" onClick={share}>
                    Share result
                  </button>
                )}
                {g?.over && (
                  <button type="button" class="btn" onClick={() => start('unlimited', length, true)}>
                    {mode === 'daily' ? 'Play unlimited' : 'Next word'}
                  </button>
                )}
                <button type="button" class="btn" onClick={() => setShowStats(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <p class="sr-only" aria-live="polite">
        {announce}
      </p>
      <noscript dangerouslySetInnerHTML={{ __html: '<p class="noscript">Word Guess needs JavaScript to run. Please enable it to play.</p>' }} />
    </section>
  );
}
