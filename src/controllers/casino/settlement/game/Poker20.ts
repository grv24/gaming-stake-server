// helper: map hand + player to sid
function mapHandToSid(player: "A" | "B", hand: string): string {
  const mapping: Record<string, string> = {
    "One Pair": player === "A" ? "12" : "22",
    "Two Pair": player === "A" ? "13" : "23",
    "Three of a Kind": player === "A" ? "14" : "24",
    "Straight": player === "A" ? "15" : "25",
    "Flush": player === "A" ? "16" : "26",
    "Full House": player === "A" ? "17" : "27",
    "Four of a Kind": player === "A" ? "18" : "28",
    "Straight Flush": player === "A" ? "19" : "29"
  };

  return mapping[hand] || "";
}

export function settlePoker20Result(resultData: any): string[] {
  const winners = new Set<string>();

  // 1. Always add main winner sid
  if (resultData.win) {
    winners.add(resultData.win);
  }

  // 2. Parse `desc` → e.g. "Player A##Three of a Kind##Pair"
  if (resultData.desc) {
    const parts = resultData.desc.split("##");

    // Player A hand
    if (parts[1]) {
      const hand = parts[1].trim();
      winners.add(mapHandToSid("A", hand));
    }

    // Player B hand
    if (parts[2]) {
      const hand = parts[2].trim();
      winners.add(mapHandToSid("B", hand));
    }
  }

  return Array.from(winners).filter(Boolean);
}