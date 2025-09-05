// Player name → sid
const playerToSid: Record<string, string> = {
  "player 1": "11",
  "player 2": "12",
  "player 3": "13",
  "player 4": "14",
  "player 5": "15",
  "player 6": "16"
};

// Pattern name → sid
const patternToSid: Record<string, string> = {
  "high card": "21",
  "pair": "22",
  "two pair": "23",
  "three of a kind": "24",
  "straight": "25",
  "flush": "26",
  "full house": "27",
  "four of a kind": "28",
  "straight flush": "29"
};

export function settlePoker6Result(resultData: any): string[] {
  const winners = new Set<string>();

  // ✅ Main winner (sid directly from API "win")
  if (resultData.win) {
    resultData.win.split(",").forEach((sid: string) => {
      winners.add(sid.trim());
    });
  }

  // ✅ Extra winners from "sid"
  if (resultData.sid) {
    resultData.sid.split(",").forEach((sid: string) => {
      winners.add(sid.trim());
    });
  }

  // ✅ Parse "newdesc" (player + pattern)
  if (resultData.newdesc) {
    const parts = resultData.newdesc.split("|");

    parts.forEach((p: string) => {
      const [playerPart, patternPart] = p.split("#").map((x) => x.trim().toLowerCase());

      if (playerPart && playerToSid[playerPart]) {
        winners.add(playerToSid[playerPart]);
      }
      if (patternPart && patternToSid[patternPart]) {
        winners.add(patternToSid[patternPart]);
      }
    });
  }

  return Array.from(winners);
}
