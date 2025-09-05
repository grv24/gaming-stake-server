export function settleJoker20Result(resultData: any): string[] {
  const winners = new Set<string>();
  
  if (!resultData || !resultData.win) {
    return Array.from(winners);
  }

  // 1. Always add main winner sid
  winners.add(resultData.win);

  // 2. Parse `rdesc` field for additional winning conditions
  if (resultData.rdesc) {
    const parts = resultData.rdesc.split('#');

    parts.forEach((part: string) => {
      const val = part.trim().toLowerCase();

      // Main player winners
      if (val === "player a") winners.add("1");
      if (val === "player b") winners.add("2");

      // Joker side bets
      if (val === "joker even") winners.add("3");
      if (val === "joker odd") winners.add("4");
      if (val === "joker red") winners.add("5");
      if (val === "joker black") winners.add("6");
      if (val === "joker spade") winners.add("7");
      if (val === "joker heart") winners.add("8");
      if (val === "joker diamond") winners.add("9");
      if (val === "joker club") winners.add("10");

      // Extract card information
      if (val.includes("even")) winners.add("3");
      if (val.includes("odd")) winners.add("4");
      if (val.includes("red")) winners.add("5");
      if (val.includes("black")) winners.add("6");
      if (val.includes("spade")) winners.add("7");
      if (val.includes("heart")) winners.add("8");
      if (val.includes("diamond")) winners.add("9");
      if (val.includes("club")) winners.add("10");
    });
  }

  // 3. Parse `desc` field for additional winning conditions
  if (resultData.desc) {
    const desc = resultData.desc.toLowerCase();
    
    // Extract player information
    if (desc.includes("player a")) winners.add("1");
    if (desc.includes("player b")) winners.add("2");

    // Extract joker side bet information
    if (desc.includes("even")) winners.add("3");
    if (desc.includes("odd")) winners.add("4");
    if (desc.includes("red")) winners.add("5");
    if (desc.includes("black")) winners.add("6");
    if (desc.includes("spade")) winners.add("7");
    if (desc.includes("heart")) winners.add("8");
    if (desc.includes("diamond")) winners.add("9");
    if (desc.includes("club")) winners.add("10");
  }

  // 4. Parse `card` field for joker card analysis
  if (resultData.card) {
    const cards = resultData.card.split(',');
    
    // Find the joker card (usually the last card or specified position)
    let jokerCard = null;
    
    // Method 1: If there's a specific joker indicator
    cards.forEach((card: string) => {
      const cardValue = card.trim().toUpperCase();
      if (cardValue.includes('JOKER') || cardValue.includes('J')) {
        jokerCard = cardValue;
      }
    });
    
    // Method 2: If no explicit joker, use the last card
    if (!jokerCard && cards.length > 0) {
      jokerCard = cards[cards.length - 1].trim().toUpperCase();
    }
    
    if (jokerCard) {
      // Analyze joker card properties
      const cardMatch = jokerCard.match(/^([JQKA]|[2-9]|10)([SHCD]{2})$/);
      
      if (cardMatch) {
        const value = cardMatch[1];
        const suit = cardMatch[2];
        
        // Determine even/odd based on card value
        let cardValue = 0;
        if (value === 'A') cardValue = 1;
        else if (value === 'J') cardValue = 11;
        else if (value === 'Q') cardValue = 12;
        else if (value === 'K') cardValue = 13;
        else cardValue = parseInt(value);
        
        if (cardValue % 2 === 0) {
          winners.add("3"); // Joker Even
        } else {
          winners.add("4"); // Joker Odd
        }
        
        // Determine color based on suit
        if (suit.includes('H') || suit.includes('D')) {
          winners.add("5"); // Joker Red
        } else {
          winners.add("6"); // Joker Black
        }
        
        // Determine suit
        if (suit.includes('S')) winners.add("7"); // Joker Spade
        else if (suit.includes('H')) winners.add("8"); // Joker Heart
        else if (suit.includes('D')) winners.add("9"); // Joker Diamond
        else if (suit.includes('C')) winners.add("10"); // Joker Club
      }
    }
  }

  // 5. Parse `winnat` field for additional confirmation
  if (resultData.winnat) {
    const winnat = resultData.winnat.toLowerCase();
    
    if (winnat === "player a") winners.add("1");
    else if (winnat === "player b") winners.add("2");
  }

  return Array.from(winners);
}
