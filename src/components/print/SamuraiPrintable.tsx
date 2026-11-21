import { useState } from 'preact/hooks';
import { randomSeed } from '../../engines/core/rng';
import { ACTIVE, SIDE, SAMURAI_LEVELS, generateSamurai, type SamuraiLevel } from '../../engines/sudoku/samurai';

/**
 * Printable Samurai Sudoku: one puzzle per page (21 columns at 9 mm fit Letter
 * and A4), with an optional answer-key page. The first puzzle is generated at
 * build time so the page works without JS; New puzzle and level changes
 * generate in the browser (well under a second). Print styles live in
 * global.css with the classic printable page.
 */
export interface SamuraiSheet {
  seed: string;
  givens: readonly number[];
  solution: readonly number[];
}
interface Props {
  initial: { level: SamuraiLevel; sheet: SamuraiSheet };
}
const NAMES: Record<SamuraiLevel, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

/** Thick lines fall on every third row and column of the 21×21 square, for all five grids at once. */
function SamuraiGrid({ cells, label }: { cells: readonly number[]; label: string }) {
  return (
    <table class="sp-grid" aria-label={label}>
      <tbody>
        {Array.from({ length: SIDE }, (_, r) => (
          <tr key={r}>
            {Array.from({ length: SIDE }, (_, c) => {
              const i = r * SIDE + c;
              if (!ACTIVE[i]) return <td key={c} class="sp-x" />;
              const cls = [c % 3 === 0 ? 'sp-l' : '', (c + 1) % 3 === 0 ? 'sp-r' : '', r % 3 === 0 ? 'sp-t' : '', (r + 1) % 3 === 0 ? 'sp-b' : ''].filter(Boolean).join(' ');
              return (
                <td key={c} class={cls || undefined}>
                  {cells[i] || ''}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function SamuraiPrintable({ initial }: Props) {
  const [level, setLevel] = useState<SamuraiLevel>(initial.level);
  const [sheet, setSheet] = useState<SamuraiSheet>(initial.sheet);
  const [answers, setAnswers] = useState(true);
  const [busy, setBusy] = useState(false);

  const make = (l: SamuraiLevel) => {
    setLevel(l);
    setBusy(true);
    // Let the busy state paint, then build the puzzle.
    window.setTimeout(() => {
      const p = generateSamurai(l, randomSeed());
      setSheet({ seed: p.seed, givens: p.givens, solution: p.solution });
      setBusy(false);
    }, 30);
  };

  const name = `${NAMES[level]} Samurai Sudoku`;
  const footer = <p class="ps-footer">Free Play Classic · freeplayclassic.com/sudoku/samurai/printable/</p>;

  return (
    <div class="printable">
      <div class="ps-controls no-print">
        <div class="ps-row">
          <span class="ps-label" id="sp-level">
            Level
          </span>
          <div class="segmented" role="radiogroup" aria-labelledby="sp-level">
            {SAMURAI_LEVELS.map((l) => (
              <button key={l} type="button" class="seg" role="radio" aria-checked={l === level} disabled={busy && l !== level} onClick={() => l !== level && make(l)}>
                {NAMES[l]}
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
          <button type="button" class="btn" disabled={busy} onClick={() => make(level)}>
            New puzzle
          </button>
          <button type="button" class="btn btn-primary" disabled={busy} onClick={() => window.print()}>
            Print
          </button>
          <p class="ps-status" aria-live="polite">
            {busy ? `Making a new ${NAMES[level].toLowerCase()} Samurai…` : `1 ${NAMES[level].toLowerCase()} Samurai Sudoku${answers ? ' + answer key' : ''}, ready to print`}
          </p>
        </div>
      </div>

      <div class="ps-sheets" aria-busy={busy}>
        <section class="ps-sheet sp-sheet" aria-label={name}>
          <p class="ps-sheet-title">{name}</p>
          <div class="sp-wrap">
            <SamuraiGrid cells={sheet.givens} label={`${name}, puzzle`} />
          </div>
          {footer}
        </section>
        {answers && (
          <section class="ps-sheet sp-sheet ps-answers" aria-label={`${name} answer key`}>
            <p class="ps-sheet-title">Answer key · {name}</p>
            <div class="sp-wrap">
              <SamuraiGrid cells={sheet.solution} label={`${name}, answer`} />
            </div>
            {footer}
          </section>
        )}
      </div>
    </div>
  );
}
