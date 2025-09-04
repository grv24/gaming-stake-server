export function settleTeenMuflisResult(resultData: any): string[] {
  const winners = new Set<string>();
  
  if (!resultData || !resultData.win) {
    return Array.from(winners);
  }

  // Main winner from win field
  const mainWinner = resultData.win.trim();
  winners.add(mainWinner);

  // Parse rdesc field for additional winning conditions
  if (resultData.rdesc) {
    const parts = resultData.rdesc.split('#-#');
    
    // Main result (e.g., "Player B")
    if (parts[0]) {
      const mainResult = parts[0].trim();
      // The main result should match the win field, so we already added it
    }

    // Detailed card results (e.g., "Player A (A : 3  |  B : 7)")
    if (parts[1]) {
      const detailedResult = parts[1].trim();
      
      // Extract card values using regex
      const cardValueMatches = detailedResult.match(/A\s*:\s*(\d+)\s*\|\s*B\s*:\s*(\d+)/);
      
      if (cardValueMatches && cardValueMatches.length >= 3) {
        const playerAValue = parseInt(cardValueMatches[1]);
        const playerBValue = parseInt(cardValueMatches[2]);
        
        // Determine Top 9 winners based on card values
        if (playerAValue >= 9) winners.add("3"); // Top 9 A wins
        if (playerBValue >= 9) winners.add("4"); // Top 9 B wins
        
        // Determine M Baccarat winners based on baccarat-like rules
        const playerABaccaratValue = playerAValue % 10;
        const playerBBaccaratValue = playerBValue % 10;
        
        if (playerABaccaratValue > playerBBaccaratValue) {
          winners.add("5"); // M Baccarat A wins
        } else if (playerBBaccaratValue > playerABaccaratValue) {
          winners.add("6"); // M Baccarat B wins
        }
        // If equal, it's a tie and neither M Baccarat bet wins
      }
    }
  }

  return Array.from(winners);
}

// // Alternative version if you need to handle the full result object structure
// export function settleTeenMuflisFromFullResult(resultResponse: any): string[] {
//   if (!resultResponse || !resultResponse.data || !resultResponse.data.data || !resultResponse.data.data.t1) {
//     return [];
//   }
  
//   const resultData = resultResponse.data.data.t1;
//   return settleTeenMuflisResult(resultData);
// }