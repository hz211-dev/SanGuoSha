import React from 'react';
import { Card, Suite, CardType } from '../types';

interface CardProps {
  card: Card;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  isSmall?: boolean; // For displaying in log or opponents hand (backside)
  isBackside?: boolean;
}

const CardComponent: React.FC<CardProps> = ({ card, onClick, selected, disabled, isSmall, isBackside }) => {
  const isRed = card.suite === Suite.HEART || card.suite === Suite.DIAMOND;
  
  if (isBackside) {
    return (
      <div 
        className={`
          rounded-lg border-2 border-stone-600 bg-stone-800 
          shadow-lg flex items-center justify-center
          ${isSmall ? 'w-12 h-16' : 'w-24 h-36'}
          bg-[url('https://www.transparenttextures.com/patterns/dark-leather.png')]
        `}
      >
        <div className="text-stone-600 text-2xl font-serif">General</div>
      </div>
    );
  }

  return (
    <div 
      onClick={!disabled ? onClick : undefined}
      className={`
        relative rounded-lg shadow-xl transition-all duration-200
        ${isSmall ? 'w-16 h-24 text-xs' : 'w-32 h-48'}
        ${selected ? 'ring-4 ring-yellow-400 -translate-y-6' : 'hover:-translate-y-2'}
        ${disabled ? 'opacity-50 cursor-not-allowed grayscale' : 'cursor-pointer'}
        bg-stone-200 text-stone-900 overflow-hidden
        border border-stone-400
      `}
    >
      {/* Header: Rank and Suit */}
      <div className={`absolute top-1 left-2 text-lg font-bold flex flex-col leading-none ${isRed ? 'text-red-700' : 'text-black'}`}>
        <span>{card.rank}</span>
        <span className="text-xl">{card.suite}</span>
      </div>

      {/* Card Name (Vertical usually, but horizontal here for readability) */}
      <div className="absolute top-1/3 left-0 right-0 text-center font-serif font-bold text-xl tracking-widest pointer-events-none select-none">
        {card.name}
      </div>

      {/* Type Badge */}
      <div className="absolute bottom-12 left-0 right-0 text-center">
        <span className={`
          px-2 py-0.5 text-[10px] uppercase font-bold rounded-full text-white
          ${card.type === CardType.BASIC ? 'bg-emerald-700' : ''}
          ${card.type === CardType.SCROLL ? 'bg-indigo-700' : ''}
          ${card.type === CardType.EQUIP ? 'bg-amber-700' : ''}
        `}>
          {card.type}
        </span>
      </div>

      {/* Description */}
      {!isSmall && (
        <div className="absolute bottom-1 left-1 right-1 text-[10px] leading-tight text-center text-stone-600 bg-white/80 p-1 rounded">
          {card.description}
        </div>
      )}
    </div>
  );
};

export default CardComponent;