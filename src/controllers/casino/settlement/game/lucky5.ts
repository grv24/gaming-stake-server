export function settleLucky5Result(resultData: any): string[] {
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

      // Card type winners
      if (val === "low card") winners.add("1");
      if (val === "high card") winners.add("2");
      if (val === "even") winners.add("3");
      if (val === "odd") winners.add("4");
      if (val === "red") winners.add("5");
      if (val === "black") winners.add("6");

      // Specific card winners
      if (val === "card 1") winners.add("7");
      if (val === "card 2") winners.add("8");
      if (val === "card 3") winners.add("9");
      if (val === "card 4") winners.add("10");
      if (val === "card 5") winners.add("11");
      if (val === "card 6") winners.add("12");
      if (val === "card 7") winners.add("13");
      if (val === "card 8") winners.add("14");
      if (val === "card 9") winners.add("15");
      if (val === "card 10") winners.add("16");
      if (val === "card j") winners.add("17");
    });
  }

  // 3. Parse `desc` field for additional winning conditions
  if (resultData.desc) {
    const desc = resultData.desc.toLowerCase();
    
    // Extract card type information
    if (desc.includes("low card")) winners.add("1");
    if (desc.includes("high card")) winners.add("2");
    if (desc.includes("even")) winners.add("3");
    if (desc.includes("odd")) winners.add("4");
    if (desc.includes("red")) winners.add("5");
    if (desc.includes("black")) winners.add("6");

    // Extract specific card information
    if (desc.includes("card 1")) winners.add("7");
    if (desc.includes("card 2")) winners.add("8");
    if (desc.includes("card 3")) winners.add("9");
    if (desc.includes("card 4")) winners.add("10");
    if (desc.includes("card 5")) winners.add("11");
    if (desc.includes("card 6")) winners.add("12");
    if (desc.includes("card 7")) winners.add("13");
    if (desc.includes("card 8")) winners.add("14");
    if (desc.includes("card 9")) winners.add("15");
    if (desc.includes("card 10")) winners.add("16");
    if (desc.includes("card j")) winners.add("17");
  }

  // 4. Parse `card` field for card analysis
  if (resultData.card) {
    const cardValue = resultData.card.trim();
    
    // Analyze the card value
    const cardNum = parseInt(cardValue);
    
    if (!isNaN(cardNum)) {
      // Determine card type winners
      if (cardNum >= 1 && cardNum <= 5) {
        winners.add("1"); // Low Card
      } else if (cardNum >= 6 && cardNum <= 10) {
        winners.add("2"); // High Card
      }
      
      // Determine even/odd
      if (cardNum % 2 === 0) {
        winners.add("3"); // Even
      } else {
        winners.add("4"); // Odd
      }
      
      // Determine specific card (if within range)
      if (cardNum >= 1 && cardNum <= 10) {
        winners.add((6 + cardNum).toString()); // Card 1 → 7, Card 10 → 16
      }
    }
  }

  // 5. Parse `winnat` field for additional confirmation
  if (resultData.winnat) {
    const winnat = resultData.winnat.toLowerCase();
    
    if (winnat === "low card") winners.add("1");
    else if (winnat === "high card") winners.add("2");
    else if (winnat === "even") winners.add("3");
    else if (winnat === "odd") winners.add("4");
    else if (winnat === "red") winners.add("5");
    else if (winnat === "black") winners.add("6");
    else if (winnat === "card 1") winners.add("7");
    else if (winnat === "card 2") winners.add("8");
    else if (winnat === "card 3") winners.add("9");
    else if (winnat === "card 4") winners.add("10");
    else if (winnat === "card 5") winners.add("11");
    else if (winnat === "card 6") winners.add("12");
    else if (winnat === "card 7") winners.add("13");
    else if (winnat === "card 8") winners.add("14");
    else if (winnat === "card 9") winners.add("15");
    else if (winnat === "card 10") winners.add("16");
    else if (winnat === "card j") winners.add("17");
  }

  return Array.from(winners);
}
