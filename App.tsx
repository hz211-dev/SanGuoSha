import React, { useState, useEffect, useReducer, useCallback, useRef } from 'react';
import { 
  Player, Card, GamePhase, LogEntry, CharacterId, CardName, CardType,
  AIAction
} from './types';
import { CHARACTERS, generateDeck } from './constants';
import PlayerArea from './components/PlayerArea';
import GameLog from './components/GameLog';
import { getAIMove } from './services/geminiService';
import { RefreshCw, Play, ShieldAlert } from 'lucide-react';

// --- Reducer State & Actions ---
interface GameState {
  human: Player;
  ai: Player;
  deck: Card[];
  discardPile: Card[];
  phase: GamePhase;
  currentPlayerId: 'player' | 'ai';
  logs: LogEntry[];
  turnCount: number;
  pendingInteraction: {
    sourceId: string;
    cardName: CardName;
    damage?: number;
  } | null;
}

type Action =
  | { type: 'INIT_GAME'; heroId: CharacterId }
  | { type: 'DRAW_CARDS'; playerId: 'player' | 'ai'; count: number }
  | { type: 'NEXT_PHASE'; phase: GamePhase }
  | { type: 'PLAY_CARD'; playerId: 'player' | 'ai'; cardId: string; targetId?: 'player' | 'ai' }
  | { type: 'DISCARD_CARD'; playerId: 'player' | 'ai'; cardId: string }
  | { type: 'TAKE_DAMAGE'; playerId: 'player' | 'ai'; amount: number }
  | { type: 'HEAL'; playerId: 'player' | 'ai'; amount: number }
  | { type: 'LOG'; message: string; logType?: LogEntry['type'] }
  | { type: 'SET_INTERACTION'; interaction: GameState['pendingInteraction'] }
  | { type: 'RESOLVE_INTERACTION'; success: boolean } // true = countered (dodged), false = failed (hit)
  | { type: 'GAME_OVER'; winnerId: 'player' | 'ai' };

const initialState: GameState = {
  human: { id: 'player', character: CHARACTERS[CharacterId.LIU_BEI], hp: 4, hand: [], equips: {}, isAlive: true },
  ai: { id: 'ai', character: CHARACTERS[CharacterId.CAO_CAO], hp: 4, hand: [], equips: {}, isAlive: true },
  deck: [],
  discardPile: [],
  phase: 'SETUP',
  currentPlayerId: 'player',
  logs: [],
  turnCount: 0,
  pendingInteraction: null,
};

