import type { ComponentChildren } from 'preact';
import { cardLabel, type Card } from '../../engines/solitaire/cards';
import type { Played } from '../../engines/cards/tricks';
import { PlayingCard } from './PlayingCard';

export interface TrickTableProps {
  names: readonly string[];
  /** A short line under each name (points, bid and tricks…). */
  info: readonly string[];
  counts: readonly number[];
  turn: number;
  trick: Played[];
  /** Seat that won the trick on show, to highlight it. */
  winner?: number | null;
  hand: Card[];
  playable: Set<number>;
  selected?: Set<number>;
  onCard: (c: Card) => void;
  /** Message line over the table. */
  message: string;
  /** Extra controls between the table and your hand (pass button, bid picker). */
  children?: ComponentChildren;
}

const POS = ['s', 'w', 'n', 'e'];

/** Four seats around a table: opponents' card backs, the trick in the middle, your hand at the bottom. */
export function TrickTable(p: TrickTableProps) {
  const n = p.hand.length;
  return (
    <div class="tt">
      <p class="arcade-message tt-msg" aria-hidden="true">
        {p.message}
      </p>
      <div class="tt-table">
        {[1, 2, 3].map((s) => (
          <div key={s} class={`tt-seat tt-${POS[s]}${p.turn === s ? ' is-turn' : ''}`}>
            <span class="tt-name">{p.names[s]}</span>
            <span class="tt-info">{p.info[s]}</span>
            <span class="tt-backs" aria-label={`${p.counts[s]} cards`}>
              {Array.from({ length: Math.min(p.counts[s]!, 13) }, (_, k) => (
                <span key={k} class="tt-back" />
              ))}
            </span>
          </div>
        ))}
        <div class="tt-trick" aria-label={`Trick: ${p.trick.map((t) => `${p.names[t.seat]} ${cardLabel(t.card)}`).join(', ') || 'empty'}`}>
          {p.trick.map((t) => (
            <span key={t.card.id} class={`tt-played tt-p${POS[t.seat]}${p.winner === t.seat ? ' is-winner' : ''}`}>
              <PlayingCard card={t.card} />
            </span>
          ))}
        </div>
        <div class={`tt-you${p.turn === 0 ? ' is-turn' : ''}`}>
          <span class="tt-name">{p.names[0]}</span> <span class="tt-info">{p.info[0]}</span>
        </div>
      </div>
      {p.children}
      <div class="tt-hand" role="group" aria-label="Your cards" style={{ '--n': n }}>
        {p.hand.map((c) => {
          const ok = p.playable.has(c.id);
          const sel = p.selected?.has(c.id);
          return (
            <button
              key={c.id}
              type="button"
              class={`tt-card${ok ? ' is-playable' : ''}${sel ? ' is-sel' : ''}`}
              aria-label={`${cardLabel(c)}${sel ? ', selected' : ''}${ok ? '' : ', cannot play now'}`}
              aria-disabled={!ok}
              onClick={() => ok && p.onCard(c)}
            >
              <PlayingCard card={c} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
