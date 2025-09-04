export function settleResultDT20(result: any): string[] {
  const winners = new Set<string>();
  
  if (!result || !result.win) {
    return Array.from(winners);
  }

  // Parse the main winners from win field (comma-separated)
  const mainWinners = result.win.split(',');
  mainWinners.forEach((winner: string) => winners.add(winner.trim()));

  // Parse the newdesc field for additional winning conditions
  if (result.newdesc) {
    const parts = result.newdesc.split('#');
    
    parts.forEach((part: string) => {
      // Dragon side bets
      const dragonMatch = part.match(/D\s*:\s*(Even|Odd|Red|Black|\d+)/gi);
      if (dragonMatch) {
        dragonMatch.forEach((match: string) => {
          const value = match.split(":")[1].trim();
          if (value === 'Even') {
            winners.add('5'); // Dragon Even
          } else if (value === 'Odd') {
            winners.add('6'); // Dragon Odd
          } else if (value === 'Red') {
            winners.add('7'); // Dragon Red
          } else if (value === 'Black') {
            winners.add('8'); // Dragon Black
          } else if (/^\d+$/.test(value)) {
            // Dragon Card bets: 9-21 for cards 1-10, J, Q, K
            const cardNum = parseInt(value);
            if (cardNum >= 1 && cardNum <= 10) {
              winners.add((8 + cardNum).toString());
            }
          }
        });
      }

      // Tiger side bets
      const tigerMatch = part.match(/T\s*:\s*(Even|Odd|Red|Black|\d+)/gi);
      if (tigerMatch) {
        tigerMatch.forEach((match: string) => {
          const value = match.split(":")[1].trim();
          if (value === 'Even') {
            winners.add('22'); // Tiger Even
          } else if (value === 'Odd') {
            winners.add('23'); // Tiger Odd
          } else if (value === 'Red') {
            winners.add('24'); // Tiger Red
          } else if (value === 'Black') {
            winners.add('25'); // Tiger Black
          } else if (/^\d+$/.test(value)) {
            // Tiger Card bets: 26-38 for cards 1-10, J, Q, K
            const cardNum = parseInt(value);
            if (cardNum >= 1 && cardNum <= 10) {
              winners.add((25 + cardNum).toString());
            }
          }
        });
      }

      // Handle No Pair and other special bets
      if (part.includes("No Pair")) {
        winners.add('4'); // Pair bet (No Pair wins when it's not a pair)
      }
    });
  }

  // Parse the desc field for additional winning conditions
  if (result.desc) {
    const desc = result.desc;
    const betSegments = desc.split("|");
    
    betSegments.forEach((segment: string) => {
      const trimmedSegment = segment.trim();
      
      // Extract side information (Dragon/Tiger)
      if (trimmedSegment.includes("Dragon")) {
        winners.add('1'); // Dragon
      }
      if (trimmedSegment.includes("Tiger")) {
        winners.add('2'); // Tiger
      }
      
      // Extract pair information
      if (trimmedSegment.includes("No Pair")) {
        winners.add('4'); // Pair (No Pair)
      }
      if (trimmedSegment.includes("Pair")) {
        winners.add('4'); // Pair
      }
      
      // Extract color information
      if (trimmedSegment.includes("Red")) {
        winners.add('7'); // Dragon Red
        winners.add('24'); // Tiger Red
      }
      if (trimmedSegment.includes("Black")) {
        winners.add('8'); // Dragon Black
        winners.add('25'); // Tiger Black
      }
      
      // Extract odd/even information
      if (trimmedSegment.includes("Odd")) {
        winners.add('6'); // Dragon Odd
        winners.add('23'); // Tiger Odd
      }
      if (trimmedSegment.includes("Even")) {
        winners.add('5'); // Dragon Even
        winners.add('22'); // Tiger Even
      }
      
      // Extract card-specific information
      const cardMatch = trimmedSegment.match(/Card([A-Z0-9]+)/gi);
      if (cardMatch) {
        cardMatch.forEach((match: string) => {
          const cardValue = match.replace("Card", "");
          if (/^\d+$/.test(cardValue)) {
            const cardNum = parseInt(cardValue);
            if (cardNum >= 1 && cardNum <= 10) {
              winners.add((8 + cardNum).toString()); // Dragon Card
              winners.add((25 + cardNum).toString()); // Tiger Card
            }
          } else if (/^[AKQJ]$/.test(cardValue)) {
            // Handle face cards
            let cardNum = 0;
            if (cardValue === 'A') cardNum = 1;
            else if (cardValue === 'J') cardNum = 11;
            else if (cardValue === 'Q') cardNum = 12;
            else if (cardValue === 'K') cardNum = 13;
            
            if (cardNum > 0) {
              winners.add((8 + cardNum).toString()); // Dragon Card
              winners.add((25 + cardNum).toString()); // Tiger Card
            }
          }
        });
      }
      
      // Extract number-specific information
      const numberMatch = trimmedSegment.match(/\b(\d+)\b/);
      if (numberMatch) {
        const cardNum = parseInt(numberMatch[1]);
        if (cardNum >= 1 && cardNum <= 10) {
          winners.add((8 + cardNum).toString()); // Dragon Card
          winners.add((25 + cardNum).toString()); // Tiger Card
        }
      }
      
      // Extract letter-specific information (A, K, Q, J, etc.)
      const letterMatch = trimmedSegment.match(/\b([AKQJ])\b/);
      if (letterMatch) {
        const cardValue = letterMatch[1];
        let cardNum = 0;
        if (cardValue === 'A') cardNum = 1;
        else if (cardValue === 'J') cardNum = 11;
        else if (cardValue === 'Q') cardNum = 12;
        else if (cardValue === 'K') cardNum = 13;
        
        if (cardNum > 0) {
          winners.add((8 + cardNum).toString()); // Dragon Card
          winners.add((25 + cardNum).toString()); // Tiger Card
        }
      }
    });
  }

  return Array.from(winners);
}
