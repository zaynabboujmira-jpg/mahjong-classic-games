import { useEffect, useState } from 'preact/hooks';
import { CATALOG } from '../../data/catalog';
import { dayNumber } from '../../engines/core/day';
import { memoryKV, resetAll } from '../../engines/core/progress';
import { summarize, type Summary } from '../../engines/core/stats';

const NAMES = Object.fromEntries(CATALOG.map((g) => [g.id, { name: g.name, href: g.play }]));

/**
 * The player's stats across all 16 games and the achievements, read from
 * this browser only. Server-rendered as an empty profile (every achievement
 * listed, all locked) and filled in on load.
 */
export default function StatsBoard() {
  const [s, setS] = useState<Summary>(() => summarize(memoryKV(), 1));
  const [loaded, setLoaded] = useState(false);

  const load = () => {
    setS(summarize(undefined, dayNumber(new Date())));
    setLoaded(true);
  };
  useEffect(load, []);

  const reset = () => {
    if (!window.confirm('Delete all saved scores, streaks, settings and unfinished games on this device? This cannot be undone.')) return;
    resetAll();
    load();
  };

  const unlocked = s.achievements.filter((a) => a.unlocked).length;
  return (
    <div class="stats-board">
      <dl class="stats-totals">
        <div>
          <dd>{loaded ? s.gamesPlayed : '–'}</dd>
          <dt>Games played (of 16)</dt>
        </div>
        <div>
          <dd>{loaded ? s.totalWins : '–'}</dd>
          <dt>Wins</dt>
        </div>
        <div>
          <dd>{loaded ? s.streak.current : '–'}</dd>
          <dt>Daily streak</dt>
        </div>
        <div>
          <dd>{loaded ? `${unlocked}/${s.achievements.length}` : '–'}</dd>
          <dt>Achievements</dt>
        </div>
      </dl>

      <h2 class="stats-h2">Achievements</h2>
      <ul class="achievements">
        {s.achievements.map((a) => (
          <li key={a.id} class={a.unlocked ? 'ach ach-on' : 'ach'}>
            <span class="ach-medal" aria-hidden="true">
              {a.unlocked ? '★' : '☆'}
            </span>
            <span>
              <strong>{a.name}</strong>
              <span class="ach-desc">{a.description}</span>
              <span class="sr-only">{a.unlocked ? ' Unlocked.' : ' Locked.'}</span>
            </span>
          </li>
        ))}
      </ul>

      <h2 class="stats-h2">Your games</h2>
      <div class="compare-wrap">
        <table class="compare-table">
          <caption class="sr-only">Results for each game on this device</caption>
          <thead>
            <tr>
              <th scope="col">Game</th>
              <th scope="col">Wins</th>
              <th scope="col">Best</th>
            </tr>
          </thead>
          <tbody>
            {s.games.map((g) => (
              <tr key={g.id}>
                <th scope="row">
                  <a href={NAMES[g.id]!.href}>{NAMES[g.id]!.name}</a>
                </th>
                <td>{g.played ? g.wins : 'Not played yet'}</td>
                <td>{g.best ?? '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div class="stats-reset">
        <button type="button" class="btn" onClick={reset} disabled={!loaded}>
          Reset all stats
        </button>
        <p class="text-sm text-muted">Clears every score, streak, setting and unfinished game saved by Free Play Classic on this device.</p>
      </div>
    </div>
  );
}
