import type { APIRoute, GetStaticPaths } from 'astro';
import { getLayout } from '../../engines/mahjong/layouts';
import { layoutPages } from '../../lib/mahjong-pages';
import { Minesweeper, LEVELS, LEVEL_IDS } from '../../engines/minesweeper/game';
import { DIFFICULTIES, generate } from '../../engines/sudoku/generator';
import { cardFanArt, layoutArt, minesArt, ogCardSvg, sudokuArt, svgToPng } from '../../lib/og';

const SUDOKU_NAMES = { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' } as const;
const SUDOKU_SUBTITLES = {
  easy: 'About 38 clues · Play free',
  medium: 'Hidden singles · Play free',
  hard: 'Pairs & locked candidates',
  expert: 'X-Wing, XY-Wing, Swordfish',
} as const;

/** A real, part-solved 9x9 field: one opening from the centre, with its border mines flagged. */
function minesField() {
  const g = new Minesweeper({ width: 9, height: 9, mines: 10 }, 'og-card');
  g.reveal(40);
  const cells = Array.from({ length: g.size }, (_, i): 'hidden' | 'flag' | number => {
    if (g.state[i] === 1) return g.counts[i]!;
    const bordersOpen = g.neighbors[i]!.some((n) => g.state[n] === 1);
    return g.mines[i] && bordersOpen ? 'flag' : 'hidden';
  });
  return { width: 9, height: 9, cells };
}

/** One 1200x630 OpenGraph PNG per page key, rendered at build time. */
export const getStaticPaths = (async () => {
  const turtle = layoutArt(getLayout('turtle')!.slots);
  const butterfly = layoutArt(getLayout('butterfly')!.slots);
  const pages = await layoutPages();
  return [
    { params: { key: 'home' }, props: { title: 'Free Mahjong Solitaire', subtitle: 'No download · Solvable deals', art: turtle } },
    { params: { key: 'mahjong' }, props: { title: 'Mahjong Solitaire Layouts', subtitle: `${pages.length} layouts · Play free`, art: butterfly } },
    ...pages.map((p) => ({
      params: { key: `mahjong-${p.id}` },
      props: {
        title: `${p.name} Mahjong`,
        subtitle: `${p.tiles} tiles · ${p.entry.data.difficulty} · Play free`,
        art: layoutArt(getLayout(p.id)!.slots),
      },
    })),
    { params: { key: 'solitaire' }, props: { title: 'Free Solitaire Games', subtitle: 'Klondike · Spider · FreeCell', art: cardFanArt() } },
    { params: { key: 'solitaire-klondike' }, props: { title: 'Klondike Solitaire', subtitle: 'Draw 1 or Draw 3 · Play free', art: cardFanArt() } },
    {
      params: { key: 'solitaire-spider' },
      props: { title: 'Spider Solitaire', subtitle: '1, 2 or 4 suits · Play free', art: cardFanArt([['K', 's'], ['Q', 's'], ['J', 's'], ['10', 's'], ['9', 's']]) },
    },
    {
      params: { key: 'sudoku' },
      props: { title: 'Free Sudoku', subtitle: 'Easy to Expert · One solution each', art: sudokuArt(generate('medium', 'og').givens) },
    },
    ...DIFFICULTIES.map((d) => ({
      params: { key: `sudoku-${d}` },
      props: { title: `${SUDOKU_NAMES[d]} Sudoku`, subtitle: SUDOKU_SUBTITLES[d], art: sudokuArt(generate(d, 'og').givens) },
    })),
    { params: { key: 'minesweeper' }, props: { title: 'Free Minesweeper', subtitle: 'Safe first click · 3 levels', art: minesArt(minesField()) } },
    ...LEVEL_IDS.map((id) => ({
      params: { key: `minesweeper-${id}` },
      props: {
        title: `Minesweeper ${LEVELS[id].name}`,
        subtitle: `${LEVELS[id].width}×${LEVELS[id].height} · ${LEVELS[id].mines} mines · Play free`,
        art: minesArt(minesField()),
      },
    })),
    {
      params: { key: 'solitaire-freecell' },
      props: { title: 'FreeCell', subtitle: 'Classic numbered deals · Play free', art: cardFanArt([['A', 'c'], ['A', 'd'], ['A', 'h'], ['A', 's'], ['K', 'h']]) },
    },
  ];
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => {
  const png = svgToPng(ogCardSvg(props as Parameters<typeof ogCardSvg>[0]), 1200);
  return new Response(png as BodyInit, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
};
