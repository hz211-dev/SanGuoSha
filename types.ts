export enum Suite {
  SPADE = '♠',
  HEART = '♥',
  CLUB = '♣',
  DIAMOND = '♦',
}

export enum CardType {
  BASIC = 'Basic',
  SCROLL = 'Scroll', // Tactics
  EQUIP = 'Equipment',
}

export enum CardName {
  SLASH = 'Slash', // Sha
  DODGE = 'Dodge', // Shan
  PEACH = 'Peach', // Tao
  DUEL = 'Duel', // Jue Dou
  SABOTAGE = 'Sabotage', // Guo He Chai Qiao
  THEFT = 'Theft', // Shun Shou Qian Yang
  BARBARIANS = 'Barbarians', // Nan Man Ru Qin
  ARCHERY = 'Archery', // Wan Jian Qi Fa
}

export interface Card {
  id: string;
  name: CardName;
  suite: Suite;
  rank: string; // A, 2-10, J, Q, K
  type: CardType;
  description: string;
}

export enum CharacterId {
  LIU_BEI = 'Liu Bei',
  CAO_CAO = 'Cao Cao',
  SUN_QUAN = 'Sun Quan',
  LU_BU = 'Lu Bu',
}

export interface Character {
  id: CharacterId;
  name: string;
  maxHp: number;
  kingdom: 'shu' | 'wei' | 'wu' | 'qun';
  avatarUrl: string;
}

export interface Player {
  id: 'player' | 'ai';
  character: Character;
  hp: number;
  hand: Card[];
  equips: {
    weapon?: Card;
    armor?: Card;
    horseOff?: Card;
    horseDef?: Card;
  };
  isAlive: boolean;
}

export type GamePhase = 
  | 'SETUP' 
  | 'PLAYER_DRAW' 
  | 'PLAYER_PLAY' 
  | 'PLAYER_DISCARD' 
  | 'AI_THINKING' 
  | 'AI_PLAY' 
  | 'AI_DISCARD' 
  | 'GAME_OVER'
  | 'RESOLVING_INTERACTION'; // E.g., Player played Slash, waiting for AI Dodge

export interface LogEntry {
  id: string;
  text: string;
  type: 'info' | 'danger' | 'success' | 'system';
}

export interface AIAction {
  action: 'PLAY' | 'END' | 'DISCARD' | 'RESPOND';
  cardId?: string;
  targetId?: string;
  reasoning?: string;
}