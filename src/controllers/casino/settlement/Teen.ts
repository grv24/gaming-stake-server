export function settleTeenResult(resultData: any): string[] {
  const winners = new Set<string>();

  // Main winner from 'win' field
  if (resultData.win) {
    winners.add(resultData.win);
  }

  // Parse newdesc field for additional winners
  if (resultData.newdesc) {
    const parts = resultData.newdesc.split("#");

    const players = parts[0]?.split(" ") || [];      // Player names (e.g., Player A, Player B)
    const extra = parts[3]?.split("|") || [];        // Extra conditions like A: Yes | B: Yes

    // Map players to their SIDs from t2
    if (resultData.t2) {
      resultData.t2.forEach((p: any) => {
        if (players.includes(p.nat) || players.includes(p.nation)) {
          winners.add(p.sid);
        }
      });
    }

    // Handle extra conditions (like A: Yes, B: Yes)
    extra.forEach((e: { split: (arg0: string) => { (): any; new(): any; map: { (arg0: (x: string) => string): [any, any]; new(): any; }; }; }) => {
      const [key, val] = e.split(":").map((x: string) => x.trim());
      if (val === "Yes") {
        if (key === "A") winners.add("1"); // Map A -> sid 1
        if (key === "B") winners.add("2"); // Map B -> sid 2
      }
    });
  }

  return Array.from(winners);
}
