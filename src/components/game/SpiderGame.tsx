import { createRng, randomSeed } from '../../engines/core/rng';
import { SPIDER_SPEC, Spider, type SuitCount } from '../../engines/solitaire/spider';
import CardTable from './CardTable';

interface Props {
  defaultSuits: SuitCount;
  otherGame: { name: string; href: string };
}

const suitsOf = (v: number | undefined): SuitCount => (v === 2 || v === 4 ? v : 1);

export default function SpiderGame({ defaultSuits, otherGame }: Props) {
  return (
    <CardTable
      name="Spider Solitaire"
      storageKey="spider"
      create={(seed, o) => new Spider(createRng(seed), suitsOf(o['suits']))}
      spec={() => SPIDER_SPEC}
      newSeed={randomSeed}
      optionGroups={[
        {
          id: 'suits',
          label: 'Number of suits',
          values: [
            { value: 1, label: '1 suit' },
            { value: 2, label: '2 suits' },
            { value: 4, label: '4 suits' },
          ],
        },
      ]}
      defaults={{ suits: defaultSuits }}
      keyboardHelp="Left and right arrows move between piles, up and down move within a column, Enter picks up and places cards, A auto-moves, D deals a new row, H gives a hint, Control+Z undoes."
      otherGame={otherGame}
    />
  );
}
