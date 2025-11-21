import { GoogleGenAI, Type } from "@google/genai";
import { Player, Card, CardName, AIAction } from '../types';

let genAI: GoogleGenAI | null = null;

if (process.env.API_KEY) {
  genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
}

// Helper to convert game state to a prompt string
const serializeGameState = (aiPlayer: Player, humanPlayer: Player, interactionType?: string): string => {
  const handStr = aiPlayer.hand.map(c => `${c.name} (ID:${c.id})`).join(', ');
  
  return `
    You are playing SanGuoSha (Three Kingdoms Kill). You are the AI.
    
    Your State:
    - Character: ${aiPlayer.character.name}
    - HP: ${aiPlayer.hp}/${aiPlayer.character.maxHp}
    - Hand: [${handStr}]
    
    Opponent State:
    - Character: ${humanPlayer.character.name}
    - HP: ${humanPlayer.hp}/${humanPlayer.character.maxHp}
    - Cards in Hand: ${humanPlayer.hand.length}
    
    Current Situation: ${interactionType ? `You are responding to: ${interactionType}` : 'It is your turn to play cards.'}
  `;
};

export const getAIMove = async (
  aiPlayer: Player,
  humanPlayer: Player,
  validMoves: string[], // List of valid card IDs or 'END'
  interactionType?: string // e.g., 'SLASHED' (AI needs to dodge) or undefined (AI turn)
): Promise<AIAction> => {
  if (!genAI) {
    console.error("API Key missing");
    // Fallback logic if no key
    if (interactionType === 'SLASHED') {
         const dodge = aiPlayer.hand.find(c => c.name === CardName.DODGE);
         if (dodge) return { action: 'RESPOND', cardId: dodge.id, reasoning: 'Fallback Dodge (No API)' };
         return { action: 'RESPOND', reasoning: 'No dodge available (No API)' };
    }
    return { action: 'END', reasoning: 'No API Key' };
  }

  const systemInstruction = `
    You are an expert SanGuoSha player. Your goal is to defeat the opponent.
    Rules:
    1. 'Slash' deals damage. Requires opponent to play 'Dodge'.
    2. 'Peach' heals 1 HP. Use it if HP < MaxHP.
    3. 'Duel' requires opponent to play Slash, then you, etc.
    4. 'Sabotage' discards enemy card.
    5. 'Theft' steals enemy card.
    
    Output STRICT JSON.
    Schema: { action: "PLAY" | "END" | "DISCARD" | "RESPOND", cardId?: string, targetId?: "player", reasoning: string }
    
    Strategies:
    - If responding to SLASH, you MUST play DODGE if you have it. If not, return action: "RESPOND" with no card (take damage).
    - If it is your turn:
      - Use Peach if HP is low.
      - Use offensive cards (Slash, Duel) if available.
      - If you have multiple offensive options, prioritize Scroll cards first.
      - If you cannot or do not want to play more, return "END".
      - You can only play ONE Slash per turn unless equipped with Crossbow (assume no crossbow for now).
    
    Valid Moves (Card IDs you can use): [${validMoves.join(', ')}]
  `;

  const userPrompt = serializeGameState(aiPlayer, humanPlayer, interactionType);

  try {
    const result = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: { type: Type.STRING, enum: ["PLAY", "END", "DISCARD", "RESPOND"] },
            cardId: { type: Type.STRING },
            targetId: { type: Type.STRING },
            reasoning: { type: Type.STRING },
          },
          required: ["action", "reasoning"],
        }
      }
    });

    const responseText = result.text;
    if (!responseText) throw new Error("Empty response");
    return JSON.parse(responseText) as AIAction;

  } catch (error) {
    console.error("Gemini Error:", error);
    // Fallback AI: simplistic logic
    if (interactionType === 'SLASHED') {
       const dodge = aiPlayer.hand.find(c => c.name === CardName.DODGE);
       if (dodge) return { action: 'RESPOND', cardId: dodge.id, reasoning: 'Fallback Dodge' };
       return { action: 'RESPOND', reasoning: 'No dodge available' };
    }
    return { action: 'END', reasoning: 'Fallback end turn' };
  }
};
