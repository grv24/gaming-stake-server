export function settleCasinoWarResult(resultData: any): string[] {
  const winners = new Set<string>();
  
  if (!resultData || !resultData.win) {
    return Array.from(winners);
  }

  // Parse the main winners from win field (comma-separated)
  const mainWinners = resultData.win.split(',');
  mainWinners.forEach((winner: string) => winners.add(winner.trim()));

  // Parse the newdesc field for additional winning conditions
  if (resultData.newdesc) {
    const parts = resultData.newdesc.split('#');
    
    // Part 1: Color results (Black/Red for each position 1-6)
    if (parts[1]) {
      const colorResults = parts[1].split('~');
      colorResults.forEach((resultGroup: string, index: any) => {
        const results = resultGroup.split('|');
        results.forEach(result => {
          const [position, color] = result.split(':').map(item => item.trim());
          const posNum = position.replace(/\D/g, '');
          
          // Add corresponding color bet winners
          if (color.includes('Black')) {
            winners.add((parseInt(posNum) * 10 + 2).toString()); // Black bets: 12, 22, 32, etc.
          } else if (color.includes('Red')) {
            winners.add((parseInt(posNum) * 10 + 3).toString()); // Red bets: 13, 23, 33, etc.
          }
        });
      });
    }

    // Part 2: Odd/Even results
    if (parts[2]) {
      const oddEvenResults = parts[2].split('~');
      oddEvenResults.forEach((resultGroup: string, index: any) => {
        const results = resultGroup.split('|');
        results.forEach(result => {
          const [position, type] = result.split(':').map(item => item.trim());
          const posNum = position.replace(/\D/g, '');
          
          // Add corresponding odd/even bet winners
          if (type.includes('Odd')) {
            winners.add((parseInt(posNum) * 10 + 4).toString()); // Odd bets: 14, 24, 34, etc.
          } else if (type.includes('Even')) {
            winners.add((parseInt(posNum) * 10 + 5).toString()); // Even bets: 15, 25, 35, etc.
          }
        });
      });
    }

    // Part 3: Suit results (if exists)
    if (parts[3]) {
      const suitResults = parts[3].split('~');
      suitResults.forEach((resultGroup: string, index: any) => {
        const results = resultGroup.split('|');
        results.forEach(result => {
          const [position, suit] = result.split(':').map(item => item.trim());
          const posNum = position.replace(/\D/g, '');
          
          // Add corresponding suit bet winners
          if (suit.includes('Spade')) {
            winners.add((parseInt(posNum) * 10 + 6).toString()); // Spade bets: 16, 26, 36, etc.
          } else if (suit.includes('Heart')) {
            winners.add((parseInt(posNum) * 10 + 8).toString()); // Heart bets: 18, 28, 38, etc.
          } else if (suit.includes('Club')) {
            winners.add((parseInt(posNum) * 10 + 7).toString()); // Club bets: 17, 27, 37, etc.
          } else if (suit.includes('Diamond')) {
            winners.add((parseInt(posNum) * 10 + 9).toString()); // Diamond bets: 19, 29, 39, etc.
          }
        });
      });
    }
  }

  return Array.from(winners);
}