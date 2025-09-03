// Amar Akbar Anthony Settlement
export function settleAAAResult(resultData: any): string[] {
  const winners = new Set<string>();

  // 1. Main winner (Amar/Akbar/Anthony)
  if (resultData.win) {
    winners.add(resultData.win); // Amar = 1, Akbar = 2, Anthony = 3
  }

  // 2. Explicit sids from result (if given)
  if (resultData.sid) {
    resultData.sid.split(",").forEach((id: string) => winners.add(id.trim()));
  }

  // 3. Parse newdesc (preferred over desc, since it's structured with #)
  if (resultData.newdesc) {
    const parts = resultData.newdesc.split("#");

    parts.forEach((p: string) => {
      const val = p.trim().toLowerCase();

      // Amar / Akbar / Anthony
      if (val === "amar") winners.add("1");
      if (val === "akbar") winners.add("2");
      if (val === "anthony") winners.add("3");

      // Odd / Even
      if (val === "even") winners.add("4");
      if (val === "odd") winners.add("5");

      // Red / Black
      if (val === "red") winners.add("6");
      if (val === "black") winners.add("7");

      // Under 7 / Over 7
      if (val === "under 7") winners.add("21");
      if (val === "over 7") winners.add("22");

      // Card values
      if (/^\d+$/.test(val)) {
        // Example: "4" → sid 11
        const num = parseInt(val, 10);
        if (num >= 2 && num <= 10) {
          winners.add((num + 7).toString()); // Card 2 → 9, Card 10 → 17
        } else if (num === 1) {
          winners.add("8"); // Card A
        }
      } else if (val === "a") winners.add("8");
      else if (val === "j") winners.add("18");
      else if (val === "q") winners.add("19");
      else if (val === "k") winners.add("20");
    });
  }

  return Array.from(winners);
}
