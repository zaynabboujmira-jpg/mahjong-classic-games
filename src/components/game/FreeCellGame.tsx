import { FREECELL_SPEC, FreeCell, MS_DEAL_MAX } from '../../engines/solitaire/freecell';
import CardTable from './CardTable';

interface Props {
  /** Fixed Microsoft deal number for /solitaire/freecell/deal/[n]/ pages. */
  deal?: number;
  otherGame: { name: string; href: string };
}

/** New games pick from the classic 32,000 Microsoft deals. */
const randomDeal = () => String(1 + Math.floor(Math.random() * 32000));
const isDeal = (s: string) => /^\d{1,7}$/.test(s) && +s >= 1 && +s <= MS_DEAL_MAX;

export default function FreeCellGame({ deal, otherGame }: Props) {
  return (
    <CardTable
      name="FreeCell"
      storageKey="freecell"
      create={(seed) => new FreeCell(Number(seed))}
      spec={() => FREECELL_SPEC}
      newSeed={randomDeal}
      seedParam="deal"
      isValidSeed={isDeal}
      {...(deal ? { fixedSeed: String(deal) } : {})}
      optionGroups={[]}
      defaults={{}}
      keyboardHelp="Left and right arrows move between free cells, foundations and columns, up and down move within a column, Enter picks up and places cards, A auto-moves, H gives a hint, Control+Z undoes."
      otherGame={otherGame}
    />
  );
}
