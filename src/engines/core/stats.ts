import { DAILY_GAMES, browserKV, dailyStreak, readProgress, type KV } from './progress';

/*
 * Reads what every game has saved (best times, scores, word stats, wins)
 * into one summary for the /stats/ page, and works out the achievements.
 * Key names are the ones the games write; see each game's island.
 */
const LAYOUTS = ['turtle', 'dragon', 'pyramid', 'fortress', 'butterfly', 'fish'];
const ARCADE_SHELL = ['maze-chomper', 'alien-invaders', 'space-rocks', 'river-hopper', 'flappy-wing', 'ocean-grow', 'snake', 'brick-breaker'];

export interface GameStat {
  id: string;
  /** Has the game left any trace (a result, best or saved session)? */
  played: boolean;
  /** Wins counted since win tracking started (finished puzzles, cleared boards). */
  wins: number;
  /** Best result, already formatted ("2:41", "12,400 points"). */
  best: string | null;
}

export interface Summary {
  games: GameStat[];
  totalWins: number;
  gamesPlayed: number;
  streak: { current: number; best: number };
  dailyDays: number;
  achievements: Achievement[];
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
}

const time = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const minOf = (vals: (number | null)[]) => {
  const xs = vals.filter((v): v is number => typeof v === 'number' && v > 0);
  return xs.length ? Math.min(...xs) : null;
};
const maxOf = (vals: (number | null)[]) => {
  const xs = vals.filter((v): v is number => typeof v === 'number');
  return xs.length ? Math.max(...xs) : null;
};

interface WordStats {
  played: number;
  wins: number;
  best: number;
  dist: number[];
}

