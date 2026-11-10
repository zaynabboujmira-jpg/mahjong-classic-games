import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { MahjongGame, type GameSnapshot } from '@/engines/mahjong/game';
import { getLayout, DEFAULT_LAYOUT } from '@/engines/mahjong/layouts';
import { MahjongCanvas } from '@/engines/mahjong/render/canvas';
import { dailySeed, randomSeedString } from '@/engines/core/rng';
import {
  DEFAULT_SETTINGS,
  formatTime,
  loadBest,
  loadSettings,
  recordPlay,
  recordWin,
  saveSettings,
  type BestRecord,
  type Settings,
} from '@/engines/core/storage';
import { Toolbar } from './Toolbar';
import { SettingsPanel } from './SettingsPanel';
import { WinDialog } from './WinDialog';

interface Props {
  layoutSlug?: string;
  /** When set, overrides the URL seed (used by daily pages). */
  seed?: string;
  gameSlug?: string;
}

function readSeedFromUrl(): string | null {
  try {
    return new URLSearchParams(window.location.search).get('seed');
  } catch {
    return null;
  }
}
function writeSeedToUrl(seed: string) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('seed', seed);
    history.replaceState(null, '', url);
  } catch {
    /* ignore */
  }
}

function applyTheme(s: Settings) {
  const root = document.documentElement;
  if (s.theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = s.theme;
  if (s.highContrast) root.dataset.contrast = 'high';
  else delete root.dataset.contrast;
}

function isDark(s: Settings) {
  if (s.theme === 'dark') return true;
  if (s.theme === 'light') return false;
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
}

export default function GameIsland({ layoutSlug = DEFAULT_LAYOUT, seed: seedProp, gameSlug = 'mahjong' }: Props) {
  const meta = getLayout(layoutSlug) ?? getLayout(DEFAULT_LAYOUT);
  const layout = meta.layout;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<MahjongCanvas | null>(null);
  const gameRef = useRef<MahjongGame | null>(null);

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [snap, setSnap] = useState<GameSnapshot | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [best, setBest] = useState<BestRecord>({ bestTimeMs: null, wins: 0, plays: 0 });
  const [announce, setAnnounce] = useState('');
  const [cursor, setCursor] = useState<number | null>(null);
  const startRef = useRef(0);
  const wonRef = useRef(false);

  const renderOpts = useMemo(
    () => ({
      largeTiles: settings.largeTiles,
      highlightFree: settings.highlightFree,
      reducedMotion:
        settings.reducedMotion || (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches),
      highContrast: settings.highContrast,
      dark: isDark(settings),
    }),
    [settings],
  );

  // Boot: settings, renderer, first game.
  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    applyTheme(s);
    setBest(loadBest(gameSlug, layoutSlug));

    const canvas = canvasRef.current!;
    const container = containerRef.current!;
    const renderer = new MahjongCanvas(canvas, container, layout, {
      largeTiles: s.largeTiles,
      highlightFree: s.highlightFree,
      reducedMotion: s.reducedMotion,
      highContrast: s.highContrast,
      dark: isDark(s),
    });
    rendererRef.current = renderer;
    renderer.onTileTap = (id) => handleTap(id);

    startGame(seedProp ?? readSeedFromUrl() ?? randomSeedString());

    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onScheme = () => setSettings((prev) => ({ ...prev }));
    mq.addEventListener?.('change', onScheme);
    return () => {
      mq.removeEventListener?.('change', onScheme);
      renderer.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    rendererRef.current?.setOptions(renderOpts);
  }, [renderOpts]);

  // Timer
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed(performance.now() - startRef.current), 250);
    return () => clearInterval(id);
  }, [running]);

  function startGame(seed: string) {
    const game = new MahjongGame(layout, seed);
    gameRef.current = game;
    wonRef.current = false;
    rendererRef.current?.setGame(game);
    game.subscribe((s) => {
      setSnap(s);
      if (s.status === 'won' && !wonRef.current) {
        wonRef.current = true;
        setRunning(false);
        const t = performance.now() - startRef.current;
        setElapsed(t);
        setBest(recordWin(gameSlug, layoutSlug, t));
        setAnnounce(`You cleared the board in ${formatTime(t)}.`);
      }
    });
    if (!seedProp) writeSeedToUrl(seed);
    recordPlay(gameSlug, layoutSlug);
    startRef.current = performance.now();
    setElapsed(0);
    setRunning(false);
    setCursor(null);
    rendererRef.current?.setCursor(null);
    setAnnounce(`New ${layout.name} game. ${layout.slots.length} tiles.`);
  }

  function ensureRunning() {
    if (!running && !wonRef.current) {
      startRef.current = performance.now() - elapsed;
      setRunning(true);
    }
  }

  function handleTap(id: number) {
    const game = gameRef.current;
    if (!game) return;
    ensureRunning();
    const res = game.select(id);
    const t = game.getTiles()[id];
    if (res === 'blocked') setAnnounce(`${t.face.label} is blocked.`);
    else if (res === 'selected' || res === 'mismatch') setAnnounce(`${t.face.label} selected.`);
    else if (res === 'deselected') setAnnounce('Selection cleared.');
    else if (res === 'matched') {
      const s = game.snapshot();
      setAnnounce(`Matched ${t.face.label}. ${s.remaining} tiles left.`);
      if (s.status === 'stuck') setAnnounce(`No more moves. ${s.remaining} tiles left. Use shuffle or undo.`);
    }
    setCursor(id);
    rendererRef.current?.setCursor(id);
  }

  function onNew() {
    startGame(randomSeedString());
  }
  function onDaily() {
    startGame(dailySeed(`${gameSlug}:${layoutSlug}`));
  }
  function onHint() {
    const game = gameRef.current;
    if (!game) return;
    ensureRunning();
    const h = game.hint();
    setAnnounce(h ? `Hint: ${game.getTiles()[h[0]].face.label}.` : 'No moves available. Try shuffle.');
  }
  function onUndo() {
    gameRef.current?.undo();
    setAnnounce('Move undone.');
  }
  function onShuffle() {
    const game = gameRef.current;
    if (!game) return;
    ensureRunning();
    if (game.shuffle()) setAnnounce('Remaining tiles shuffled.');
  }

  function updateSettings(next: Settings) {
    setSettings(next);
    saveSettings(next);
    applyTheme(next);
  }

  // Keyboard navigation over free tiles.
  function onKeyDown(e: KeyboardEvent) {
    const game = gameRef.current;
    const r = rendererRef.current;
    if (!game || !r) return;
    const free = game.getFreeTiles();
    if (free.length === 0) return;
    const idx = cursor === null ? -1 : free.findIndex((t) => t.id === cursor);
    const move = (next: number) => {
      const t = free[(next + free.length) % free.length];
      setCursor(t.id);
      r.setCursor(t.id);
      setAnnounce(`${t.face.label}${game.snapshot().selected === t.id ? ', selected' : ''}.`);
    };
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        move(idx + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        move(idx - 1);
        break;
      case 'Home':
        e.preventDefault();
        move(0);
        break;
      case 'End':
        e.preventDefault();
        move(free.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (cursor !== null) handleTap(cursor);
        else move(0);
        break;
      case 'Escape':
        game.clearSelection();
        setAnnounce('Selection cleared.');
        break;
      case 'h':
      case 'H':
        onHint();
        break;
      case 'u':
      case 'U':
      case 'z':
      case 'Z':
        onUndo();
        break;
    }
  }

  const status = snap?.status ?? 'playing';

  return (
    <div class="mx-auto w-full max-w-6xl px-2 sm:px-4">
      <Toolbar
        onNew={onNew}
        onDaily={onDaily}
        onHint={onHint}
        onUndo={onUndo}
        onShuffle={onShuffle}
        onSettings={() => setShowSettings(true)}
        canUndo={!!gameRef.current?.canUndo()}
        elapsed={elapsed}
        moves={snap?.moves ?? 0}
        remaining={snap?.remaining ?? layout.slots.length}
        best={best.bestTimeMs}
        seed={snap?.seed ?? ''}
      />

      {/* On phones the page scrolls (board can be taller than the viewport); from sm up the board is capped to the viewport and scrolls itself. */}
      <div
        ref={containerRef}
        class="relative mt-2 w-full overflow-auto rounded-xl shadow-lg sm:max-h-[calc(100dvh-140px)]"
        style={{ minHeight: '320px' }}
      >
        <canvas
          ref={canvasRef}
          tabIndex={0}
          role="application"
          aria-label={`${layout.name} Mahjong board. Use arrow keys to move between free tiles, Enter to select, H for a hint, U to undo.`}
          onKeyDown={onKeyDown}
          onBlur={() => {
            rendererRef.current?.setCursor(null);
          }}
          onFocus={() => {
            if (cursor !== null) rendererRef.current?.setCursor(cursor);
          }}
          class="block outline-none focus-visible:ring-4 focus-visible:ring-orange-400"
        />
        {status === 'stuck' && (
          <div class="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-2 bg-black/70 p-3 text-sm text-white">
            <span>No moves left.</span>
            <button class="rounded-md bg-white px-3 py-2 font-medium text-black" onClick={onShuffle}>
              Shuffle remaining
            </button>
            <button class="rounded-md border border-white px-3 py-2 font-medium" onClick={onUndo}>
              Undo
            </button>
          </div>
        )}
      </div>

      {/* Screen-reader list of free tiles: an accessible alternative to the canvas. */}
      <div class="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </div>
      <details class="mt-2 text-sm">
        <summary class="cursor-pointer text-muted">Accessible tile list ({gameRef.current?.getFreeTiles().length ?? 0} free tiles)</summary>
        <ul class="mt-2 flex flex-wrap gap-1">
          {gameRef.current?.getFreeTiles().map((t) => (
            <li key={t.id}>
              <button
                class={`rounded border border-border px-2 py-1 ${snap?.selected === t.id ? 'bg-accent text-accent-fg' : 'bg-bg-elev'}`}
                onClick={() => handleTap(t.id)}
                aria-pressed={snap?.selected === t.id}
              >
                {t.face.label}
              </button>
            </li>
          ))}
        </ul>
      </details>

      {showSettings && <SettingsPanel settings={settings} onChange={updateSettings} onClose={() => setShowSettings(false)} />}
      {status === 'won' && (
        <WinDialog
          timeMs={elapsed}
          moves={snap?.moves ?? 0}
          shuffles={snap?.shuffles ?? 0}
          best={best}
          layoutName={layout.name}
          seed={snap?.seed ?? ''}
          onNew={onNew}
        />
      )}
    </div>
  );
}
