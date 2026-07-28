import { useState } from 'react';
import type { AbilitySlot, MatchTarget, Rarity } from '@/types/game';
import {
  CARD_BY_ID,
  RARITY_LABEL,
  RARITY_ORDER,
  SLOT_GLYPH,
  SLOT_HINT,
  SLOT_LABEL,
  SLOT_ORDER,
} from '@/data/cards';
import { MAX_DECKS, deckCards } from '@/data/decks';
import { MAP_BY_ID } from '@/data/maps';
import { GameCard } from '@/components/cards/GameCard';
import { CardPicker } from '@/components/cards/CardPicker';
import { WaterCanvas } from '@/components/water/WaterCanvas';
import { ScreenFrame } from '@/components/ui/ScreenFrame';
import { PixelPanel } from '@/components/ui/PixelPanel';
import { PixelButton } from '@/components/ui/PixelButton';
import { PixelBadge } from '@/components/ui/PixelBadge';
import { PixelInput } from '@/components/ui/PixelInput';
import { useNavigation } from '@/state/NavigationContext';
import { useDecks } from '@/state/DeckContext';
import { cn } from '@/lib/cn';

export interface DeckScreenProps {
  /** The match to start once the deck is confirmed; null when just editing. */
  next: MatchTarget | null;
}

const RARITY_CHIP: Record<Rarity, string> = {
  common: 'bg-rarity-common text-abyss',
  rare: 'bg-rarity-rare text-abyss',
  epic: 'bg-rarity-epic text-abyss',
  legendary: 'animate-[rainbow-fill_4s_linear_infinite] text-abyss',
};

/**
 * Pick the three abilities you take into a match, and save the combination.
 *
 * Sits between the map and the match so the loadout is always a deliberate
 * choice, but it costs one tap when it isn't: the last deck you played is
 * already selected and `Start Match` is the primary action.
 */
