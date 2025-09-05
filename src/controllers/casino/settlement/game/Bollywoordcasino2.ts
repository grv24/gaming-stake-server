export function settleBollywoodCasino2Result(resultData: any): string[] {
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

      // Main movie/character winners
      if (val === "don") winners.add("1");
      if (val === "amar akbar anthony") winners.add("2");
      if (val === "sahib bibi aur ghulam") winners.add("3");
      if (val === "dharam veer") winners.add("4");
      if (val === "kis kis ko pyaar karoon") winners.add("5");
      if (val === "ghulam") winners.add("6");

      // Yes/No conditions (could be for Pair Plus or other special bets)
      if (val === "yes") {
        // Based on the result structure, "Yes" might indicate Pair Plus wins
        // We'll need to determine which player based on the main winner
        const mainWinner = resultData.win;
        if (mainWinner === "1" || mainWinner === "2" || mainWinner === "3" || 
            mainWinner === "4" || mainWinner === "5" || mainWinner === "6") {
          // If main winner is a movie, "Yes" might indicate special conditions
          // This could be interpreted as additional winning conditions
        }
      }

      // Special combinations
      if (val === "barati") winners.add("15"); // Barati J-A
      if (val === "dulha dulhan") winners.add("14"); // Dulha Dulhan K-Q

      // Color bets
      if (val === "red") winners.add("8");
      if (val === "black") winners.add("9");

      // Card bets
      if (val === "j") winners.add("10");
      if (val === "q") winners.add("11");
      if (val === "k") winners.add("12");
      if (val === "a") winners.add("13");

      // Odd/Even (if present)
      if (val === "odd") winners.add("7");
      if (val === "even") winners.add("7"); // Even also maps to sid 7
    });
  }

  // 3. Parse `card` field for card-specific bets
  if (resultData.card) {
    const cardValue = resultData.card.trim().toUpperCase();
    
    // Extract card value (e.g., "JHH" -> "J")
    const cardMatch = cardValue.match(/^([JQKA]|[2-9]|10)/);
    if (cardMatch) {
      const value = cardMatch[1];
      
      if (value === "J") winners.add("10");
      else if (value === "Q") winners.add("11");
      else if (value === "K") winners.add("12");
      else if (value === "A") winners.add("13");
    }
  }

  // 4. Parse `winnat` field for additional confirmation
  if (resultData.winnat) {
    const winnat = resultData.winnat.toLowerCase();
    
    // Map winnat to sid
    if (winnat === "don") winners.add("1");
    else if (winnat === "amar akbar anthony") winners.add("2");
    else if (winnat === "sahib bibi aur ghulam") winners.add("3");
    else if (winnat === "dharam veer") winners.add("4");
    else if (winnat === "kis kis ko pyaar karoon") winners.add("5");
    else if (winnat === "ghulam") winners.add("6");
  }

  return Array.from(winners);
}
