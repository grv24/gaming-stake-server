export function settleGoalResult(resultData: any): string[] {
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

      // Player winners
      if (val.includes("cristiano ronaldo")) winners.add("1");
      if (val.includes("lionel messi")) winners.add("2");
      if (val.includes("robert lewandowski")) winners.add("3");
      if (val.includes("neymar")) winners.add("4");
      if (val.includes("harry kane")) winners.add("5");
      if (val.includes("zlatan ibrahimovic")) winners.add("6");
      if (val.includes("romelu lukaku")) winners.add("7");
      if (val.includes("kylian mbappe")) winners.add("8");
      if (val.includes("erling haaland")) winners.add("9");

      // Goal type winners
      if (val.includes("shot goal")) winners.add("11");
      if (val.includes("header goal")) winners.add("12");
      if (val.includes("penalty goal")) winners.add("13");
      if (val.includes("free kick goal")) winners.add("14");
      if (val.includes("no goal")) winners.add("10"); // or 15
    });
  }

  // 3. Parse `desc` field for additional winning conditions
  if (resultData.desc) {
    const desc = resultData.desc.toLowerCase();
    
    // Extract player information
    if (desc.includes("cristiano ronaldo")) winners.add("1");
    if (desc.includes("lionel messi")) winners.add("2");
    if (desc.includes("robert lewandowski")) winners.add("3");
    if (desc.includes("neymar")) winners.add("4");
    if (desc.includes("harry kane")) winners.add("5");
    if (desc.includes("zlatan ibrahimovic")) winners.add("6");
    if (desc.includes("romelu lukaku")) winners.add("7");
    if (desc.includes("kylian mbappe")) winners.add("8");
    if (desc.includes("erling haaland")) winners.add("9");

    // Extract goal type information
    if (desc.includes("shot goal")) winners.add("11");
    if (desc.includes("header goal")) winners.add("12");
    if (desc.includes("penalty goal")) winners.add("13");
    if (desc.includes("free kick goal")) winners.add("14");
    if (desc.includes("no goal")) winners.add("10"); // or 15
  }

  // 4. Parse `winnat` field for additional confirmation
  if (resultData.winnat) {
    const winnat = resultData.winnat.toLowerCase();
    
    if (winnat.includes("cristiano ronaldo")) winners.add("1");
    else if (winnat.includes("lionel messi")) winners.add("2");
    else if (winnat.includes("robert lewandowski")) winners.add("3");
    else if (winnat.includes("neymar")) winners.add("4");
    else if (winnat.includes("harry kane")) winners.add("5");
    else if (winnat.includes("zlatan ibrahimovic")) winners.add("6");
    else if (winnat.includes("romelu lukaku")) winners.add("7");
    else if (winnat.includes("kylian mbappe")) winners.add("8");
    else if (winnat.includes("erling haaland")) winners.add("9");
    else if (winnat.includes("no goal")) winners.add("10"); // or 15
  }

  // 5. Parse `card` field for additional information
  if (resultData.card) {
    const cardValue = resultData.card.trim();
    
    // Card field might contain additional goal information
    // For your example: "1" might indicate goal number or type
    if (cardValue === "1") {
      // If card is "1", it might indicate a goal was scored
      // This could trigger goal type bets
    }
  }

  return Array.from(winners);
}
