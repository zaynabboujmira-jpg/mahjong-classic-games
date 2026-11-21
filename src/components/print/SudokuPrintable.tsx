import { useRef, useState } from 'preact/hooks';
import { randomSeed } from '../../engines/core/rng';
import type { Difficulty } from '../../engines/sudoku/generator';
import { PuzzleSource } from '../../engines/sudoku/source';

/**
 * Printable Sudoku sheets: four puzzles of one level, laid out 4 per page or
 * 1 per page, with an optional answer-key page. The first set is generated at
 * build time (so the page works and is indexable without JS); New puzzles and
 * level changes generate fresh ones in a Web Worker. Print styles in
 * global.css hide everything except the sheets.
 */
export interface Sheet {
  seed: string;
  givens: readonly number[];
  solution: readonly number[];
}
interface Props {
  initial: { difficulty: Difficulty; sheets: Sheet[] };
  levels: { id: Difficulty; name: string }[];
}

const COUNT = 4;

function Grid({ cells, label, small }: { cells: readonly number[]; label: string; small?: boolean }) {
  const rows = Array.from({ length: 9 }, (_, r) => cells.slice(r * 9, r * 9 + 9));
  return (
    <table class={`ps-grid${small ? ' ps-grid-small' : ''}`} aria-label={label}>
      <tbody>
        {rows.map((row, r) => (
          <tr key={r}>
            {row.map((v, c) => (
              <td key={c}>{v || ''}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function SudokuPrintable({ initial, levels }: Props) {
  const [difficulty, setDifficulty] = useState<Difficulty>(initial.difficulty);
  const [sheets, setSheets] = useState<Sheet[]>(initial.sheets);
  const [perPage, setPerPage] = useState<1 | 4>(4);
  const [answers, setAnswers] = useState(true);
  const [busy, setBusy] = useState(false);
  const source = useRef<PuzzleSource | null>(null);
  const request = useRef(0);

  const levelName = levels.find((l) => l.id === difficulty)?.name ?? difficulty;

  const make = async (d: Difficulty) => {
    const id = ++request.current;
    setDifficulty(d);
    setBusy(true);
    source.current ??= new PuzzleSource();
    const puzzles = await Promise.all(Array.from({ length: COUNT }, () => source.current!.get(d, randomSeed())));
    if (id !== request.current) return; // a newer request replaced this one
    setSheets(puzzles.map((p) => ({ seed: p.seed, givens: p.givens, solution: p.solution })));
    setBusy(false);
  };

  const title = (i: number) => `${levelName} Sudoku ${i + 1}`;
  const footer = <p class="ps-footer">Free Play Classic · freeplayclassic.com/sudoku/printable/</p>;

  return (
    <div class="printable">
      <div class="ps-controls no-print">
        <div class="ps-row">
          <span class="ps-label" id="ps-level">
            Level
          </span>
          <div class="segmented" role="radiogroup" aria-labelledby="ps-level">
            {levels.map((l) => (
              <button
                key={l.id}
                type="button"
                class="seg"
                role="radio"
                aria-checked={l.id === difficulty}
                disabled={busy && l.id !== difficulty}
                onClick={() => l.id !== difficulty && void make(l.id)}
              >
                {l.name}
              </button>
            ))}
          </div>
        </div>
        <div class="ps-row">
          <span class="ps-label" id="ps-layout">
            Layout
          </span>
          <div class="segmented" role="radiogroup" aria-labelledby="ps-layout">
            {([4, 1] as const).map((n) => (
              <button key={n} type="button" class="seg" role="radio" aria-checked={perPage === n} onClick={() => setPerPage(n)}>
                {n} per page
              </button>
            ))}
          </div>
        </div>
        <div class="ps-row">
          <label class="ps-check">
            <input type="checkbox" checked={answers} onChange={(e) => setAnswers((e.target as HTMLInputElement).checked)} />
            Include answer key
          </label>
        </div>
        <div class="ps-row ps-actions">
          <button type="button" class="btn" disabled={busy} onClick={() => void make(difficulty)}>
            New puzzles
          </button>
          <button type="button" class="btn btn-primary" disabled={busy} onClick={() => window.print()}>
            Print
          </button>
          <p class="ps-status" aria-live="polite">
            {busy ? `Making ${COUNT} new ${levelName.toLowerCase()} puzzles…` : `${COUNT} ${levelName.toLowerCase()} puzzles${answers ? ' + answer key' : ''}, ready to print`}
          </p>
        </div>
      </div>

      <div class={`ps-sheets ps-per-${perPage}`} aria-busy={busy}>
        {perPage === 4 ? (
          <section class="ps-sheet" aria-label={`${levelName} Sudoku, page 1`}>
            <p class="ps-sheet-title">{levelName} Sudoku · 4 puzzles</p>
            <div class="ps-four">
              {sheets.map((s, i) => (
                <figure key={s.seed} class="ps-puzzle">
                  <figcaption>{title(i)}</figcaption>
                  <Grid cells={s.givens} label={`${title(i)}, puzzle`} />
                </figure>
              ))}
            </div>
            {footer}
          </section>
        ) : (
          sheets.map((s, i) => (
            <section key={s.seed} class="ps-sheet" aria-label={`${levelName} Sudoku, page ${i + 1}`}>
              <p class="ps-sheet-title">{title(i)}</p>
              <div class="ps-one">
                <Grid cells={s.givens} label={`${title(i)}, puzzle`} />
              </div>
              {footer}
            </section>
          ))
        )}
        {answers && (
          <section class="ps-sheet ps-answers" aria-label={`${levelName} Sudoku answer key`}>
            <p class="ps-sheet-title">Answer key · {levelName} Sudoku</p>
            <div class="ps-four">
              {sheets.map((s, i) => (
                <figure key={s.seed} class="ps-puzzle">
                  <figcaption>{title(i)}: answer</figcaption>
                  <Grid cells={s.solution} label={`${title(i)}, answer`} small />
                </figure>
              ))}
            </div>
            {footer}
          </section>
        )}
      </div>
    </div>
  );
}
