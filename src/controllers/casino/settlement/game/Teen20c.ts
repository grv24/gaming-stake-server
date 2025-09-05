export function settleTeen20cResult(resultData: any): string[] {
  const winners = new Set<string>();
  
  if (!resultData || !resultData.win) {
    return Array.from(winners);
  }

  // 1. Always add main winner sid
  winners.add(resultData.win);

  // 2. Parse `rdesc` field for additional winning conditions
  if (resultData.rdesc) {
    const parts = resultData.rdesc.split('#');
    
    // Part 1: Main result (e.g., "Player A")
    if (parts[0]) {
      const mainResult = parts[0].trim();
      // Main result should match the win field, so we already added it
    }

    // Part 2: Detailed card results (e.g., "Player A(High Face Card)~(A : 3 | B : 3)")
    if (parts[1]) {
      const detailedResult = parts[1].trim();
      
      // Extract card values using regex
      const cardValueMatches = detailedResult.match(/A\s*:\s*(\d+)\s*\|\s*B\s*:\s*(\d+)/);
      
      if (cardValueMatches && cardValueMatches.length >= 3) {
        const playerAValue = parseInt(cardValueMatches[1]);
        const playerBValue = parseInt(cardValueMatches[2]);
        
        // Determine Pair Plus winners based on card values
        if (playerAValue >= 20) winners.add("3"); // Pair Plus A wins
        if (playerBValue >= 20) winners.add("4"); // Pair Plus B wins
        
        // Determine 3 Baccarat winners based on baccarat-like rules
        const playerABaccaratValue = playerAValue % 10;
        const playerBBaccaratValue = playerBValue % 10;
        
        if (playerABaccaratValue > playerBBaccaratValue) {
          winners.add("5"); // 3 Baccarat A wins
        } else if (playerBBaccaratValue > playerABaccaratValue) {
          winners.add("6"); // 3 Baccarat B wins
        }
        // If equal, it's a tie and neither 3 Baccarat bet wins
        
        // Determine Total winners (if total >= 20)
        if (playerAValue >= 20) winners.add("11"); // Total A wins
        if (playerBValue >= 20) winners.add("12"); // Total B wins
      }
    }

    // Part 3: Color results (e.g., "Player A (A : 25 | B : 24)")
    if (parts[2]) {
      const colorResult = parts[2].trim();
      
      // Extract card values for color determination
      const cardValueMatches = colorResult.match(/A\s*:\s*(\d+)\s*\|\s*B\s*:\s*(\d+)/);
      
      if (cardValueMatches && cardValueMatches.length >= 3) {
        const playerAValue = parseInt(cardValueMatches[1]);
        const playerBValue = parseInt(cardValueMatches[2]);
        
        // Determine color based on card values (assuming modulo 2 for red/black)
        const playerAColor = playerAValue % 2 === 0 ? "Red" : "Black";
        const playerBColor = playerBValue % 2 === 0 ? "Red" : "Black";
        
        // Add color bet winners
        if (playerAColor === "Black") {
          winners.add("7"); // Black A wins
        } else if (playerAColor === "Red") {
          winners.add("8"); // Red A wins
        }
        
        if (playerBColor === "Black") {
          winners.add("9"); // Black B wins
        } else if (playerBColor === "Red") {
          winners.add("10"); // Red B wins
        }
      }
    }

    // Part 4: Additional color info (e.g., "A : Black | B : Black")
    if (parts[3]) {
      const colorInfo = parts[3].trim();
      
      // Extract color information
      const colorMatches = colorInfo.match(/A\s*:\s*(Black|Red)\s*\|\s*B\s*:\s*(Black|Red)/);
      
      if (colorMatches && colorMatches.length >= 3) {
        const playerAColor = colorMatches[1];
        const playerBColor = colorMatches[2];
        
        // Add color bet winners based on explicit color info
        if (playerAColor === "Black") {
          winners.add("7"); // Black A wins
        } else if (playerAColor === "Red") {
          winners.add("8"); // Red A wins
        }
        
        if (playerBColor === "Black") {
          winners.add("9"); // Black B wins
        } else if (playerBColor === "Red") {
          winners.add("10"); // Red B wins
        }
      }
    }
  }

  return Array.from(winners);
}
