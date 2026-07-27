import { CARD_BY_ID, CARD_KIND_LABEL, RARITY_LABEL } from '@/data/cards';
import { ScreenFrame } from '@/components/ui/ScreenFrame';
import { PixelPanel } from '@/components/ui/PixelPanel';
import { PixelButton } from '@/components/ui/PixelButton';
import { PixelBadge } from '@/components/ui/PixelBadge';
import { PixelBar } from '@/components/ui/PixelBar';
import { CardTile } from '@/components/cards/CardTile';
import { useNavigation } from '@/state/NavigationContext';

export interface CardDetailScreenProps {
  cardId: string;
}

/**
 * PLACEHOLDER(Block 5): the collection grid already routes here, so the screen
 * exists with the real layout skeleton — enlarged card, progress toward the next
 * level, upgrade actions. Block 5 owns the level-up animation, the essence /
 * duplicate economy and the usage history.
 */
export function CardDetailScreen({ cardId }: CardDetailScreenProps) {
  const { back } = useNavigation();
  const card = CARD_BY_ID[cardId];

  if (!card) {
    return (
      <div className="bg-abyss h-full w-full">
        <ScreenFrame title="Card" onBack={back}>
          <p className="text-mist/60 py-12 text-center text-[11px]">That card does not exist.</p>
        </ScreenFrame>
      </div>
    );
  }

  const progress = card.copiesForNextLevel ? card.copies / card.copiesForNextLevel : 0;

  return (
    <div className="bg-abyss relative h-full w-full overflow-hidden">
      <ScreenFrame
        title={card.name}
        subtitle={`${RARITY_LABEL[card.rarity]} · ${CARD_KIND_LABEL[card.kind]}`}
        onBack={back}
        aside={<PixelBadge tone="gold">Level {card.level}</PixelBadge>}
      >
        <div className="grid gap-3 pb-4 md:grid-cols-[minmax(0,260px)_1fr]">
          <div className="mx-auto w-full max-w-[260px]">
            <CardTile card={card} showProgress={false} />
          </div>

          <div className="flex flex-col gap-3">
            <PixelPanel title="Effect" variant="default">
              <p className="text-[12px] leading-relaxed">{card.description}</p>
            </PixelPanel>

            <PixelPanel title="Progress" variant="default">
              <PixelBar
                value={progress}
                tone="surf"
                segments={20}
                height="md"
                label={`To level ${Math.min(card.level + 1, card.maxLevel)}`}
                readout={`${card.copies}/${card.copiesForNextLevel} copies`}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <PixelButton variant="gold" size="md" icon="◆" disabled>
                  Upgrade
                </PixelButton>
                <PixelButton variant="secondary" size="md" disabled>
                  Use essence
                </PixelButton>
              </div>
              <p className="text-mist/50 mt-2 text-[10px] leading-snug">
                Upgrades, essence and the level-up animation arrive with the card progression block.
              </p>
            </PixelPanel>
          </div>
        </div>
      </ScreenFrame>
    </div>
  );
}
