import React from 'react';
import { Player, Card } from '../types';
import CardComponent from './CardComponent';
import { Heart, Sword } from 'lucide-react';

interface PlayerAreaProps {
  player: Player;
  isOpponent?: boolean;
  isTurn: boolean;
  onCardClick?: (card: Card) => void;
  selectedCardId?: string | null;
  validCardIds?: string[];
}

const PlayerArea: React.FC<PlayerAreaProps> = ({ 
  player, 
  isOpponent = false, 
  isTurn, 
  onCardClick, 
  selectedCardId,
  validCardIds = []
}) => {
  
  const kingdomColors = {
    shu: 'border-red-600 bg-red-900/20',
    wei: 'border-blue-600 bg-blue-900/20',
    wu: 'border-green-600 bg-green-900/20',
    qun: 'border-gray-400 bg-gray-900/20',
  };

  // Health points visuals
  const renderHP = () => {
    const hearts = [];
    for (let i = 0; i < player.character.maxHp; i++) {
      hearts.push(
        <div key={i} className="relative">
           <Heart 
            size={18} 
            className={`
              ${i < player.hp ? 'fill-red-500 text-red-600' : 'fill-gray-800 text-gray-700'}
              transition-colors duration-300
            `} 
           />
        </div>
      );
    }
    return <div className="flex gap-1 mt-2">{hearts}</div>;
  };

  return (
    <div className={`flex ${isOpponent ? 'flex-col-reverse' : 'flex-col'} items-center relative gap-4 transition-all duration-500`}>
      
      {/* Character Portrait Area */}
      <div className={`
        relative w-32 h-48 rounded-xl border-4 shadow-2xl overflow-hidden bg-stone-800 transition-all duration-500
        ${kingdomColors[player.character.kingdom]}
        ${isTurn ? 'ring-4 ring-yellow-400 scale-105' : ''}
      `}>
        <img 
          src={player.character.avatarUrl} 
          alt={player.character.name} 
          className={`w-full h-full object-cover ${!player.isAlive ? 'grayscale brightness-50' : ''}`}
        />
        
        {/* Role Badge */}
        <div className="absolute top-0 left-0 px-2 py-1 bg-black/70 text-white text-xs font-bold rounded-br-lg">
          {player.character.name}
        </div>
        
        {/* Stats Overlay */}
        <div className="absolute bottom-0 w-full bg-gradient-to-t from-black via-black/70 to-transparent p-2">
          {renderHP()}
          <div className="flex gap-3 mt-1 text-[10px] text-stone-300">
            <span className="flex items-center gap-1"><Sword size={10} /> {player.equips.weapon ? player.equips.weapon.name : 'None'}</span>
          </div>
        </div>
      </div>

      {/* Hand Cards */}
      <div className={`
          flex justify-center min-w-[300px]
          ${isOpponent ? 'items-end h-40' : 'items-end h-48'}
      `}>
        {player.hand.map((card, index) => (
          <div 
            key={card.id} 
            style={{ 
              marginLeft: index === 0 ? 0 : '-60px', 
              zIndex: index 
            }}
            className={`transition-all duration-300 ${!isOpponent ? 'hover:z-50 hover:scale-110' : ''}`}
          >
            <CardComponent 
              card={card} 
              isBackside={isOpponent}
              selected={selectedCardId === card.id}
              disabled={!isOpponent && validCardIds.length > 0 && !validCardIds.includes(card.id)}
              onClick={() => onCardClick && onCardClick(card)}
            />
          </div>
        ))}
        {player.hand.length === 0 && (
          <div className="text-stone-500 text-sm italic self-center">No cards</div>
        )}
      </div>
    </div>
  );
};

export default PlayerArea;