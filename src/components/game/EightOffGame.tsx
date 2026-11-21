import { createRng, randomSeed } from '../../engines/core/rng';
import { EIGHTOFF_SPEC, EightOff } from '../../engines/solitaire/eightoff';
import CardTable from './CardTable';

/** Eight Off on the shared card table: eight free cells, same-suit columns, Kings into empty columns. */
export default function EightOffGame({ otherGame }: { otherGame: { name: string; href: string } }) {
  return (
    <CardTable
      name="Eight Off"
      storageKey="eight-off"
      create={(seed) => new EightOff(createRng(`eightoff:${seed}`))}
      spec={() => EIGHTOFF_SPEC}
      newSeed={randomSeed}
      seedParam="seed"
      isValidSeed={(s) => /^[a-z0-9]{1,24}$/i.test(s)}
      optionGroups={[]}
      defaults={{}}
      keyboardHelp="Left and right arrows move between free cells, foundations and columns, up and down move within a column, Enter picks up and places cards, A auto-moves, H gives a hint, Control+Z undoes."
      otherGame={otherGame}
    />
  );
}
