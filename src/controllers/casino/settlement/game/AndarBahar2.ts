export function settleAbjResult(result: any): string[] {
  const winningSids: string[] = [];
  const losingSids: string[] = [];

  let mainWinner = "";

  // Group sids by outcome
  const groups: Record<string, string[]> = {
    "SA": ["1"],         // Andar
    "1st Bet": ["2", "5"],
    "2nd Bet": ["3", "6"],
    "SB": ["4"],         // Bahar
    // If you want Jokers (7–25), you can add them too
  };

  // Find which group the winning sid belongs to
  for (const [name, sids] of Object.entries(groups)) {
    if (sids.includes(result.win)) {
      mainWinner = name;
      winningSids.push(...sids);
    } else {
      losingSids.push(...sids);
    }
  }

  return winningSids;
}
