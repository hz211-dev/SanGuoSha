import { Card, CardName, CardType, Character, CharacterId, Suite } from './types';

export const CHARACTERS: Record<CharacterId, Character> = {
  [CharacterId.LIU_BEI]: {
    id: CharacterId.LIU_BEI,
    name: 'Liu Bei',
    maxHp: 4,
    kingdom: 'shu',
    avatarUrl: 'https://picsum.photos/id/1062/200/200', // Placeholder
  },
  [CharacterId.CAO_CAO]: {
    id: CharacterId.CAO_CAO,
    name: 'Cao Cao',
    maxHp: 4,
    kingdom: 'wei',
    avatarUrl: 'https://picsum.photos/id/1025/200/200',
  },
  [CharacterId.SUN_QUAN]: {
    id: CharacterId.SUN_QUAN,
    name: 'Sun Quan',
    maxHp: 4,
    kingdom: 'wu',
    avatarUrl: 'https://picsum.photos/id/1024/200/200',
  },
  [CharacterId.LU_BU]: {
    id: CharacterId.LU_BU,
    name: 'Lu Bu',
    maxHp: 5,
    kingdom: 'qun',
    avatarUrl: 'https://picsum.photos/id/1074/200/200',
  },
};

// A simplified 1v1 deck (approx 40 cards for better gameplay flow)
export const generateDeck = (): Card[] => {
  const deck: Card[] = [];
  let idCounter = 1;

  const addCard = (name: CardName, type: CardType, suite: Suite, rank: string, count: number, desc: string) => {
    for (let i = 0; i < count; i++) {
      deck.push({
        id: `c-${idCounter++}`,
        name,
        type,
        suite,
        rank,
        description: desc,
      });
    }
  };

  // Basic Cards
  addCard(CardName.SLASH, CardType.BASIC, Suite.SPADE, '7', 5, 'Deal 1 damage to target.');
  addCard(CardName.SLASH, CardType.BASIC, Suite.HEART, '10', 3, 'Deal 1 damage to target.');
  addCard(CardName.SLASH, CardType.BASIC, Suite.DIAMOND, 'K', 3, 'Deal 1 damage to target.');
  addCard(CardName.SLASH, CardType.BASIC, Suite.CLUB, '8', 4, 'Deal 1 damage to target.');
  
  addCard(CardName.DODGE, CardType.BASIC, Suite.DIAMOND, '2', 4, 'Evade a Slash attack.');
  addCard(CardName.DODGE, CardType.BASIC, Suite.HEART, 'K', 3, 'Evade a Slash attack.');
  
  addCard(CardName.PEACH, CardType.BASIC, Suite.HEART, 'Q', 4, 'Recover 1 HP.');

  // Scrolls
  addCard(CardName.DUEL, CardType.SCROLL, Suite.SPADE, 'A', 2, 'Both players discard Slash repeatedly. First to fail takes damage.');
  addCard(CardName.SABOTAGE, CardType.SCROLL, Suite.SPADE, '3', 2, 'Discard 1 card from opponent (hand or equip).');
  addCard(CardName.THEFT, CardType.SCROLL, Suite.DIAMOND, '4', 2, 'Steal 1 card from opponent.');
  addCard(CardName.BARBARIANS, CardType.SCROLL, Suite.CLUB, '7', 1, 'All other players must play Slash or take damage.');
  addCard(CardName.ARCHERY, CardType.SCROLL, Suite.HEART, 'A', 1, 'All other players must play Dodge or take damage.');

  return shuffle(deck);
};

function shuffle(array: Card[]): Card[] {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}