function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'INIT_GAME':
      const fullDeck = generateDeck();
      
      // Fully reset players
      const humanChar = CHARACTERS[action.heroId];
      const aiChar = CHARACTERS[CharacterId.CAO_CAO];

      const startHandSize = 4;
      const hand1 = fullDeck.splice(0, startHandSize);
      const hand2 = fullDeck.splice(0, startHandSize);
      
      return {
        ...initialState,
        deck: fullDeck,
        human: { 
          ...initialState.human, 
          character: humanChar, 
          hp: humanChar.maxHp, 
          hand: hand1,
          isAlive: true 
        },
        ai: { 
          ...initialState.ai, 
          character: aiChar, 
          hp: aiChar.maxHp, 
          hand: hand2, 
          isAlive: true 
        },
        phase: 'PLAYER_DRAW',
        discardPile: [], // Ensure discard is empty
        logs: [{ id: Date.now().toString(), text: 'Game Start! You vs AI.', type: 'system' }]
      };

    case 'DRAW_CARDS': {
      const { playerId, count } = action;
      let newDeck = [...state.deck];
      let newDiscard = [...state.discardPile];
      const drawnCards: Card[] = [];

      for (let i = 0; i < count; i++) {
        if (newDeck.length === 0) {
           if (newDiscard.length === 0) break;
           // Reshuffle
           newDeck = newDiscard.sort(() => Math.random() - 0.5);
           newDiscard = [];
           // Add log about reshuffle?
        }
        const card = newDeck.shift();
        if (card) drawnCards.push(card);
      }

      const targetPlayer = playerId === 'player' ? state.human : state.ai;
      const updatedPlayer = { ...targetPlayer, hand: [...targetPlayer.hand, ...drawnCards] };

      return {
        ...state,
        deck: newDeck,
        discardPile: newDiscard,
        human: playerId === 'player' ? updatedPlayer : state.human,
        ai: playerId === 'ai' ? updatedPlayer : state.ai,
      };
    }

    case 'LOG':
      return {
        ...state,
        logs: [...state.logs, { 
          id: Date.now().toString() + Math.random(), 
          text: action.message, 
          type: action.logType || 'info' 
        }]
      };

    case 'NEXT_PHASE':
      // CRITICAL FIX: If game is over, do not allow phase transition
      if (state.phase === 'GAME_OVER') return state;
      return { ...state, phase: action.phase };

    case 'PLAY_CARD': {
      const p = action.playerId === 'player' ? state.human : state.ai;
      const cardToPlay = p.hand.find(c => c.id === action.cardId);
      if (!cardToPlay) return state;

      // Remove card from hand, add to discard (unless equipped, simplifying for now)
      const newHand = p.hand.filter(c => c.id !== action.cardId);
      const updatedPlayer = { ...p, hand: newHand };

      return {
        ...state,
        human: action.playerId === 'player' ? updatedPlayer : state.human,
        ai: action.playerId === 'ai' ? updatedPlayer : state.ai,
        discardPile: [...state.discardPile, cardToPlay]
      };
    }

    case 'DISCARD_CARD': {
        // Similar to Play, but specifically for discard phase
        const p = action.playerId === 'player' ? state.human : state.ai;
        const newHand = p.hand.filter(c => c.id !== action.cardId);
        const card = p.hand.find(c => c.id === action.cardId);
        return {
            ...state,
            human: action.playerId === 'player' ? { ...p, hand: newHand } : state.human,
            ai: action.playerId === 'ai' ? { ...p, hand: newHand } : state.ai,
            discardPile: card ? [...state.discardPile, card] : state.discardPile
        };
    }

    case 'TAKE_DAMAGE': {
      const p = action.playerId === 'player' ? state.human : state.ai;
      const newHp = Math.max(0, p.hp - action.amount);
      const isDead = newHp === 0;
      
      // CRITICAL FIX: Immutable log update
      const newLogs = [...state.logs];
      let nextPhase = state.phase;

      if (isDead) {
          nextPhase = 'GAME_OVER';
          newLogs.push({ 
            id: Date.now().toString() + '-go', 
            text: `Game Over! ${action.playerId === 'player' ? 'You died' : 'AI died'}.`, 
            type: 'danger' 
          });
      }
      
      return {
        ...state,
        human: action.playerId === 'player' ? { ...p, hp: newHp, isAlive: !isDead } : state.human,
        ai: action.playerId === 'ai' ? { ...p, hp: newHp, isAlive: !isDead } : state.ai,
        phase: nextPhase,
        logs: newLogs
      };
    }

    case 'HEAL': {
        const p = action.playerId === 'player' ? state.human : state.ai;
        const newHp = Math.min(p.character.maxHp, p.hp + action.amount);
        return {
            ...state,
            human: action.playerId === 'player' ? { ...p, hp: newHp } : state.human,
            ai: action.playerId === 'ai' ? { ...p, hp: newHp } : state.ai,
        };
    }

    case 'SET_INTERACTION':
        return { ...state, pendingInteraction: action.interaction };
    
    case 'RESOLVE_INTERACTION':
        return { ...state, pendingInteraction: null };

    default:
      return state;
  }
}

// --- Main Component ---