export function summarize(kv: KV = browserKV, today: number): Summary {
  const keys = kv.keys();
  const num = (k: string) => kv.get<number | null>(k, null);
  const withPrefix = (prefix: string) => keys.filter((k) => k.startsWith(prefix));
  const progress = readProgress(kv);
  const wins = (id: string) => progress.wins[id] ?? 0;

  const layoutBest = LAYOUTS.map((l) => num(`mahjong:best:${l}`));
  const cardBest = (id: string) => minOf(withPrefix(`${id}:best:`).map(num));
  const sudokuBest = (d: string) => num(`sudoku:best:${d}`);
  const minesBest = (l: string) => num(`mines:best:${l}`);
  const word = withPrefix('word:stats:').map((k) => kv.get<WordStats | null>(k, null)).filter((s): s is WordStats => !!s);
  const tableSessions = withPrefix('table:').map((k) => kv.get<{ hands?: number } | null>(k, null));
  const memoryBest = maxOf(withPrefix('memory:best:').map(num));
  const paddleWins = withPrefix('paddle:wins:').reduce((n, k) => n + (num(k) ?? 0), 0);

  const games: GameStat[] = [];
  const add = (id: string, played: boolean, best: string | null, extraWins = 0) => games.push({ id, played: played || wins(id) > 0, wins: wins(id) + extraWins, best });

  const layoutsDone = layoutBest.filter((v) => v !== null).length;
  const bestLayout = minOf(layoutBest);
  add('mahjong-solitaire', layoutsDone > 0 || keys.includes('mahjong:settings'), bestLayout ? `${time(bestLayout)} (${layoutsDone}/6 layouts)` : null);
  const hands = tableSessions.reduce((n, s) => n + (s?.hands ?? 0), 0);
  add('mahjong-4p', hands > 0, hands ? `${hands} hand${hands > 1 ? 's' : ''} played` : null);
  for (const id of ['klondike', 'spider', 'freecell']) {
    const b = cardBest(id);
    add(id, b !== null || keys.includes(`${id}:settings`), b ? time(b) : null);
  }
  const sudokuDone = ['easy', 'medium', 'hard', 'expert'].filter((d) => sudokuBest(d) !== null);
  add('sudoku', sudokuDone.length > 0 || keys.some((k) => k.startsWith('sudoku:')), sudokuDone.length ? `${time(minOf(sudokuDone.map(sudokuBest))!)} (${sudokuDone.join(', ')})` : null);
  const minesDone = ['beginner', 'intermediate', 'expert'].filter((l) => minesBest(l) !== null);
  add('minesweeper', minesDone.length > 0 || keys.includes('mines:settings'), minesDone.length ? `${time(minOf(minesDone.map(minesBest))!)} (${minesDone.join(', ')})` : null);
  const wordPlayed = word.reduce((n, s) => n + s.played, 0);
  const wordWins = word.reduce((n, s) => n + s.wins, 0);
  const wordStreak = maxOf(word.map((s) => s.best));
  games.push({ id: 'word-guess', played: wordPlayed > 0, wins: wordWins, best: wordPlayed ? `${wordWins}/${wordPlayed} solved, best streak ${wordStreak ?? 0}` : null });
  for (const id of ARCADE_SHELL) {
    const b = num(`${id}:best`);
    add(id, b !== null, b ? `${b.toLocaleString('en-US')} points` : null);
  }
  add('color-memory', memoryBest !== null, memoryBest ? `${memoryBest} rounds` : null);
  add('paddle-ball', paddleWins > 0 || keys.includes('paddle:settings'), paddleWins ? `${paddleWins} win${paddleWins > 1 ? 's' : ''}` : null, paddleWins);
  const mergeBest = maxOf(withPrefix('merge:best:').map(num));
  add('number-merge', mergeBest !== null, mergeBest ? `${mergeBest.toLocaleString('en-US')} points` : null);
  const matchBest = withPrefix('match:best:')
    .map((k) => kv.get<{ moves: number; ms: number } | null>(k, null))
    .filter((v): v is { moves: number; ms: number } => !!v)
    .sort((a, b) => a.moves - b.moves || a.ms - b.ms)[0];
  add('memory-match', !!matchBest, matchBest ? `${matchBest.moves} moves, ${time(matchBest.ms)}` : null);
  const nonoDone = ['5', '10', '15'].filter((n) => num(`nonogram:best:${n}`) !== null);
  add('nonogram', nonoDone.length > 0 || keys.includes('nonogram:size'), nonoDone.length ? `${time(minOf(nonoDone.map((n) => num(`nonogram:best:${n}`)))!)} (${nonoDone.map((n) => `${n}×${n}`).join(', ')})` : null);
  const fourRecords = withPrefix('fourrow:record:').map((k) => kv.get<{ won: number; lost: number; drawn: number } | null>(k, null));
  const fourPlayed = fourRecords.reduce((n, r) => n + (r ? r.won + r.lost + r.drawn : 0), 0);
  add('four-in-a-row', fourPlayed > 0 || keys.includes('fourrow:opponent'), fourPlayed ? `${fourRecords.reduce((n, r) => n + (r?.won ?? 0), 0)} of ${fourPlayed} won vs computer` : null);

  const streak = dailyStreak(progress, today);
  const dailyDays = Object.values(progress.daily).filter((d) => Object.values(d).some((r) => r?.won)).length;
  const perfectDay = Object.values(progress.daily).some((d) => DAILY_GAMES.every((g) => d[g]?.won));
  const totalWins = games.reduce((n, g) => n + g.wins, 0);
  const anyBest = games.some((g) => g.best !== null && g.id !== 'mahjong-4p');
  const arcadeIds = [...ARCADE_SHELL, 'color-memory', 'paddle-ball'];
  const arcadeScored = arcadeIds.filter((id) => {
    const g = games.find((x) => x.id === id)!;
    return id === 'paddle-ball' ? g.wins > 0 : g.best !== null;
  }).length;

  const a = (id: string, name: string, description: string, unlocked: boolean): Achievement => ({ id, name, description, unlocked });
  const achievements = [
    a('first-win', 'First Win', 'Win, solve or clear any game.', totalWins > 0 || anyBest),
    a('daily-debut', 'Daily Debut', 'Complete your first daily challenge.', dailyDays > 0),
    a('streak-7', '7-Day Streak', 'Complete a daily challenge seven days in a row.', streak.best >= 7),
    a('perfect-day', 'Perfect Day', 'Complete all four daily challenges on the same day.', perfectDay),
    a('word-wizard', 'Word Wizard', 'Solve a Word Guess in two guesses or fewer.', word.some((s) => (s.dist[0] ?? 0) + (s.dist[1] ?? 0) > 0)),
    a('sudoku-expert', 'Sudoku Expert', 'Solve an Expert Sudoku.', sudokuBest('expert') !== null),
    a('tile-master', 'Tile Master', 'Clear all six Mahjong Solitaire layouts.', layoutsDone === 6),
    a('card-shark', 'Card Shark', 'Win Klondike, Spider and FreeCell.', ['klondike', 'spider', 'freecell'].every((id) => cardBest(id) !== null || wins(id) > 0)),
    a('mine-expert', 'Minesweeper Expert', 'Clear an Expert Minesweeper field.', minesBest('expert') !== null),
    a('arcade-master', 'Arcade Master', 'Score in all ten arcade games (beat the computer at Paddle Ball).', arcadeScored === arcadeIds.length),
  ];

  return { games, totalWins, gamesPlayed: games.filter((g) => g.played).length, streak, dailyDays, achievements };
}
