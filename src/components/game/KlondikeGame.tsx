import { createRng, randomSeed } from '../../engines/core/rng';
import { Klondike, klondikeSpec, type Decks, type DrawMode } from '../../engines/solitaire/klondike';
import CardTable from './CardTable';

interface Props {
  defaultDraw: DrawMode;
  /** 2 for Double Klondike (104 cards, nine columns). */
  decks?: Decks;
  otherGame: { name: string; href: string };
}

export default function KlondikeGame({ defaultDraw, decks = 1, otherGame }: Props) {
  return (
    <CardTable
      name={decks === 2 ? 'Double Klondike' : 'Klondike Solitaire'}
      storageKey={decks === 2 ? 'double-klondike' : 'klondike'}
      create={(seed, o) => new Klondike(createRng(decks === 2 ? `double:${seed}` : seed), o['draw'] === 3 ? 3 : 1, decks)}
      spec={(o) => klondikeSpec(o['draw'] === 3 ? 3 : 1, decks)}
      newSeed={randomSeed}
      seedParam="seed"
      isValidSeed={(s) => /^[a-z0-9]{1,24}$/i.test(s)}
      optionGroups={[{ id: 'draw', label: 'Cards per draw', values: [{ value: 1, label: 'Draw 1' }, { value: 3, label: 'Draw 3' }] }]}
      defaults={{ draw: defaultDraw }}
      keyboardHelp="Left and right arrows move between piles, up and down move within a column, Enter picks up and places cards, A auto-moves, D draws, H gives a hint, Control+Z undoes."
      otherGame={otherGame}
    />
  );
}
