// Builds src/data/chess-puzzles.json from computer self-play. Run: npm run puzzles:chess (takes a few minutes).
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { Chess, typeOf, colorOf } from '../../src/engines/board/chess';
import { chooseMove } from '../../src/engines/board/chess-ai';
import { matingMoves, mateInTwoKeys, uci, verifyPuzzle, type ChessPuzzle } from '../../src/engines/board/chess-puzzles';
import { createRng } from '../../src/engines/core/rng';

const VAL = [0, 1, 3, 3, 5, 9, 0];
const material = (g: Chess, c: number) => g.board.reduce((t, p) => t + (p && colorOf(p) === c ? VAL[typeOf(p)]! : 0), 0);

it('generate', () => {
  const want1 = Number(process.env.N1 ?? 200), want2 = Number(process.env.N2 ?? 200);
  const out1: ChessPuzzle[] = [], out2: ChessPuzzle[] = [];
  const seen = new Set<string>();
  const t0 = Date.now();
  for (let game = 0; game < 9000 && (out1.length < want1 || out2.length < want2); game++) {
    const rng = createRng('puzzles' + game);
    const g = new Chess();
    const levels = ['beginner', 'beginner'] as const;
    for (let ply = 0; ply < 160 && !g.outcome(); ply++) {
      if (ply >= 12) {
        const fen = g.fen();
        const board = fen.split(' ').slice(0, 2).join(' ');
        const diff = material(g, g.turn) - material(g, g.turn ^ 1);
        const pieces = g.board.filter(Boolean).length;
        if (!seen.has(board) && diff <= 6 && diff >= -10 && pieces >= 8) {
          const m1 = matingMoves(g, 2);
          if (m1.length === 1 && out1.length < want1) {
            const p: ChessPuzzle = { fen, mate: 1, key: uci(m1[0]!) };
            if (verifyPuzzle(p)) { out1.push(p); seen.add(board); }
          } else if (m1.length === 0 && out2.length < want2) {
            const keys = mateInTwoKeys(g, 2);
            if (keys.length === 1) {
              const p: ChessPuzzle = { fen, mate: 2, key: uci(keys[0]!) };
              if (verifyPuzzle(p)) { out2.push(p); seen.add(board); }
            }
          }
        }
      }
      const m = chooseMove(g, levels[g.turn]!, rng);
      if (!m) break;
      g.play(m);
    }
    if (game % 20 === 0) console.log('game', game, out1.length, out2.length, Math.round((Date.now() - t0) / 1000) + 's');
  }
  writeFileSync(process.env.OUT ?? 'src/data/chess-puzzles.json', JSON.stringify({ mate1: out1, mate2: out2 }));
  console.log('done', out1.length, out2.length);
}, 3_600_000);
