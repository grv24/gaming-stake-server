interface Card {
  rank: string;
  suit: string;
  value?: number;
}

interface PokerHand {
  rank: number;
  name: string;
  cards: Card[];
}

export function settlePokerResult(result: any): string[] {
  const winningSids: string[] = [];

  // Handle case where newdesc is empty - parse cards to determine winner
  if (!result.newdesc || result.newdesc.trim() === "") {
    console.log(`[POKER] Empty newdesc for mid: ${result.mid}, evaluating cards directly`);
    
    if (result.cards && result.cardsorg) {
      const playerACards = parseCards(result.cards);
      const playerBCards = parseCards(result.cardsorg);
      
      if (playerACards.length > 0 && playerBCards.length > 0) {
        const playerAHand = evaluatePokerHand(playerACards);
        const playerBHand = evaluatePokerHand(playerBCards);
        
        const winner = comparePokerHands(playerAHand, playerBHand);
        
        if (winner === 'A') {
          winningSids.push("1"); // Player A main
          console.log(`[POKER] Player A wins with ${playerAHand.name}`);
        } else if (winner === 'B') {
          winningSids.push("2"); // Player B main
          console.log(`[POKER] Player B wins with ${playerBHand.name}`);
        } else {
          console.log(`[POKER] Tie between players`);
        }
      }
    }
    
    return winningSids;
  }

  // Original logic for when newdesc is available
  let mainWinner = "";

  // --- Main Winner ---
  if (result.newdesc.includes("Player A")) {
    mainWinner = "Player A";
    winningSids.push("1"); // Player A main
  } else if (result.newdesc.includes("Player B")) {
    mainWinner = "Player B";
    winningSids.push("2");
  }

  // --- Fancy Bets ---
  const parts = result.newdesc.split("#");

  parts.forEach((p: string | string[]) => {
    if (p.includes("A : 2card")) winningSids.push("3");
    if (p.includes("A : 7card")) winningSids.push("4");
    if (p.includes("B : 2card")) winningSids.push("5");
    if (p.includes("B : 7card")) winningSids.push("6");
  });

  return winningSids;
}

// Helper function to parse card strings like "3HH,QHH,2DD,QCC,KCC,4SS,KDD,9CC,10SS"
function parseCards(cardString: string): Card[] {
  const cards: Card[] = [];
  
  if (!cardString) return cards;
  
  const cardArray = cardString.split(',');
  
  cardArray.forEach(card => {
    card = card.trim();
    if (card.length >= 2) {
      const rank = card.slice(0, -2);
      const suit = card.slice(-2);
      
      cards.push({
        rank: rank,
        suit: suit
      });
    }
  });
  
  return cards;
}

// Helper function to evaluate poker hand strength
function evaluatePokerHand(cards: Card[]): PokerHand {
  if (cards.length < 5) {
    return { rank: 0, name: "Incomplete Hand", cards };
  }
  
  // Convert ranks to numeric values for comparison
  const rankValues: { [key: string]: number } = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
  };
  
  const numericCards = cards.map(card => ({
    ...card,
    value: rankValues[card.rank] || 0
  })).sort((a, b) => b.value - a.value);
  
  // Check for different hand types
  const suits = numericCards.map(card => card.suit);
  const values = numericCards.map(card => card.value);
  
  // Check for flush
  const isFlush = suits.every(suit => suit === suits[0]);
  
  // Check for straight
  const isStraight = checkStraight(values);
  
  // Check for pairs, trips, quads
  const counts = getValueCounts(values);
  const pairs = counts.filter(count => count === 2).length;
  const trips = counts.filter(count => count === 3).length;
  const quads = counts.filter(count => count === 4).length;
  
  // Determine hand rank
  if (isFlush && isStraight) {
    if (values[0] === 14 && values[1] === 13) {
      return { rank: 10, name: "Royal Flush", cards: numericCards };
    }
    return { rank: 9, name: "Straight Flush", cards: numericCards };
  }
  
  if (quads > 0) {
    return { rank: 8, name: "Four of a Kind", cards: numericCards };
  }
  
  if (trips > 0 && pairs > 0) {
    return { rank: 7, name: "Full House", cards: numericCards };
  }
  
  if (isFlush) {
    return { rank: 6, name: "Flush", cards: numericCards };
  }
  
  if (isStraight) {
    return { rank: 5, name: "Straight", cards: numericCards };
  }
  
  if (trips > 0) {
    return { rank: 4, name: "Three of a Kind", cards: numericCards };
  }
  
  if (pairs === 2) {
    return { rank: 3, name: "Two Pair", cards: numericCards };
  }
  
  if (pairs === 1) {
    return { rank: 2, name: "One Pair", cards: numericCards };
  }
  
  return { rank: 1, name: "High Card", cards: numericCards };
}

// Helper function to check for straight
function checkStraight(values: number[]): boolean {
  const sortedValues = [...values].sort((a, b) => b - a);
  
  for (let i = 0; i < sortedValues.length - 4; i++) {
    let consecutive = true;
    for (let j = 1; j < 5; j++) {
      if (sortedValues[i] - sortedValues[i + j] !== j) {
        consecutive = false;
        break;
      }
    }
    if (consecutive) return true;
  }
  
  // Check for A-2-3-4-5 straight
  if (sortedValues.includes(14) && sortedValues.includes(5) && 
      sortedValues.includes(4) && sortedValues.includes(3) && sortedValues.includes(2)) {
    return true;
  }
  
  return false;
}

// Helper function to get value counts
function getValueCounts(values: number[]): number[] {
  const counts: { [key: number]: number } = {};
  values.forEach(value => {
    counts[value] = (counts[value] || 0) + 1;
  });
  return Object.values(counts);
}

// Helper function to compare two poker hands
function comparePokerHands(handA: PokerHand, handB: PokerHand): 'A' | 'B' | 'Tie' {
  if (handA.rank > handB.rank) return 'A';
  if (handB.rank > handA.rank) return 'B';
  
  // If same rank, compare high cards
  const valuesA = handA.cards.map(card => card.value || 0).sort((a, b) => b - a);
  const valuesB = handB.cards.map(card => card.value || 0).sort((a, b) => b - a);
  
  for (let i = 0; i < Math.min(valuesA.length, valuesB.length); i++) {
    if (valuesA[i] > valuesB[i]) return 'A';
    if (valuesB[i] > valuesA[i]) return 'B';
  }
  
  return 'Tie';
}