export function DeckScreen({ next }: DeckScreenProps) {
  const { navigate, back } = useNavigation();
  const { decks, activeDeck, selectDeck, equip, renameDeck, createDeck, deleteDeck } = useDecks();

  const [picking, setPicking] = useState<AbilitySlot | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState('');

  const cards = deckCards(activeDeck);
  const map = next ? MAP_BY_ID[next.mapId] : undefined;

  // Deck totals. These are the numbers a player compares two decks with, so
  // they are summed from the same `ability` fields the cards themselves show —
  // there is no second source of truth to drift.
  const totalDamage = cards.reduce((sum, card) => sum + (card?.ability.damage ?? 0), 0);
  const slowest = cards.reduce((max, card) => Math.max(max, card?.ability.cooldownS ?? 0), 0);
  const rarityMix = RARITY_ORDER.map((rarity) => ({
    rarity,
    count: cards.filter((card) => card?.rarity === rarity).length,
  })).filter((entry) => entry.count > 0);

  const startMatch = () => {
    if (!next) return;
    if (next.mode === 'online') {
      navigate('matchmaking', { mapId: next.mapId });
      return;
    }
    navigate('match', { mode: next.mode, mapId: next.mapId, roomCode: next.roomCode });
  };

  const commitRename = () => {
    renameDeck(activeDeck.id, draftName);
    setRenaming(false);
  };

  return (
    <div className="bg-abyss relative h-full w-full overflow-hidden">
      <WaterCanvas variant="background" pixelSize={9} fps={20} className="absolute inset-0" />
      <div aria-hidden className="bg-abyss/88 absolute inset-0" />

      <div className="relative h-full">
        <ScreenFrame
          title="Battle Deck"
          subtitle={
            map ? `${map.name} · three abilities, any rarities` : 'Three abilities, any rarities'
          }
          onBack={back}
          aside={<PixelBadge tone="surf">{activeDeck.name}</PixelBadge>}
          footer={
            <>
              <span className="text-mist/50 mr-auto hidden text-[10px] tracking-[0.12em] uppercase sm:block">
                {totalDamage} total damage · {slowest}s longest cooldown
              </span>
              <PixelButton variant="ghost" size="md" onClick={back}>
                Back
              </PixelButton>
              {next ? (
                <PixelButton variant="primary" size="lg" icon="▶" emphasis onClick={startMatch}>
                  {next.mode === 'online' ? 'Queue Up' : 'Start Match'}
                </PixelButton>
              ) : (
                <PixelButton variant="primary" size="lg" icon="✓" emphasis onClick={back}>
                  Done
                </PixelButton>
              )}
            </>
          }
        >
          {/* Saved decks. Selecting one is the save — there is no separate
              "apply", so a deck can never be edited and then lost by leaving. */}
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <span className="text-mist/50 mr-1 text-[9px] tracking-[0.16em] uppercase">Decks</span>
            {decks.map((deck) => {
              const active = deck.id === activeDeck.id;
              return (
                <button
                  key={deck.id}
                  type="button"
                  onClick={() => selectDeck(deck.id)}
                  aria-pressed={active}
                  className={cn(
                    'px-3 py-2 text-[10px] font-bold tracking-[0.12em] uppercase',
                    'transition-transform duration-[110ms] ease-[steps(3,jump-none)] hover:-translate-y-[2px]',
                    'focus-visible:outline-2 focus-visible:outline-offset-[6px] focus-visible:outline-foam',
                    active
                      ? 'bg-surf text-abyss pixel-border-active'
                      : 'bg-ocean text-mist/70 pixel-border',
                  )}
                >
                  {deck.name}
                </button>
              );
            })}
            {decks.length < MAX_DECKS && (
              <button
                type="button"
                onClick={() => createDeck()}
                aria-label="Create a new deck"
                className="bg-deep text-mist/70 pixel-border-thin px-3 py-2 text-[10px] font-bold tracking-[0.12em] uppercase hover:-translate-y-[2px] focus-visible:outline-2 focus-visible:outline-offset-[6px] focus-visible:outline-foam"
              >
                + New
              </button>
            )}
          </div>

          {/* Slots on the left, what they add up to on the right. The slot
              column is capped: three 5:7 cards across a 1280px stage would be
              570px tall each and push the loadout entirely below the fold. */}
          <div className="grid gap-4 pb-6 lg:grid-cols-[minmax(0,440px)_1fr] lg:items-start">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {SLOT_ORDER.map((slot, index) => {
              const card = CARD_BY_ID[activeDeck.cards[slot]];
              return (
                <div
                  key={slot}
                  className="animate-rise-in flex flex-col gap-1.5"
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-surf text-sm leading-none">{SLOT_GLYPH[slot]}</span>
                    <span className="text-[9px] font-bold tracking-[0.14em] uppercase sm:text-[10px]">
                      {SLOT_LABEL[slot]}
                    </span>
                  </div>

                  {card ? (
                    <GameCard
                      card={card}
                      size="sm"
                      showProgress={false}
                      onClick={() => setPicking(slot)}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPicking(slot)}
                      className="bg-deep pixel-border-thin text-mist/50 flex aspect-[5/7] w-full items-center justify-center text-3xl"
                    >
                      +
                    </button>
                  )}

                  <PixelButton
                    variant="secondary"
                    size="sm"
                    fullWidth
                    onClick={() => setPicking(slot)}
                    ariaLabel={`Change ${SLOT_LABEL[slot]} card`}
                  >
                    Change
                  </PixelButton>
                  <p className="text-mist/40 hidden text-[9px] leading-snug sm:block">
                    {SLOT_HINT[slot]}
                  </p>
                </div>
              );
            })}
            </div>

            <div className="flex flex-col gap-3">
            <PixelPanel title="Loadout" headerAside={activeDeck.name} className="animate-rise-in">
              <ul className="flex flex-col gap-2">
                {SLOT_ORDER.map((slot) => {
                  const card = CARD_BY_ID[activeDeck.cards[slot]];
                  if (!card) return null;
                  return (
                    <li key={slot} className="flex items-start gap-2">
                      <span
                        className={cn(
                          'shrink-0 px-1.5 py-0.5 text-[8px] font-bold tracking-[0.12em] uppercase',
                          RARITY_CHIP[card.rarity],
                        )}
                      >
                        {SLOT_LABEL[slot]}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-bold tracking-[0.08em] uppercase">
                          {card.name}
                        </span>
                        <span className="text-mist/55 block text-[10px] leading-snug">
                          {card.description}
                        </span>
                        <span className="text-mist/40 mt-0.5 flex flex-wrap gap-1.5 text-[9px]">
                          {card.ability.tags.map((tag) => (
                            <span key={tag} className="bg-ocean/70 px-1 py-px">
                              {tag}
                            </span>
                          ))}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>

              <div className="border-lagoon/50 mt-3 flex flex-wrap gap-2 border-t-2 pt-2">
                {rarityMix.map((entry) => (
                  <span
                    key={entry.rarity}
                    className={cn(
                      'px-1.5 py-0.5 text-[9px] font-bold tracking-[0.12em] uppercase',
                      RARITY_CHIP[entry.rarity],
                    )}
                  >
                    {entry.count}× {RARITY_LABEL[entry.rarity]}
                  </span>
                ))}
                <span className="text-mist/45 ml-auto text-[9px] tracking-[0.12em] uppercase">
                  {totalDamage} dmg · {slowest}s cd
                </span>
              </div>
            </PixelPanel>

            <PixelPanel title="Manage deck" className="animate-rise-in">
              {renaming ? (
                <div className="flex items-end gap-2">
                  <PixelInput
                    value={draftName}
                    onChange={setDraftName}
                    onSubmit={commitRename}
                    label="Deck name"
                    maxLength={16}
                    placeholder={activeDeck.name}
                    className="flex-1"
                  />
                  <PixelButton variant="primary" size="md" icon="✓" onClick={commitRename}>
                    Save
                  </PixelButton>
                  <PixelButton variant="ghost" size="md" onClick={() => setRenaming(false)}>
                    Cancel
                  </PixelButton>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <PixelButton
                    variant="secondary"
                    size="md"
                    icon="✎"
                    onClick={() => {
                      setDraftName(activeDeck.name);
                      setRenaming(true);
                    }}
                  >
                    Rename
                  </PixelButton>
                  <PixelButton
                    variant="secondary"
                    size="md"
                    icon="+"
                    disabled={decks.length >= MAX_DECKS}
                    onClick={() => createDeck()}
                  >
                    Duplicate
                  </PixelButton>
                  <PixelButton
                    variant="danger"
                    size="md"
                    icon="×"
                    disabled={decks.length <= 1}
                    onClick={() => deleteDeck(activeDeck.id)}
                  >
                    Delete
                  </PixelButton>
                </div>
              )}

              <p className="text-mist/45 mt-3 text-[10px] leading-snug">
                Decks are saved on this device as you edit them — the one selected here is the one
                you take into every match until you pick another. You can save up to {MAX_DECKS}.
              </p>
              <p className="text-mist/45 mt-2 text-[10px] leading-snug">
                There is no rarity rule: three legendaries, three commons or any mix are all legal.
                Higher rarities hit harder but wait longer between uses.
              </p>
            </PixelPanel>
            </div>
          </div>
        </ScreenFrame>
      </div>

      {picking && (
        <CardPicker
          slot={picking}
          equippedId={activeDeck.cards[picking]}
          onPick={(cardId) => {
            equip(activeDeck.id, picking, cardId);
            setPicking(null);
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  );
}
