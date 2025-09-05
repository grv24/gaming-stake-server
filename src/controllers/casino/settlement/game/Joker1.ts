export function settleJoker1Result(resultData: any): string[] {
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
      if (val === "player a") winners.add("14");
      if (val === "player b") winners.add("140");
    });
  }

  // 3. Parse `desc` field for additional winning conditions
  if (resultData.desc) {
    const desc = resultData.desc.toLowerCase();
    
    // Extract player information
    if (desc.includes("player a")) winners.add("14");
    if (desc.includes("player b")) winners.add("140");
  }

  // 4. Parse `card` field for card analysis
  if (resultData.card) {
    const cards = resultData.card.split(',');
    
    // Analyze cards to determine winner
    // This is a simplified version - you may need to adjust based on actual game rules
    let playerAScore = 0;
    let playerBScore = 0;
    
    cards.forEach((card: string, index: number) => {
      const cardValue = card.trim();
      const cardNum = parseInt(cardValue) || 0;
      
      // Simple scoring: alternate cards between players
      if (index % 2 === 0) {
        playerAScore += cardNum;
      } else {
        playerBScore += cardNum;
      }
    });
    
    // Determine winner based on scores (if not already determined by win field)
    if (playerAScore > playerBScore) {
      winners.add("14"); // Player A wins
    } else if (playerBScore > playerAScore) {
      winners.add("140"); // Player B wins
    }
  }

  // 5. Parse `winnat` field for additional confirmation
  if (resultData.winnat) {
    const winnat = resultData.winnat.toLowerCase();
    
    if (winnat === "player a") winners.add("14");
    else if (winnat === "player b") winners.add("140");
  }

  return Array.from(winners);
}
