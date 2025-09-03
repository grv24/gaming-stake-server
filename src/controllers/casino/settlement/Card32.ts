export function settleCard32Result(resultData: any): string[] {
  const winners = new Set<string>();

  // Main winner from win field
  if (resultData.win) {
    winners.add(resultData.win);
  }

  // Parse desc field for additional winners
  if (resultData.desc) {
    const parts = resultData.desc.split("|");
    
    // Odds/Evens (part 1)
    if (parts[1]) {
      parts[1].split(",").forEach((cond: string) => {
        const [player, outcome] = cond.split(":");
        const playerNum = player.trim();
        
        if (playerNum === "8") {
          winners.add(outcome === "Odd" ? "5" : "6");
        } else if (playerNum === "9") {
          winners.add(outcome === "Odd" ? "7" : "8");
        } else if (playerNum === "10") {
          winners.add(outcome === "Odd" ? "9" : "10");
        } else if (playerNum === "11") {
          winners.add(outcome === "Odd" ? "11" : "12");
        }
      });
    }

    // Black/Red/2-2 (part 2)
    if (parts[2]) {
      parts[2].split(",").forEach((cond: string) => {
        const [key, val] = cond.split(":");
        if (key === "Black" && val === "Yes") winners.add("13");
        if (key === "Red" && val === "Yes") winners.add("14");
        if (key === "2-2" && val === "Yes") winners.add("27");
      });
    }

    // Group totals (part 4)
    if (parts[4]) {
      const group = parts[4].trim();
      if (group === "8-9") winners.add("25");
      if (group === "10-11") winners.add("26");
    }
  }

  return Array.from(winners);
}