const App: React.FC = () => {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [hasPlayedSlash, setHasPlayedSlash] = useState(false); // Restriction: 1 slash per turn

  // Use a Ref to keep track of the current state inside async effects/callbacks
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Start Game
  useEffect(() => {
    dispatch({ type: 'INIT_GAME', heroId: CharacterId.LIU_BEI });
  }, []);

  const handleRestart = () => {
    setSelectedCardId(null);
    setHasPlayedSlash(false);
    dispatch({ type: 'INIT_GAME', heroId: CharacterId.LIU_BEI });
  };

  // --- Continuous Monitor: Player Discard Phase ---
  // Triggers whenever hand size or hp changes during discard phase
  useEffect(() => {
    if (state.phase === 'PLAYER_DISCARD') {
      if (state.human.hand.length <= state.human.hp) {
        // Use a small timeout to allow UI to update before switching phase
        const timer = setTimeout(() => {
          dispatch({ type: 'LOG', message: "Turn End.", logType: 'info' });
          dispatch({ type: 'NEXT_PHASE', phase: 'AI_THINKING' });
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [state.phase, state.human.hand.length, state.human.hp]);

  // --- Core Game Loop Effect ---
  useEffect(() => {
    const runPhase = async () => {
      if (state.phase === 'GAME_OVER') return;

      // 1. PLAYER DRAW
      if (state.phase === 'PLAYER_DRAW') {
        dispatch({ type: 'LOG', message: "--- Your Turn ---", logType: 'system' });
        dispatch({ type: 'DRAW_CARDS', playerId: 'player', count: 2 });
        setHasPlayedSlash(false);
        dispatch({ type: 'NEXT_PHASE', phase: 'PLAYER_PLAY' });
      }

      // 2. PLAYER DISCARD
      // Now handled by the dedicated monitor useEffect above.

      // 3. AI THINKING & PLAY
      else if (state.phase === 'AI_THINKING') {
        dispatch({ type: 'LOG', message: "--- Opponent Turn ---", logType: 'system' });
        // Short delay for visual pacing
        await new Promise(r => setTimeout(r, 1000));
        dispatch({ type: 'DRAW_CARDS', playerId: 'ai', count: 2 });
        dispatch({ type: 'NEXT_PHASE', phase: 'AI_PLAY' });
      }
      
      else if (state.phase === 'AI_PLAY') {
          // Call Gemini API loop until it says 'END'
          await performAITurn();
      }

      else if (state.phase === 'AI_DISCARD') {
          // FIX: Avoid while loop with stale state. Calculate exact excess and discard.
          const currentAI = state.ai;
          const excess = currentAI.hand.length - currentAI.hp;
          
          if (excess > 0) {
              // Discard the first N cards to satisfy the requirement
              for(let i = 0; i < excess; i++) {
                  const cardToDiscard = currentAI.hand[i];
                  if (cardToDiscard) {
                      dispatch({ type: 'DISCARD_CARD', playerId: 'ai', cardId: cardToDiscard.id });
                      dispatch({ type: 'LOG', message: `AI discarded ${cardToDiscard.name}.` });
                  }
              }
          }
          dispatch({ type: 'NEXT_PHASE', phase: 'PLAYER_DRAW' });
      }
    };

    runPhase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  // --- AI Logic Wrapper ---
  const performAITurn = async () => {
    // AI Turn Loop
    // CRITICAL: We must use stateRef.current inside this async loop to see updates
    // because 'state' in closure will be stale.

    let aiContinue = true;
    let slashed = false; // Local tracker for this turn execution

    while (aiContinue) {
        const currentState = stateRef.current;

        // If phase changed (e.g. to RESOLVING_INTERACTION or GAME_OVER), stop this loop
        if (currentState.phase !== 'AI_PLAY') {
            aiContinue = false;
            break;
        }

        // Recalculate valid moves based on LATEST hand
        const aiHand = currentState.ai.hand;
        const validCardIds = aiHand.filter(c => {
            if (c.name === CardName.SLASH && slashed) return false; // Limit 1 slash
            return true;
        }).map(c => c.id);
        
        if (validCardIds.length === 0) {
            aiContinue = false;
            break;
        }

        dispatch({ type: 'LOG', message: "AI is thinking...", logType: 'system' });
        
        // Use LATEST state for prompt
        const move: AIAction = await getAIMove(currentState.ai, currentState.human, validCardIds);

        if (move.action === 'END') {
            aiContinue = false;
        } else if (move.action === 'PLAY' && move.cardId) {
            // Verify card exists in CURRENT hand
            const card = stateRef.current.ai.hand.find(c => c.id === move.cardId);
            
            if (card) {
                dispatch({ type: 'LOG', message: `AI plays ${card.name}. Reasoning: ${move.reasoning}` });
                dispatch({ type: 'PLAY_CARD', playerId: 'ai', cardId: card.id });
                
                if (card.name === CardName.SLASH) {
                    slashed = true;
                    await handleSlash('ai');
                    // Note: handleSlash might change phase to RESOLVING_INTERACTION.
                    // The next loop iteration will catch this check and break.
                } else if (card.name === CardName.PEACH) {
                    dispatch({ type: 'HEAL', playerId: 'ai', amount: 1 });
                } else if (card.name === CardName.DUEL) {
                    await handleSlash('ai', true); 
                } else if (card.name === CardName.THEFT || card.name === CardName.SABOTAGE) {
                     // Use CURRENT human state
                     const humanHand = stateRef.current.human.hand;
                     if (humanHand.length > 0) {
                         const randomCard = humanHand[Math.floor(Math.random() * humanHand.length)];
                         dispatch({ type: 'DISCARD_CARD', playerId: 'player', cardId: randomCard.id });
                         dispatch({ type: 'LOG', message: `AI used ${card.name} on your ${randomCard.name}!` });
                     }
                }
                
                // Delay between moves, also allows React state updates to propagate to ref
                await new Promise(r => setTimeout(r, 2000));
            } else {
                // AI tried to play a card it no longer has (stale move?)
                console.warn("AI tried to play missing card ID:", move.cardId);
            }
        } else {
            aiContinue = false; 
        }
    }
    
    // Only advance phase if we are still in AI_PLAY
    if (stateRef.current.phase === 'AI_PLAY') {
        dispatch({ type: 'NEXT_PHASE', phase: 'AI_DISCARD' });
    }
  };

  // --- Interaction Handlers ---
  
  // Triggered when attacker plays Slash
  const handleSlash = async (attackerId: 'player' | 'ai', isDuel = false) => {
      const targetId = attackerId === 'player' ? 'ai' : 'player';
      const cardName = isDuel ? CardName.DUEL : CardName.SLASH;
      
      dispatch({ 
          type: 'SET_INTERACTION', 
          interaction: { sourceId: attackerId, cardName: cardName } 
      });

      if (targetId === 'ai') {
          // Ask AI to dodge
          dispatch({ type: 'LOG', message: isDuel ? "Waiting for AI to Duel back..." : `Waiting for AI to Dodge...` });
          
          // Use CURRENT state for AI Dodge check
          const currentAIHand = stateRef.current.ai.hand;
          // If Slash, AI needs Dodge. If Duel, AI needs Slash.
          const requiredCard = isDuel ? CardName.SLASH : CardName.DODGE;
          const responseCard = currentAIHand.find(c => c.name === requiredCard); 
          
          await new Promise(r => setTimeout(r, 1000));
          
          if (responseCard) {
              dispatch({ type: 'PLAY_CARD', playerId: 'ai', cardId: responseCard.id });
              dispatch({ type: 'LOG', message: `AI played ${responseCard.name}!`, logType: 'success' });
              dispatch({ type: 'RESOLVE_INTERACTION', success: true }); 

          } else {
              dispatch({ type: 'LOG', message: "AI took damage!", logType: 'success' });
              dispatch({ type: 'TAKE_DAMAGE', playerId: 'ai', amount: 1 });
              dispatch({ type: 'RESOLVE_INTERACTION', success: false }); // Hit
          }
      } else {
          // Player needs to respond
          const msg = isDuel ? "DUEL! Play a Slash to fight back!" : "ATTACK! Play Dodge to evade!";
          dispatch({ type: 'LOG', message: `WARNING: ${msg}`, logType: 'danger' });
          dispatch({ type: 'NEXT_PHASE', phase: 'RESOLVING_INTERACTION' });
      }
  };

  // --- Player Inputs ---

  const handlePlayerCardClick = (card: Card) => {
    if (state.phase !== 'PLAYER_PLAY' && state.phase !== 'PLAYER_DISCARD' && state.phase !== 'RESOLVING_INTERACTION') return;
    
    if (selectedCardId === card.id) {
        setSelectedCardId(null); // Deselect
        return;
    }
    
    setSelectedCardId(card.id);
  };

  const handleConfirmAction = () => {
      if (!selectedCardId) return;
      const card = state.human.hand.find(c => c.id === selectedCardId);
      if (!card) return;

      // CASE 1: Responding to Interaction
      if (state.phase === 'RESOLVING_INTERACTION' && state.pendingInteraction) {
          const incoming = state.pendingInteraction.cardName;
          
          let requiredResponse = CardName.DODGE;
          if (incoming === CardName.DUEL) requiredResponse = CardName.SLASH;
          
          if (card.name === requiredResponse) {
              dispatch({ type: 'PLAY_CARD', playerId: 'player', cardId: card.id });
              dispatch({ type: 'LOG', message: `You played ${card.name}!`, logType: 'success' });
              dispatch({ type: 'RESOLVE_INTERACTION', success: true });
              
              // Return control to whoever turn it was (usually AI_PLAY if responding)
              dispatch({ type: 'NEXT_PHASE', phase: 'AI_PLAY' }); 
              
              setSelectedCardId(null);
              return;
          } else {
              dispatch({ type: 'LOG', message: `Invalid card! You need to play ${requiredResponse}.`, logType: 'danger' });
              return;
          }
      }

      // CASE 2: Discard Phase
      if (state.phase === 'PLAYER_DISCARD') {
          dispatch({ type: 'DISCARD_CARD', playerId: 'player', cardId: card.id });
          dispatch({ type: 'LOG', message: `Discarded ${card.name}` });
          setSelectedCardId(null);
          return;
      }

      // CASE 3: Normal Play Phase
      if (state.phase === 'PLAYER_PLAY') {
          // Slash Limit Check
          if (card.name === CardName.SLASH && hasPlayedSlash) {
              dispatch({ type: 'LOG', message: "You can only play one Slash per turn.", logType: 'danger' });
              return;
          }

          dispatch({ type: 'PLAY_CARD', playerId: 'player', cardId: card.id });
          dispatch({ type: 'LOG', message: `You played ${card.name}` });

          if (card.name === CardName.SLASH) {
              setHasPlayedSlash(true);
              handleSlash('player');
          } else if (card.name === CardName.PEACH) {
              if (state.human.hp < state.human.character.maxHp) {
                dispatch({ type: 'HEAL', playerId: 'player', amount: 1 });
                dispatch({ type: 'LOG', message: "You recovered 1 HP.", logType: 'success' });
              } else {
                  dispatch({ type: 'LOG', message: "HP is full. Peach wasted.", logType: 'info' });
              }
          } else if (card.name === CardName.DUEL) {
              handleSlash('player', true);
          } else if (card.name === CardName.SABOTAGE || card.name === CardName.THEFT) {
              if (state.ai.hand.length > 0) {
                   const randomIdx = Math.floor(Math.random() * state.ai.hand.length);
                   const targetCard = state.ai.hand[randomIdx];
                   dispatch({ type: 'DISCARD_CARD', playerId: 'ai', cardId: targetCard.id });
                   dispatch({ type: 'LOG', message: `You discarded AI's card.`, logType: 'success' });
              }
          }
          
          setSelectedCardId(null);
      }
  };

  const handleTakeDamage = () => {
      // Player chooses to take damage instead of dodging (or can't dodge)
      if (state.phase === 'RESOLVING_INTERACTION') {
          dispatch({ type: 'TAKE_DAMAGE', playerId: 'player', amount: 1 });
          dispatch({ type: 'RESOLVE_INTERACTION', success: false });
          
          // IMPORTANT: Even if we try to go to AI_PLAY, the reducer will BLOCK it if TAKE_DAMAGE resulted in GAME_OVER.
          dispatch({ type: 'NEXT_PHASE', phase: 'AI_PLAY' });
      }
  };

  const endPlayerTurn = () => {
      if (state.phase === 'PLAYER_PLAY') {
          dispatch({ type: 'NEXT_PHASE', phase: 'PLAYER_DISCARD' });
      }
  };

  // --- Render Helpers ---

  const getInstructions = () => {
      switch (state.phase) {
          case 'PLAYER_PLAY': return "Select a card to play. Click 'End Turn' when done.";
          case 'PLAYER_DISCARD': return `Discard ${Math.max(0, state.human.hand.length - state.human.hp)} cards to match your HP.`;
          case 'RESOLVING_INTERACTION': 
             if (state.pendingInteraction?.cardName === CardName.DUEL) return "Play SLASH to fight back!";
             return "Play DODGE to evade attack!";
          case 'AI_THINKING':
          case 'AI_PLAY': return "Opponent is acting...";
          default: return "";
      }
  };

  const validCardsForPhase = state.human.hand.filter(c => {
      if (state.phase === 'RESOLVING_INTERACTION') {
          // Check what is needed based on pending interaction
          const incoming = state.pendingInteraction?.cardName;
          if (incoming === CardName.DUEL) return c.name === CardName.SLASH;
          // Default to Dodge for Slash/Archery
          return c.name === CardName.DODGE;
      }
      if (state.phase === 'PLAYER_PLAY') {
          if (hasPlayedSlash && c.name === CardName.SLASH) return false; // Visual disable
          return true;
      }
      return true;
  }).map(c => c.id);


  return (
    <div className="min-h-screen bg-stone-900 text-stone-100 font-sans flex flex-col items-center p-2 md:p-4 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]">
      
      {/* --- Header --- */}
      <header className="w-full max-w-6xl flex justify-between items-center mb-4 bg-stone-800/90 p-3 rounded-lg shadow-lg border border-stone-600 sticky top-0 z-50">
          <div className="flex items-center gap-2">
              <div className="bg-red-800 text-white font-serif font-bold px-3 py-1 rounded shadow">SanGuoSha Duel</div>
              <span className="hidden sm:inline text-stone-400 text-sm">AI Powered V1.0</span>
          </div>
          <div className="text-lg font-bold text-yellow-500">
             Phase: {state.phase.replace('_', ' ')}
          </div>
      </header>

      {/* --- Battlefield --- */}
      <main className="relative w-full max-w-6xl min-h-[700px] h-[85vh] bg-stone-800/50 rounded-2xl border border-stone-700 shadow-2xl flex flex-col justify-between p-4 md:p-6">
          
          {/* Background Art Overlay */}
          <div className="absolute inset-0 opacity-10 pointer-events-none flex items-center justify-center overflow-hidden">
             <div className="w-96 h-96 rounded-full bg-stone-500 blur-3xl"></div>
          </div>

          {/* --- Opponent Area (AI) --- */}
          <div className="w-full flex justify-center z-10">
             <PlayerArea 
                player={state.ai} 
                isOpponent 
                isTurn={state.phase.startsWith('AI')} 
             />
          </div>

          {/* --- Center Info Area --- */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl pointer-events-none z-0 flex justify-between px-10 opacity-60">
               <div className="border-2 border-dashed border-stone-600 w-20 h-32 rounded-lg flex items-center justify-center text-xs">Deck</div>
               <div className="border-2 border-dashed border-stone-600 w-20 h-32 rounded-lg flex items-center justify-center text-xs">Discard</div>
          </div>

          {/* --- Game Log & Action Buttons --- */}
          <div className="absolute top-1/2 right-4 transform -translate-y-1/2 w-64 z-20 flex flex-col gap-4 max-h-[50%]">
             <GameLog logs={state.logs} />
             
             {/* Action Panel */}
             <div className="bg-stone-800 p-4 rounded-lg border border-stone-600 shadow-lg flex flex-col gap-2">
                 <div className="text-xs text-yellow-400 mb-2 h-8 leading-tight">{getInstructions()}</div>
                 
                 {state.phase === 'PLAYER_PLAY' && (
                     <button 
                        onClick={endPlayerTurn}
                        className="w-full py-2 bg-stone-700 hover:bg-stone-600 text-white rounded flex items-center justify-center gap-2 transition-colors text-sm font-bold"
                     >
                         <RefreshCw size={16} /> End Phase
                     </button>
                 )}

                 {state.phase === 'RESOLVING_INTERACTION' && (
                     <button 
                        onClick={handleTakeDamage}
                        className="w-full py-2 bg-red-700 hover:bg-red-600 text-white rounded flex items-center justify-center gap-2 transition-colors text-sm font-bold"
                     >
                         <ShieldAlert size={16} /> Take Damage
                     </button>
                 )}

                 <button 
                    onClick={handleConfirmAction}
                    disabled={!selectedCardId}
                    className={`
                        w-full py-3 rounded font-bold text-white flex items-center justify-center gap-2 transition-all shadow
                        ${selectedCardId ? 'bg-amber-600 hover:bg-amber-500 shadow-lg shadow-amber-900/50' : 'bg-stone-700 opacity-50 cursor-not-allowed'}
                    `}
                 >
                    <Play size={16} fill="white" /> 
                    {state.phase === 'PLAYER_DISCARD' ? 'Confirm Discard' : 'Play Card'}
                 </button>
             </div>
          </div>

          {/* --- Player Area (Human) --- */}
          <div className="w-full flex justify-center z-10 mt-auto">
             <PlayerArea 
                player={state.human} 
                isTurn={state.phase.startsWith('PLAYER')} 
                onCardClick={handlePlayerCardClick}
                selectedCardId={selectedCardId}
                validCardIds={validCardsForPhase}
             />
          </div>

      </main>

      {/* --- Footer / Rules Hint --- */}
      <footer className="mt-4 text-stone-500 text-xs text-center">
         Tips: Slash (Attack), Dodge (Defend), Peach (Heal). Sabotage/Theft removes opponent cards.
      </footer>

      {/* --- Game Over Modal --- */}
      {state.phase === 'GAME_OVER' && (
          <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center backdrop-blur-sm">
              <div className="bg-stone-800 p-8 rounded-2xl border-4 border-yellow-600 shadow-2xl text-center max-w-md">
                  <h1 className="text-4xl font-serif text-yellow-500 mb-4">Game Over</h1>
                  <p className="text-xl text-white mb-6">
                      {state.human.isAlive ? "Victory! The Han Dynasty is restored!" : "Defeat! You have fallen in battle."}
                  </p>
                  <button 
                    onClick={handleRestart}
                    className="px-6 py-3 bg-red-700 hover:bg-red-600 text-white rounded-lg font-bold transition-colors"
                  >
                      Play Again
                  </button>
              </div>
          </div>
      )}

    </div>
  );
};

export default App;