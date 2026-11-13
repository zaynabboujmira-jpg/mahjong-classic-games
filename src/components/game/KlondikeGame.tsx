import { createRng, randomSeed } from '../../engines/core/rng';
import { Klondike, klondikeSpec, type DrawMode } from '../../engines/solitaire/klondike';
import CardTable from './CardTable';

interface Props {
  defaultDraw: DrawMode;
  otherGame: { name: string; href: string };
}

export default function KlondikeGame({ defaultDraw, otherGame }: Props) {
  return (
    <CardTable
      name="Klondike Solitaire"
      storageKey="klondike"
      create={(seed, o) => new Klondike(createRng(seed), o['draw'] === 3 ? 3 : 1)}
      spec={(o) => klondikeSpec(o['draw'] === 3 ? 3 : 1)}
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
