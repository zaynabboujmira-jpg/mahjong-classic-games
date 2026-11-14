import { RANK_LABELS, SUIT_SYMBOLS, cardLabel, isRed, type Card } from '../../engines/solitaire/cards';

/** U+FE0E asks for the text (not emoji) presentation of the suit symbol. */
const VS = '︎';

/** A playing card drawn with HTML and CSS: corner index and a large suit in the middle. */
export function PlayingCard({ card, down = false, extra = '' }: { card: Card | null; down?: boolean; extra?: string }) {
  if (!card || down) return <span class={`pc pc-back${extra}`} aria-hidden="true" />;
  const suit = SUIT_SYMBOLS[card.suit] + VS;
  const rank = RANK_LABELS[card.rank];
  return (
    <span class={`pc${isRed(card) ? ' pc-red' : ''}${extra}`} aria-hidden="true">
      <span class="pc-idx">
        {rank}
        <span>{suit}</span>
      </span>
      <span class="pc-mid">{card.rank > 10 ? rank : suit}</span>
    </span>
  );
}

export { cardLabel };
