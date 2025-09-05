export function settleAB4Result(resultData: any): string[] {
  const winners = new Set<string>();
  
  if (!resultData || !resultData.win) {
    return Array.from(winners);
  }

  // 1. Always add main winner sid
  winners.add(resultData.win);

  // 2. Parse `sid` field if present
  if (resultData.sid) {
    winners.add(resultData.sid);
  }

  // 3. Parse `rdesc` field for additional winning conditions
  if (resultData.rdesc) {
    const parts = resultData.rdesc.split('#');

    parts.forEach((part: string) => {
      const val = part.trim().toLowerCase();

      // Andar card winners (sid 1-13)
      if (val.includes("andar a")) winners.add("1");
      if (val.includes("andar 2")) winners.add("2");
      if (val.includes("andar 3")) winners.add("3");
      if (val.includes("andar 4")) winners.add("4");
      if (val.includes("andar 5")) winners.add("5");
      if (val.includes("andar 6")) winners.add("6");
      if (val.includes("andar 7")) winners.add("7");
      if (val.includes("andar 8")) winners.add("8");
      if (val.includes("andar 9")) winners.add("9");
      if (val.includes("andar 10")) winners.add("10");
      if (val.includes("andar j")) winners.add("11");
      if (val.includes("andar q")) winners.add("12");
      if (val.includes("andar k")) winners.add("13");

      // Bahar card winners (sid 21-33)
      if (val.includes("bahar a")) winners.add("21");
      if (val.includes("bahar 2")) winners.add("22");
      if (val.includes("bahar 3")) winners.add("23");
      if (val.includes("bahar 4")) winners.add("24");
      if (val.includes("bahar 5")) winners.add("25");
      if (val.includes("bahar 6")) winners.add("26");
      if (val.includes("bahar 7")) winners.add("27");
      if (val.includes("bahar 8")) winners.add("28");
      if (val.includes("bahar 9")) winners.add("29");
      if (val.includes("bahar 10")) winners.add("30");
      if (val.includes("bahar j")) winners.add("31");
      if (val.includes("bahar q")) winners.add("32");
      if (val.includes("bahar k")) winners.add("33");
    });
  }

  // 4. Parse `desc` field for additional winning conditions
  if (resultData.desc) {
    const desc = resultData.desc.toLowerCase();
    
    // Extract Andar card information
    if (desc.includes("andar a")) winners.add("1");
    if (desc.includes("andar 2")) winners.add("2");
    if (desc.includes("andar 3")) winners.add("3");
    if (desc.includes("andar 4")) winners.add("4");
    if (desc.includes("andar 5")) winners.add("5");
    if (desc.includes("andar 6")) winners.add("6");
    if (desc.includes("andar 7")) winners.add("7");
    if (desc.includes("andar 8")) winners.add("8");
    if (desc.includes("andar 9")) winners.add("9");
    if (desc.includes("andar 10")) winners.add("10");
    if (desc.includes("andar j")) winners.add("11");
    if (desc.includes("andar q")) winners.add("12");
    if (desc.includes("andar k")) winners.add("13");

    // Extract Bahar card information
    if (desc.includes("bahar a")) winners.add("21");
    if (desc.includes("bahar 2")) winners.add("22");
    if (desc.includes("bahar 3")) winners.add("23");
    if (desc.includes("bahar 4")) winners.add("24");
    if (desc.includes("bahar 5")) winners.add("25");
    if (desc.includes("bahar 6")) winners.add("26");
    if (desc.includes("bahar 7")) winners.add("27");
    if (desc.includes("bahar 8")) winners.add("28");
    if (desc.includes("bahar 9")) winners.add("29");
    if (desc.includes("bahar 10")) winners.add("30");
    if (desc.includes("bahar j")) winners.add("31");
    if (desc.includes("bahar q")) winners.add("32");
    if (desc.includes("bahar k")) winners.add("33");
  }

  // 5. Parse `cards` field for card analysis
  if (resultData.cards) {
    const cards = resultData.cards.split(',');
    
    // Count occurrences of each card value
    const cardCounts: { [key: string]: number } = {};
    
    cards.forEach((card: string) => {
      const cardValue = card.trim().toUpperCase();
      const cardMatch = cardValue.match(/^([JQKA]|[2-9]|10)/);
      
      if (cardMatch) {
        const value = cardMatch[1];
        cardCounts[value] = (cardCounts[value] || 0) + 1;
      }
    });
    
    // Determine winners based on card counts
    Object.keys(cardCounts).forEach(cardValue => {
      const count = cardCounts[cardValue];
      
      // Map card value to sid
      let andarSid = 0;
      let baharSid = 0;
      
      if (cardValue === 'A') {
        andarSid = 1;
        baharSid = 21;
      } else if (cardValue === '2') {
        andarSid = 2;
        baharSid = 22;
      } else if (cardValue === '3') {
        andarSid = 3;
        baharSid = 23;
      } else if (cardValue === '4') {
        andarSid = 4;
        baharSid = 24;
      } else if (cardValue === '5') {
        andarSid = 5;
        baharSid = 25;
      } else if (cardValue === '6') {
        andarSid = 6;
        baharSid = 26;
      } else if (cardValue === '7') {
        andarSid = 7;
        baharSid = 27;
      } else if (cardValue === '8') {
        andarSid = 8;
        baharSid = 28;
      } else if (cardValue === '9') {
        andarSid = 9;
        baharSid = 29;
      } else if (cardValue === '10') {
        andarSid = 10;
        baharSid = 30;
      } else if (cardValue === 'J') {
        andarSid = 11;
        baharSid = 31;
      } else if (cardValue === 'Q') {
        andarSid = 12;
        baharSid = 32;
      } else if (cardValue === 'K') {
        andarSid = 13;
        baharSid = 33;
      }
      
      // Add winners based on card count (you may need to adjust this logic)
      if (count >= 1) {
        winners.add(andarSid.toString());
        winners.add(baharSid.toString());
      }
    });
  }

  // 6. Parse `winnat` field for additional confirmation
  if (resultData.winnat) {
    const winnat = resultData.winnat.toLowerCase();
    
    if (winnat.includes("andar a")) winners.add("1");
    else if (winnat.includes("andar 2")) winners.add("2");
    else if (winnat.includes("andar 3")) winners.add("3");
    else if (winnat.includes("andar 4")) winners.add("4");
    else if (winnat.includes("andar 5")) winners.add("5");
    else if (winnat.includes("andar 6")) winners.add("6");
    else if (winnat.includes("andar 7")) winners.add("7");
    else if (winnat.includes("andar 8")) winners.add("8");
    else if (winnat.includes("andar 9")) winners.add("9");
    else if (winnat.includes("andar 10")) winners.add("10");
    else if (winnat.includes("andar j")) winners.add("11");
    else if (winnat.includes("andar q")) winners.add("12");
    else if (winnat.includes("andar k")) winners.add("13");
    else if (winnat.includes("bahar a")) winners.add("21");
    else if (winnat.includes("bahar 2")) winners.add("22");
    else if (winnat.includes("bahar 3")) winners.add("23");
    else if (winnat.includes("bahar 4")) winners.add("24");
    else if (winnat.includes("bahar 5")) winners.add("25");
    else if (winnat.includes("bahar 6")) winners.add("26");
    else if (winnat.includes("bahar 7")) winners.add("27");
    else if (winnat.includes("bahar 8")) winners.add("28");
    else if (winnat.includes("bahar 9")) winners.add("29");
    else if (winnat.includes("bahar 10")) winners.add("30");
    else if (winnat.includes("bahar j")) winners.add("31");
    else if (winnat.includes("bahar q")) winners.add("32");
    else if (winnat.includes("bahar k")) winners.add("33");
  }

  return Array.from(winners);
}
