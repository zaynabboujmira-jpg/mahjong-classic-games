import { useEffect, useState } from 'preact/hooks';
import { dayNumber } from '../../engines/core/day';
import { DAILY_GAMES, DAILY_NAMES, dailyLink, dailyStreak, emptyProgress, readProgress, type DailyGame, type Progress } from '../../engines/core/progress';

const BLURB: Record<DailyGame, string> = {
  'word-guess': "Today's five-letter word, the same for everyone.",
  sudoku: "Today's Medium Sudoku: one solution, pure logic.",
  klondike: "Today's Klondike deal, Draw 1.",
  mahjong: "Today's Turtle deal: every deal can be solved.",
};
/** Plain game pages, used until the browser knows today's date. */
const FALLBACK: Record<DailyGame, string> = {
  'word-guess': '/word-guess/',
  sudoku: '/sudoku/medium/',
  klondike: '/solitaire/klondike/',
  mahjong: '/mahjong/turtle/',
};

const untilMidnight = () => {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const m = Math.ceil((next.getTime() - now.getTime()) / 60000);
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

/**
 * Today's four daily challenges with completion marks, the daily streak and
 * a spoiler-free share summary. Everything is read from this browser only.
 */
export default function DailyHub() {
  const [day, setDay] = useState<number | null>(null);
  const [progress, setProgress] = useState<Progress>(emptyProgress());
  const [copied, setCopied] = useState('');

  useEffect(() => {
    const load = () => {
      setDay(dayNumber(new Date()));
      setProgress(readProgress());
    };
    load();
    // Coming back from a game (bfcache or tab switch) refreshes the marks.
    window.addEventListener('pageshow', load);
    document.addEventListener('visibilitychange', load);
    return () => {
      window.removeEventListener('pageshow', load);
      document.removeEventListener('visibilitychange', load);
    };
  }, []);

  const today = day !== null ? progress.daily[String(day)] ?? {} : {};
  const streak = day !== null ? dailyStreak(progress, day) : { current: 0, best: 0 };
  const done = DAILY_GAMES.filter((g) => today[g]?.won).length;

  const share = async () => {
    if (day === null) return;
    const lines = DAILY_GAMES.map((g) => {
      const r = today[g];
      const mark = r?.won ? '✅' : r ? '❌' : '⬜';
      return `${mark} ${DAILY_NAMES[g]}${g === 'word-guess' && r?.won && r.guesses ? ` ${r.guesses}/6` : ''}`;
    });
    const text = [`Free Play Classic daily #${day}`, ...lines, `\u{1F525} ${streak.current}-day streak`, `${location.origin}/daily/`].join('\n');
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setCopied('Summary copied. Paste it anywhere to share.');
      }
    } catch {
      /* share sheet closed */
    }
  };

  return (
    <div class="daily">
      <div class="daily-head">
        <p class="daily-day">{day === null ? 'Today' : `Daily #${day}`} · new challenges in {day === null ? '…' : untilMidnight()}</p>
        <dl class="daily-stats">
          <div>
            <dt>Done today</dt>
            <dd>{done}/4</dd>
          </div>
          <div>
            <dt>Streak</dt>
            <dd>{streak.current} {streak.current === 1 ? 'day' : 'days'}</dd>
          </div>
          <div>
            <dt>Best streak</dt>
            <dd>{streak.best}</dd>
          </div>
        </dl>
      </div>
      <ul class="daily-list">
        {DAILY_GAMES.map((g) => {
          const r = today[g];
          const state = r?.won ? 'done' : r ? 'missed' : 'open';
          return (
            <li key={g} class={`daily-item daily-${state}`}>
              <span class="daily-check" aria-hidden="true">
                {state === 'done' ? '✓' : state === 'missed' ? '✕' : ''}
              </span>
              <span class="daily-body">
                <span class="daily-name">{DAILY_NAMES[g]}</span>
                <span class="daily-blurb">
                  {state === 'done'
                    ? `Completed${g === 'word-guess' && r?.guesses ? ` in ${r.guesses} guesses` : ''}.`
                    : state === 'missed'
                      ? 'Not solved today. Try again tomorrow.'
                      : BLURB[g]}
                </span>
              </span>
              <a class={`btn${state === 'open' ? ' btn-primary' : ''}`} href={day === null ? FALLBACK[g] : dailyLink(g, day)}>
                {state === 'open' ? 'Play' : 'Open'}
                <span class="sr-only"> today's {DAILY_NAMES[g]}</span>
              </a>
            </li>
          );
        })}
      </ul>
      <div class="daily-share">
        <button type="button" class="btn" onClick={share} disabled={day === null}>
          Share today's summary
        </button>
        <span class="text-sm text-muted" aria-live="polite">
          {copied}
        </span>
      </div>
    </div>
  );
}
